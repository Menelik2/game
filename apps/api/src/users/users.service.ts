import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
  ) {}

  async findById(id: string) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['profile'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMe(userId: string) {
    const user = await this.findById(userId);
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      country: user.country,
      dateOfBirth: user.dateOfBirth,
      isAdmin: user.isAdmin,
      emailVerifiedAt: user.emailVerifiedAt,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatar: user.profile.avatar,
            timezone: user.profile.timezone,
            language: user.profile.language,
          }
        : null,
      createdAt: user.createdAt,
    };
  }
}
