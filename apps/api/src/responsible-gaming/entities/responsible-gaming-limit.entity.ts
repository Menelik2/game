import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('responsible_gaming_limits')
export class ResponsibleGamingLimit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'daily_deposit_limit', type: 'decimal', precision: 18, scale: 4, nullable: true })
  dailyDepositLimit!: string | null;

  @Column({ name: 'weekly_deposit_limit', type: 'decimal', precision: 18, scale: 4, nullable: true })
  weeklyDepositLimit!: string | null;

  @Column({ name: 'monthly_deposit_limit', type: 'decimal', precision: 18, scale: 4, nullable: true })
  monthlyDepositLimit!: string | null;

  @Column({ name: 'daily_loss_limit', type: 'decimal', precision: 18, scale: 4, nullable: true })
  dailyLossLimit!: string | null;

  @Column({ name: 'session_limit_minutes', type: 'int', nullable: true })
  sessionLimitMinutes!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
