import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { config } from 'dotenv';
import { User } from '../../users/entities/user.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { LedgerEntry } from '../../wallet/entities/ledger-entry.entity';
import { GameProvider } from '../../games/entities/game-provider.entity';
import { Game } from '../../games/entities/game.entity';
import { Bonus } from '../../bonuses/entities/bonus.entity';

config();

async function run() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL is not set. Example:');
    console.error(
      '  DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run seed --workspace=@apex/api',
    );
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    entities: [User, UserProfile, Wallet, Transaction, LedgerEntry, GameProvider, Game, Bonus],
    synchronize: true,
  });

  await ds.initialize();
  console.log('Connected. Seeding...');

  const userRepo = ds.getRepository(User);
  const profileRepo = ds.getRepository(UserProfile);
  const walletRepo = ds.getRepository(Wallet);
  const txRepo = ds.getRepository(Transaction);
  const ledgerRepo = ds.getRepository(LedgerEntry);
  const providerRepo = ds.getRepository(GameProvider);
  const gameRepo = ds.getRepository(Game);
  const bonusRepo = ds.getRepository(Bonus);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@apexcasino.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  /** Default: 0918006053 → +251918006053 */
  const adminPhone = process.env.SEED_ADMIN_PHONE || '+251918006053';

  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    // Also try find by phone if re-seeding
    admin = await userRepo.findOne({ where: { phone: adminPhone } });
  }

  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email: adminEmail,
        phone: adminPhone,
        passwordHash: await argon2.hash(adminPassword),
        status: 'ACTIVE',
        isAdmin: true,
        adminRoles: ['SUPER_ADMIN'],
        emailVerifiedAt: new Date(),
        country: 'ET',
        dateOfBirth: '1990-01-01',
      }),
    );
    await profileRepo.save(
      profileRepo.create({
        userId: admin.id,
        firstName: 'Equb',
        lastName: 'Admin',
        language: 'am',
      }),
    );
    console.log('Admin created:', adminEmail, adminPhone);
  } else {
    admin.phone = adminPhone;
    admin.isAdmin = true;
    admin.adminRoles = admin.adminRoles?.length ? admin.adminRoles : ['SUPER_ADMIN'];
    admin.status = 'ACTIVE';
    await userRepo.save(admin);
    console.log('Admin updated:', adminEmail, admin.phone);
  }

  const playerEmail = process.env.SEED_PLAYER_EMAIL || 'demo@apexcasino.com';
  const playerPassword = process.env.SEED_PLAYER_PASSWORD || 'Demo123!';
  const playerPhone = process.env.SEED_PLAYER_PHONE || '+251922000000';

  let player = await userRepo.findOne({ where: { email: playerEmail } });
  if (!player) {
    player = await userRepo.save(
      userRepo.create({
        email: playerEmail,
        phone: playerPhone,
        passwordHash: await argon2.hash(playerPassword),
        status: 'ACTIVE',
        isAdmin: false,
        emailVerifiedAt: new Date(),
        country: 'ET',
        dateOfBirth: '1995-06-15',
      }),
    );
    await profileRepo.save(
      profileRepo.create({
        userId: player.id,
        firstName: 'Demo',
        lastName: 'Player',
        language: 'am',
      }),
    );
    console.log('Player created:', playerEmail, playerPhone);
  }

  const credits = parseInt(process.env.SEED_DEMO_CREDITS || '10000', 10);
  for (const u of [admin, player]) {
    let wallet = await walletRepo.findOne({ where: { userId: u.id, currency: 'DEMO' } });
    if (!wallet) {
      wallet = await walletRepo.save(
        walletRepo.create({
          userId: u.id,
          currency: 'DEMO',
          availableBalance: credits.toFixed(4),
          lockedBalance: '0',
          bonusBalance: '0',
          status: 'ACTIVE',
        }),
      );
      const tx = await txRepo.save(
        txRepo.create({
          userId: u.id,
          walletId: wallet.id,
          type: 'DEMO_CREDIT',
          amount: credits.toFixed(4),
          currency: 'DEMO',
          status: 'COMPLETED',
          idempotencyKey: `seed-${u.id}`,
          reference: 'Initial demo credits',
        }),
      );
      await ledgerRepo.save(
        ledgerRepo.create({
          walletId: wallet.id,
          transactionId: tx.id,
          entryType: 'CREDIT',
          amount: credits.toFixed(4),
          balanceAfter: credits.toFixed(4),
          description: 'Initial demo credits',
        }),
      );
      console.log(`Wallet seeded for ${u.email}`);
    }
  }

  let apexProvider = await providerRepo.findOne({ where: { slug: 'apex-studios' } });
  if (!apexProvider) {
    apexProvider = await providerRepo.save(
      providerRepo.create({ name: 'Apex Studios', slug: 'apex-studios', status: 'ACTIVE' }),
    );
  }

  const games = [
    {
      slug: 'neon-reels',
      name: 'Neon Reels',
      category: 'SLOTS' as const,
      isPopular: true,
      isNew: true,
      hasJackpot: false,
      minBet: '0.10',
      maxBet: '100',
    },
    {
      slug: 'fortune-spin',
      name: 'Fortune Spin',
      category: 'SLOTS' as const,
      isPopular: true,
      isNew: false,
      hasJackpot: true,
      minBet: '0.20',
      maxBet: '200',
    },
    {
      slug: 'royal-roulette',
      name: 'Royal Roulette',
      category: 'ROULETTE' as const,
      isPopular: true,
      isNew: false,
      hasJackpot: false,
      minBet: '1',
      maxBet: '500',
    },
    {
      slug: 'crash-nova',
      name: 'Crash Nova',
      category: 'CRASH' as const,
      isPopular: true,
      isNew: true,
      hasJackpot: false,
      minBet: '0.50',
      maxBet: '250',
    },
    {
      slug: 'vegas-blackjack',
      name: 'Vegas Blackjack',
      category: 'BLACKJACK' as const,
      isPopular: true,
      isNew: false,
      hasJackpot: false,
      minBet: '5',
      maxBet: '500',
    },
    {
      slug: 'point-baccarat',
      name: 'Point Baccarat',
      category: 'BACCARAT' as const,
      isPopular: false,
      isNew: true,
      hasJackpot: false,
      minBet: '10',
      maxBet: '1000',
    },
  ];

  for (const g of games) {
    if (!(await gameRepo.findOne({ where: { slug: g.slug } }))) {
      await gameRepo.save(
        gameRepo.create({
          ...g,
          providerId: apexProvider.id,
          status: 'ACTIVE',
          version: '1.0.0',
          configuration: {},
          playCount: 0,
        }),
      );
      console.log('Game seeded:', g.name);
    }
  }

  if (!(await bonusRepo.findOne({ where: { name: 'Welcome Demo Credits' } }))) {
    await bonusRepo.save(
      bonusRepo.create({
        name: 'Welcome Demo Credits',
        type: 'WELCOME_BONUS',
        value: '500',
        status: 'ACTIVE',
        wageringRequirement: '1',
        startAt: new Date(),
        endAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }),
    );
    console.log('Bonus seeded: Welcome Demo Credits');
  }

  console.log('');
  console.log('=== Seed complete ===');
  console.log('Admin login (app):');
  console.log('  Phone:     0918006053  (+251918006053)');
  console.log('  Password: ', adminPassword);
  console.log('  Email:    ', adminEmail);
  console.log('Demo player:');
  console.log('  Phone:    ', playerPhone);
  console.log('  Password: ', playerPassword);
  console.log('');

  await ds.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
