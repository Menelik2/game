/** Offline/demo catalog when API is unreachable or DB not seeded */
export type DemoGame = {
  id: string;
  slug: string;
  name: string;
  category: string;
  thumbnail?: string | null;
  isNew?: boolean;
  isPopular?: boolean;
  hasJackpot?: boolean;
  minBet?: number;
  maxBet?: number;
  description?: string;
  provider?: { name: string } | null;
};

export const DEMO_GAMES: DemoGame[] = [
  {
    id: 'demo-neon-reels',
    slug: 'neon-reels',
    name: 'Neon Reels',
    category: 'SLOTS',
    isPopular: true,
    isNew: true,
    minBet: 0.2,
    maxBet: 50,
    description: '5-reel neon slot with wilds and scatters',
    provider: { name: 'Apex Studios' },
  },
  {
    id: 'demo-golden-scarab',
    slug: 'golden-scarab',
    name: 'Golden Scarab',
    category: 'SLOTS',
    isPopular: true,
    hasJackpot: true,
    minBet: 0.5,
    maxBet: 100,
    description: 'Egyptian-themed progressive-style slot (demo jackpot)',
    provider: { name: 'Apex Studios' },
  },
  {
    id: 'demo-crystal-cascade',
    slug: 'crystal-cascade',
    name: 'Crystal Cascade',
    category: 'SLOTS',
    isNew: true,
    minBet: 0.1,
    maxBet: 25,
    description: 'Cascading symbols and free-spin style features',
    provider: { name: 'Apex Studios' },
  },
  {
    id: 'demo-midnight-roulette',
    slug: 'midnight-roulette',
    name: 'Midnight Roulette',
    category: 'ROULETTE',
    isPopular: true,
    minBet: 1,
    maxBet: 500,
    description: 'European roulette — single zero',
    provider: { name: 'Apex Tables' },
  },
  {
    id: 'demo-apex-blackjack',
    slug: 'apex-blackjack',
    name: 'Apex Blackjack',
    category: 'BLACKJACK',
    isPopular: true,
    minBet: 1,
    maxBet: 200,
    description: 'Classic blackjack — 3:2 natural',
    provider: { name: 'Apex Tables' },
  },
  {
    id: 'demo-royal-baccarat',
    slug: 'royal-baccarat',
    name: 'Royal Baccarat',
    category: 'BACCARAT',
    minBet: 5,
    maxBet: 500,
    description: 'Player, banker, or tie',
    provider: { name: 'Apex Tables' },
  },
  {
    id: 'demo-velocity-crash',
    slug: 'velocity-crash',
    name: 'Velocity Crash',
    category: 'CRASH',
    isPopular: true,
    isNew: true,
    minBet: 0.5,
    maxBet: 100,
    description: 'Cash out before the multiplier crashes',
    provider: { name: 'Apex Live' },
  },
  {
    id: 'demo-lucky-stars',
    slug: 'lucky-stars',
    name: 'Lucky Stars',
    category: 'SLOTS',
    isPopular: true,
    minBet: 0.2,
    maxBet: 40,
    description: 'Star-packed paylines and bonus rounds',
    provider: { name: 'Apex Studios' },
  },
  {
    id: 'demo-fortune-wheel',
    slug: 'fortune-wheel',
    name: 'Fortune Wheel',
    category: 'SLOTS',
    hasJackpot: true,
    minBet: 1,
    maxBet: 75,
    description: 'Wheel bonus meets classic reels',
    provider: { name: 'Apex Studios' },
  },
  {
    id: 'demo-high-roller-bj',
    slug: 'high-roller-blackjack',
    name: 'High Roller Blackjack',
    category: 'BLACKJACK',
    isNew: true,
    minBet: 10,
    maxBet: 1000,
    description: 'Higher limits for the big seats',
    provider: { name: 'Apex Tables' },
  },
  {
    id: 'demo-lightning-crash',
    slug: 'lightning-crash',
    name: 'Lightning Crash',
    category: 'CRASH',
    minBet: 0.1,
    maxBet: 50,
    description: 'Fast rounds, sharp multipliers',
    provider: { name: 'Apex Live' },
  },
  {
    id: 'demo-diamond-roulette',
    slug: 'diamond-roulette',
    name: 'Diamond Roulette',
    category: 'ROULETTE',
    isNew: true,
    minBet: 0.5,
    maxBet: 250,
    description: 'Sleek European wheel experience',
    provider: { name: 'Apex Tables' },
  },
];

export function filterDemoGames(opts: {
  category?: string;
  search?: string;
  popular?: boolean;
  limit?: number;
}): DemoGame[] {
  let list = [...DEMO_GAMES];
  const cat = opts.category?.toUpperCase();
  if (cat && cat !== 'ALL') {
    if (cat === 'POPULAR') list = list.filter((g) => g.isPopular);
    else if (cat === 'NEW') list = list.filter((g) => g.isNew);
    else if (cat === 'JACKPOT') list = list.filter((g) => g.hasJackpot);
    else list = list.filter((g) => g.category === cat);
  }
  if (opts.popular) list = list.filter((g) => g.isPopular);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter(
      (g) => g.name.toLowerCase().includes(q) || g.slug.includes(q),
    );
  }
  return list.slice(0, opts.limit ?? 48);
}

export function getDemoGameBySlug(slug: string): DemoGame | undefined {
  return DEMO_GAMES.find((g) => g.slug === slug);
}
