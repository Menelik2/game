import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GameProvider } from './game-provider.entity';

export type GameCategory =
  | 'SLOTS'
  | 'TABLE'
  | 'ROULETTE'
  | 'BLACKJACK'
  | 'BACCARAT'
  | 'POKER'
  | 'INSTANT'
  | 'CRASH'
  | 'LIVE'
  | 'JACKPOT';

export type GameStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'COMING_SOON';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'provider_id', type: 'uuid', nullable: true })
  providerId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  category!: GameCategory;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: GameStatus;

  @Column({ type: 'varchar', length: 32, default: '1.0.0' })
  version!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnail!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: {} })
  configuration!: Record<string, unknown>;

  @Column({ name: 'min_bet', type: 'decimal', precision: 18, scale: 4, default: 0.1 })
  minBet!: string;

  @Column({ name: 'max_bet', type: 'decimal', precision: 18, scale: 4, default: 500 })
  maxBet!: string;

  @Column({ name: 'is_new', type: 'boolean', default: false })
  isNew!: boolean;

  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  @Column({ name: 'has_jackpot', type: 'boolean', default: false })
  hasJackpot!: boolean;

  @Column({ name: 'play_count', type: 'int', default: 0 })
  playCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => GameProvider, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider?: GameProvider;
}
