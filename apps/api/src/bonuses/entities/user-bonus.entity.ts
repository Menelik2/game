import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_bonuses')
export class UserBonus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'bonus_id', type: 'uuid' })
  bonusId!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'amount_granted', type: 'decimal', precision: 18, scale: 4 })
  amountGranted!: string;

  @Column({ name: 'wagering_progress', type: 'decimal', precision: 18, scale: 4, default: 0 })
  wageringProgress!: string;

  @Column({ name: 'wagering_required', type: 'decimal', precision: 18, scale: 4, default: 0 })
  wageringRequired!: string;

  @CreateDateColumn({ name: 'claimed_at', type: 'timestamptz' })
  claimedAt!: Date;
}
