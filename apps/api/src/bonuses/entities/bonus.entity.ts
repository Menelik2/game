import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bonuses')
export class Bonus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: string;

  /** Credit amount (column name: value) */
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  value!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'wagering_requirement', type: 'decimal', precision: 10, scale: 2, default: 1 })
  wageringRequirement!: string;

  @Column({ name: 'min_deposit', type: 'decimal', precision: 18, scale: 4, nullable: true })
  minDeposit!: string | null;

  @Column({ name: 'max_bonus', type: 'decimal', precision: 18, scale: 4, nullable: true })
  maxBonus!: string | null;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt!: Date | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
