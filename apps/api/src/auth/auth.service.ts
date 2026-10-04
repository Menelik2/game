import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';

/** Normalize Ethiopian mobile to +2519xxxxxxxx */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('251') && n.length >= 12) n = n.slice(3);
  if (n.startsWith('0') && n.length === 10) n = n.slice(1);
  // 9xxxxxxxx
  if (n.length === 9 && n.startsWith('9')) {
    return `+251${n}`;
  }
  // already 2519xxxxxxxx without plus handled above
  return null;
}

interface RegisterDto {
  fullName: string;
  phone: string;
  password: string;
  email?: string;
  dateOfBirth?: string;
  country?: string;
  acceptTerms?: boolean;
  acceptAge?: boolean;
}

interface LoginDto {
  phone?: string;
  email?: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const fullName = (dto.fullName || '').trim().replace(/\s+/g, ' ');
    if (fullName.length < 2) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Full name is required (min 2 characters)',
      });
    }

    const phone = normalizePhone(dto.phone || '');
    if (!phone) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Valid Ethiopian phone required (e.g. 09xxxxxxxx or +2519xxxxxxxx)',
      });
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 6 characters',
      });
    }

    const existingPhone = await this.userRepo.findOne({ where: { phone } });
    if (existingPhone) {
      throw new ConflictException({
        code: 'PHONE_EXISTS',
        message: 'An account with this phone number already exists',
      });
    }

    const email =
      (dto.email || '').trim().toLowerCase() ||
      `${phone.replace('+', '')}@phone.equb.local`;

    const existingEmail = await this.userRepo.findOne({ where: { email } });
    if (existingEmail) {
      throw new ConflictException({
        code: 'PHONE_EXISTS',
        message: 'An account with this phone number already exists',
      });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.slice(1).join(' ') || null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedUser: User;
    try {
      const user = queryRunner.manager.create(User, {
        email,
        phone,
        passwordHash,
        dateOfBirth: dto.dateOfBirth || null,
        country: (dto.country || 'ET').toUpperCase().slice(0, 2),
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      });
      savedUser = await queryRunner.manager.save(user);

      const profile = queryRunner.manager.create(UserProfile, {
        userId: savedUser.id,
        firstName,
        lastName,
        language: 'am',
      });
      await queryRunner.manager.save(profile);

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Register transaction failed', e instanceof Error ? e.stack : e);
      throw e;
    } finally {
      await queryRunner.release();
    }

    // Wallet after commit — must not fail the whole registration
    try {
      await this.walletService.createDemoWallet(savedUser.id);
    } catch (e) {
      this.logger.warn(
        `Demo wallet failed for ${savedUser.id}: ${e instanceof Error ? e.message : e}`,
      );
    }

    try {
      await this.audit.log({
        userId: savedUser.id,
        action: 'USER_REGISTERED',
        entity: 'user',
        entityId: savedUser.id,
        ipHash: ip ? this.hashIp(ip) : undefined,
      });
    } catch {
      /* non-fatal */
    }

    const tokens = await this.issueTokens(savedUser);
    return {
      user: this.sanitizeUser(savedUser, fullName),
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const password = dto.password || '';
    const phoneNorm = normalizePhone(dto.phone || '');
    const email = (dto.email || '').trim().toLowerCase();

    if (!password || (!phoneNorm && !email)) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Phone and password are required',
      });
    }

    let user: User | null = null;
    if (phoneNorm) {
      user = await this.userRepo.findOne({ where: { phone: phoneNorm } });
      if (!user) {
        user = await this.userRepo.findOne({
          where: { email: `${phoneNorm.replace('+', '')}@phone.equb.local` },
        });
      }
    }
    if (!user && email) {
      user = await this.userRepo.findOne({ where: { email } });
    }

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid phone or password',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to too many failed attempts',
      });
    }

    if (user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Account is not active',
      });
    }

    let valid = false;
    try {
      valid = await argon2.verify(user.passwordHash, password);
    } catch {
      valid = false;
    }

    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid phone or password',
      });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);

    try {
      await this.audit.log({
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'user',
        entityId: user.id,
        ipHash: ip ? this.hashIp(ip) : undefined,
      });
    } catch {
      /* non-fatal */
    }

    const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
    const fullName =
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
      user.phone ||
      user.email;

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user, fullName),
      ...tokens,
    };
  }

  async issueTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      roles: user.adminRoles || [],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m') as string & import('ms').StringValue,
    } as Parameters<JwtService['signAsync']>[1]);

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d') as string & import('ms').StringValue,
      } as Parameters<JwtService['signAsync']>[1],
    );

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  private sanitizeUser(user: User, fullName?: string) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: fullName || null,
      status: user.status,
      country: user.country,
      isAdmin: user.isAdmin,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private hashIp(ip: string): string {
    return Buffer.from(ip).toString('base64').slice(0, 32);
  }
}
