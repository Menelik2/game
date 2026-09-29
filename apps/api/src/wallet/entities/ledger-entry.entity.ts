import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export type LedgerEntryType = 'DEBIT' | 'CREDIT';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ name: 'entry_type', type: 'varchar', length: 10 })
  entryType!: LedgerEntryType;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 18, scale: 4 })
  balanceAfter!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Wallet, (w) => w.ledgerEntries)
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction;
}
