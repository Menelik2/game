export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'PENDING_VERIFICATION';
export type WalletStatus = 'ACTIVE' | 'LOCKED' | 'CLOSED';
export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'BET'
  | 'WIN'
  | 'BONUS'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'FEE'
  | 'DEMO_CREDIT';
export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';
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

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
