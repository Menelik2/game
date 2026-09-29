import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('game_rounds')
export class GameRound {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @Column({ name: 'round_number', type: 'int' })
  roundNumber!: number;

  @Column({ name: 'bet_amount', type: 'decimal', precision: 18, scale: 4 })
  betAmount!: string;

  @Column({ name: 'win_amount', type: 'decimal', precision: 18, scale: 4, default: 0 })
  winAmount!: string;

  @Column({ name: 'result_hash', type: 'varchar', length: 128, nullable: true })
  resultHash!: string | null;

  @Column({ name: 'result_data', type: 'jsonb' })
  resultData!: Record<string, unknown>;

  @Column({ name: 'bet_transaction_id', type: 'uuid', nullable: true })
  betTransactionId!: string | null;

  @Column({ name: 'win_transaction_id', type: 'uuid', nullable: true })
  winTransactionId!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, unique: true })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
