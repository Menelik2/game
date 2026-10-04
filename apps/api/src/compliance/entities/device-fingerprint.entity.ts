import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('device_fingerprints')
export class DeviceFingerprint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'fingerprint_hash', type: 'varchar', length: 128 })
  fingerprintHash!: string;

  @Column({ name: 'ip_hash', type: 'varchar', length: 128, nullable: true })
  ipHash!: string | null;

  @Column({ name: 'user_agent_hash', type: 'varchar', length: 128, nullable: true })
  userAgentHash!: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  signals!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt!: Date;
}
