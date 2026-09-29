import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SessionStatus = 'ACTIVE' | 'ENDED' | 'EXPIRED';

@Entity('game_sessions')
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: SessionStatus;

  @Column({ name: 'server_seed_hash', type: 'varchar', length: 128, nullable: true })
  serverSeedHash!: string | null;

  @Column({ name: 'client_seed', type: 'varchar', length: 128, nullable: true })
  clientSeed!: string | null;

  @Column({ name: 'round_count', type: 'int', default: 0 })
  roundCount!: number;

  @Column({ name: 'total_wagered', type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalWagered!: string;

  @Column({ name: 'total_won', type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalWon!: string;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
