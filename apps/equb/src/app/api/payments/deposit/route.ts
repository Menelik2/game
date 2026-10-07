import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isRealMoneyLive, paymentPublicConfig } from '@/lib/payments/config';
import { chapaInitialize } from '@/lib/payments/chapa';
import { saveTx } from '@/lib/payments/store';
import type { PaymentTransaction } from '@/lib/payments/types';
import { isDbConfigured, dbGetUser } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cfg = paymentPublicConfig();
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '');
  const amount = Number(body.amount);
  const returnUrl = String(body.returnUrl || '');
  const phone = String(body.phone || '');
  const name = String(body.name || 'Player');

  if (!userId) {
    return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < cfg.minDeposit) {
    return NextResponse.json(
      { success: false, message: `Minimum deposit ${cfg.minDeposit} ${cfg.currency}` },
      { status: 400 },
    );
  }
  if (amount > cfg.maxDeposit) {
    return NextResponse.json(
      { success: false, message: `Maximum deposit ${cfg.maxDeposit} ${cfg.currency}` },
      { status: 400 },
    );
  }

  if (!isRealMoneyLive()) {
    return NextResponse.json(
      {
        success: false,
        code: 'REAL_MONEY_DISABLED',
        message:
          'Real-money deposits require REAL_MONEY_ENABLED=true and TELEBIRR_MERCHANT_PHONE (or VERIFY_ET_API_KEY). Use Wallet → Telebirr transaction number to deposit.',
        data: cfg,
      },
      { status: 403 },
    );
  }

  if (isDbConfigured()) {
    const u = await dbGetUser(userId);
    if (!u) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
  }

  // Prefer Telebirr txn-claim flow over Chapa when provider is telebirr
  if (cfg.provider === 'telebirr') {
    return NextResponse.json({
      success: true,
      data: {
        provider: 'telebirr',
        status: 'USE_TXN_CLAIM',
        message:
          'Send Telebirr to merchant, then claim with transaction number on Wallet page.',
        minDeposit: cfg.minDeposit,
        maxDeposit: cfg.maxDeposit,
        currency: cfg.currency,
      },
    });
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';
  const txRef = `equb_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const id = randomUUID();

  try {
    const init = await chapaInitialize({
      amount,
      currency: cfg.currency,
      email: `${userId.replace(/-/g, '')}@equb.player`,
      firstName: name.slice(0, 40) || 'Player',
      phone: phone || undefined,
      txRef,
      callbackUrl: `${origin}/api/payments/webhook/chapa`,
      returnUrl: returnUrl || `${origin}/wallet?deposit=return`,
    });

    const record: PaymentTransaction = {
      id,
      userId,
      provider: 'chapa',
      providerRef: txRef,
      amount,
      currency: cfg.currency,
      status: 'PENDING',
      direction: 'deposit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { checkoutUrl: init.checkoutUrl },
    };
    saveTx(record);

    return NextResponse.json({
      success: true,
      data: {
        transactionId: id,
        providerRef: txRef,
        status: 'PENDING',
        redirectUrl: init.checkoutUrl,
        message:
          'Redirect user to checkout. Wallet credits only after provider confirms.',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Payment init failed' },
      { status: 502 },
    );
  }
}
