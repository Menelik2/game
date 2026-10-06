import { resolveBalance } from './deposits';
import { publicWalletConfig } from '@/lib/verify-et/config';

export { publicWalletConfig };

export async function walletOfAsync(userId: string) {
  const balance = await resolveBalance(userId);
  return { userId, balance, currency: 'ETB' as const };
}
