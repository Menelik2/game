import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('kyc_verifications')
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'external_id', type: 'varchar', length: 128 })
  externalId!: string;

  @Column({ type: 'varchar', length: 32, default: 'null' })
  provider!: string;

  @Column({ type: 'varchar', length: 16, default: 'BASIC' })
  level!: string;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'NOT_STARTED' })
  status!: string;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ name: 'rejection_reasons', type: 'jsonb', nullable: true })
  rejectionReasons!: string[] | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
