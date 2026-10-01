/** Offline lobby catalog when API is down */
export type DemoGame = {
  id: string;
  slug: string;
  name: string;
  category: string;
  minBet: number;
  maxBet: number;
  description?: string;
};

export const DEMO_GAMES: DemoGame[] = [
  {
    id: 'demo-fast-keno',
    slug: 'fast-keno',
    name: 'Fast Keno',
    category: 'KENO',
    minBet: 0.2,
    maxBet: 100,
    description: 'Pick 1–10 from 1–80 · draw 20 · paytable by hits',
  },
  {
    id: 'demo-neon-slots',
    slug: 'neon-slots',
    name: 'Neon Slots',
    category: 'SLOTS',
    minBet: 0.2,
    maxBet: 50,
  },
  {
    id: 'demo-roulette',
    slug: 'european-roulette',
    name: 'European Roulette',
    category: 'ROULETTE',
    minBet: 0.5,
    maxBet: 100,
  },
];

export function getDemoGameBySlug(slug: string) {
  return DEMO_GAMES.find((g) => g.slug === slug) || null;
}
