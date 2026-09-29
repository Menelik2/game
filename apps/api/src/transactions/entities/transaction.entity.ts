import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'BET'
  | 'WIN'
  | 'BONUS'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'FEE'
  | 'DEMO_CREDIT';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: TransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reference!: string | null;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
