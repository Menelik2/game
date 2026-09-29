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

  /** Stored server-side only – never expose raw seed to client until session ends */
  @Column({ name: 'server_seed', type: 'varchar', length: 128, nullable: true })
  serverSeed!: string | null;

  @Column({ name: 'client_seed', type: 'varchar', length: 64, nullable: true })
  clientSeed!: string | null;

  @Column({ type: 'int', default: 0 })
  nonce!: number;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
