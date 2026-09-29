import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for Apex Casino (DEMO mode).
 * Prefer running migrations in production; seed may use synchronize in local dev.
 */
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(255) NOT NULL UNIQUE,
        phone varchar(50),
        password_hash varchar(255) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
        date_of_birth date,
        country varchar(2),
        email_verified_at timestamptz,
        mfa_enabled boolean NOT NULL DEFAULT false,
        mfa_secret varchar(255),
        failed_login_attempts int NOT NULL DEFAULT 0,
        locked_until timestamptz,
        is_admin boolean NOT NULL DEFAULT false,
        admin_roles text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        first_name varchar(100),
        last_name varchar(100),
        avatar varchar(512),
        timezone varchar(64) NOT NULL DEFAULT 'UTC',
        language varchar(10) NOT NULL DEFAULT 'en',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        currency varchar(10) NOT NULL DEFAULT 'DEMO',
        available_balance decimal(18,4) NOT NULL DEFAULT 0,
        locked_balance decimal(18,4) NOT NULL DEFAULT 0,
        bonus_balance decimal(18,4) NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, currency)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        wallet_id uuid NOT NULL,
        type varchar(32) NOT NULL,
        amount decimal(18,4) NOT NULL,
        currency varchar(10) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING',
        reference varchar(128),
        idempotency_key varchar(64) UNIQUE,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_id uuid NOT NULL,
        transaction_id uuid NOT NULL,
        entry_type varchar(10) NOT NULL,
        amount decimal(18,4) NOT NULL,
        balance_after decimal(18,4) NOT NULL,
        description varchar(64),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_providers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(128) NOT NULL,
        slug varchar(64) NOT NULL UNIQUE,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        logo varchar(512),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS games (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug varchar(128) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        provider_id uuid,
        category varchar(32) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        version varchar(32) NOT NULL DEFAULT '1.0.0',
        thumbnail varchar(512),
        description text,
        configuration jsonb NOT NULL DEFAULT '{}',
        min_bet decimal(18,4) NOT NULL DEFAULT 0.1,
        max_bet decimal(18,4) NOT NULL DEFAULT 500,
        is_new boolean NOT NULL DEFAULT false,
        is_popular boolean NOT NULL DEFAULT false,
        has_jackpot boolean NOT NULL DEFAULT false,
        play_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        game_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        server_seed_hash varchar(128),
        client_seed varchar(128),
        round_count int NOT NULL DEFAULT 0,
        total_wagered decimal(18,4) NOT NULL DEFAULT 0,
        total_won decimal(18,4) NOT NULL DEFAULT 0,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id uuid NOT NULL,
        user_id uuid NOT NULL,
        game_id uuid NOT NULL,
        round_number int NOT NULL,
        bet_amount decimal(18,4) NOT NULL,
        win_amount decimal(18,4) NOT NULL DEFAULT 0,
        result_hash varchar(128),
        result_data jsonb NOT NULL,
        bet_transaction_id uuid,
        win_transaction_id uuid,
        idempotency_key varchar(64) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        game_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, game_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid,
        admin_id uuid,
        action varchar(128) NOT NULL,
        entity varchar(64),
        entity_id varchar(64),
        ip_hash varchar(128),
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS self_exclusions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        start_at timestamptz NOT NULL,
        end_at timestamptz NOT NULL,
        reason varchar(500),
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS responsible_gaming_limits (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE,
        daily_deposit_limit decimal(18,4),
        weekly_deposit_limit decimal(18,4),
        monthly_deposit_limit decimal(18,4),
        daily_loss_limit decimal(18,4),
        session_limit_minutes int,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bonuses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(128) NOT NULL,
        name varchar(255) NOT NULL,
        type varchar(32) NOT NULL,
        amount decimal(18,4) NOT NULL DEFAULT 0,
        wagering_requirement decimal(10,2) NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        rules jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_bonuses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        bonus_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        amount_granted decimal(18,4) NOT NULL,
        wagering_progress decimal(18,4) NOT NULL DEFAULT 0,
        wagering_required decimal(18,4) NOT NULL DEFAULT 0,
        claimed_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'user_bonuses', 'bonuses', 'responsible_gaming_limits', 'self_exclusions',
      'audit_logs', 'favorites', 'game_rounds', 'game_sessions', 'games',
      'game_providers', 'ledger_entries', 'transactions', 'wallets',
      'user_profiles', 'users',
    ];
    for (const t of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
  }
}
