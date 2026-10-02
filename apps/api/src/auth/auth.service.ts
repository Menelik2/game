import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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

interface RegisterDto {
  email: string;
  password: string;
  dateOfBirth: string;
  country: string;
  acceptTerms: boolean;
  acceptAge: boolean;
}

interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
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
    if (!dto.acceptTerms || !dto.acceptAge) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'You must accept terms and confirm you are of legal age',
      });
    }

    if (!dto.email || !dto.password) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required',
      });
    }

    if (dto.password.length < 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 6 characters',
      });
    }

    const email = dto.email.trim().toLowerCase();

    const dob = new Date(dto.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date of birth',
      });
    }
    const age = this.calculateAge(dob);
    if (age < 18) {
      throw new ForbiddenException({
        code: 'AGE_RESTRICTED',
        message: 'You must be at least 18 years old',
      });
    }

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = queryRunner.manager.create(User, {
        email,
        passwordHash,
        dateOfBirth: dto.dateOfBirth,
        country: (dto.country || 'US').toUpperCase().slice(0, 2),
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      });
      const savedUser = await queryRunner.manager.save(user);

      const profile = queryRunner.manager.create(UserProfile, {
        userId: savedUser.id,
      });
      await queryRunner.manager.save(profile);

      await queryRunner.commitTransaction();

      await this.walletService.createDemoWallet(savedUser.id);

      await this.audit.log({
        userId: savedUser.id,
        action: 'USER_REGISTERED',
        entity: 'user',
        entityId: savedUser.id,
        ipHash: ip ? this.hashIp(ip) : undefined,
      });

      const tokens = await this.issueTokens(savedUser);
      return {
        user: this.sanitizeUser(savedUser),
        ...tokens,
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto, ip?: string) {
    const email = (dto.email || '').trim().toLowerCase();
    if (!email || !dto.password) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
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
      valid = await argon2.verify(user.passwordHash, dto.password);
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
        message: 'Invalid credentials',
      });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);

    await this.audit.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'user',
      entityId: user.id,
      ipHash: ip ? this.hashIp(ip) : undefined,
    });

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async issueTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      roles: user.adminRoles || [],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      country: user.country,
      isAdmin: user.isAdmin,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  private hashIp(ip: string): string {
    return Buffer.from(ip).toString('base64').slice(0, 32);
  }
}
