import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId?: string;
    adminId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ipHash?: string;
    metadata?: Record<string, unknown>;
  }) {
    const entry = this.repo.create({
      userId: params.userId || null,
      adminId: params.adminId || null,
      action: params.action,
      entity: params.entity || null,
      entityId: params.entityId || null,
      ipHash: params.ipHash || null,
      metadata: params.metadata || null,
    });
    return this.repo.save(entry);
  }
}
