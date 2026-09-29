import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LedgerEntry } from './ledger-entry.entity';

export type WalletStatus = 'ACTIVE' | 'LOCKED' | 'CLOSED';

@Entity('wallets')
@Index(['userId', 'currency'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 10, default: 'DEMO' })
  currency!: string;

  @Column({
    name: 'available_balance',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  availableBalance!: string;

  @Column({
    name: 'locked_balance',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  lockedBalance!: string;

  @Column({
    name: 'bonus_balance',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  bonusBalance!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: WalletStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (u) => u.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => LedgerEntry, (e) => e.wallet)
  ledgerEntries?: LedgerEntry[];
}
