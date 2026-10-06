import { randomUUID } from 'crypto';
import { verifyEtConfig } from './config';

export type VerifyEtResult = {
  verified: boolean;
  status: 'CONFIRMED' | 'FAILED' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';
  message: string;
  amount?: number;
  currency?: string;
  providerTransactionId?: string;
  receiverName?: string;
  senderName?: string;
  requestId?: string;
  settlementMatched?: boolean;
};

function backendBase(): string {
  return (
    process.env.VERIFY_ET_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://game-rho-eight-15.vercel.app'
  ).replace(/\/$/, '');
}

/** Prefer local key; otherwise call backend where VERIFY_ET_API_KEY is set. */
async function verifyViaBackend(input: {
  transactionNumber: string;
  expectedAmount: number;
}): Promise<VerifyEtResult> {
  try {
    const res = await fetch(`${backendBase()}/api/verify-et/telebirr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionNumber: input.transactionNumber,
        expectedAmount: input.expectedAmount,
      }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      verified: Boolean(json.verified || json.success),
      status: (json.status as VerifyEtResult['status']) || (res.ok ? 'CONFIRMED' : 'FAILED'),
      message: String(json.message || 'Backend verify response'),
      amount: json.amount != null ? Number(json.amount) : undefined,
      currency: json.currency,
      providerTransactionId: json.providerTransactionId,
      requestId: json.requestId,
    };
  } catch (e: any) {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message: e?.message || 'Could not reach backend Verify.ET proxy.',
    };
  }
}

/**
 * Submit Telebirr receipt check to Verify.ET.
 * Docs: https://verify.et/docs/api — POST /api/verify
 * Falls back to backend API (game-rho-eight-15) if local key is missing.
 */
export async function verifyTelebirrWithVerifyEt(input: {
  transactionNumber: string;
  expectedAmount: number;
}): Promise<VerifyEtResult> {
  const cfg = verifyEtConfig();
  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return { verified: false, status: 'FAILED', message: 'Enter a valid Telebirr transaction number.' };
  }

  // No local key → use backend where you added VERIFY_ET_API_KEY
  if (!cfg.configured) {
    return verifyViaBackend(input);
  }

  const body = {
    bank: 'telebirr' as const,
    transactionNumber: txn,
    settlementAccount: cfg.settlementAccount,
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/api/verify?waitMs=8000`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'Idempotency-Key': `equb-${txn}-${Math.round(input.expectedAmount * 100)}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    const item = Array.isArray(json?.data) ? json.data[0] : json?.data || json?.verification || json;
    const requestId = json?.requestId || item?.requestId;

    if (res.status === 202 || item?.processingStatus === 'queued' || item?.status === 'pending') {
      return {
        verified: false,
        status: 'PROCESSING',
        message: 'Verification is in progress. Wait a few seconds and try again.',
        requestId,
      };
    }

    if (!res.ok) {
      // Bad local key → try backend once
      if (res.status === 401 || res.status === 403) {
        const viaBackend = await verifyViaBackend(input);
        if (viaBackend.status !== 'UNAVAILABLE') return viaBackend;
      }
      const msg =
        json?.message ||
        json?.error?.message ||
        (res.status === 401 || res.status === 403
          ? 'Verify.ET rejected the API key.'
          : `Verify.ET error (${res.status})`);
      return { verified: false, status: 'FAILED', message: String(msg), requestId };
    }

    const verified = Boolean(
      item?.verified === true ||
        item?.status === 'success' ||
        (json?.success === true && item?.verified !== false && item?.status !== 'failed'),
    );
    const amount = Number(item?.amount ?? item?.settledAmount ?? item?.paidAmount);
    const currency = String(item?.currency || 'ETB').toUpperCase();
    const settlement = item?.settlementAccountMatch;
    const settlementMatched =
      settlement == null ? true : Boolean(settlement.matched) && !Boolean(settlement.ambiguous);

    if (!verified) {
      return {
        verified: false,
        status: 'FAILED',
        message: json?.message || item?.reason || 'Transaction could not be verified.',
        amount: Number.isFinite(amount) ? amount : undefined,
        requestId,
        settlementMatched,
      };
    }

    if (currency !== 'ETB') {
      return { verified: false, status: 'REVIEW_REQUIRED', message: 'Currency is not ETB.', requestId };
    }

    if (Number.isFinite(amount) && Math.round(amount * 100) !== Math.round(input.expectedAmount * 100)) {
      return {
        verified: false,
        status: 'REVIEW_REQUIRED',
        message: `Amount mismatch: paid ${amount} ETB, expected ${input.expectedAmount} ETB.`,
        amount,
        requestId,
      };
    }

    if (settlement && !settlementMatched) {
      return {
        verified: false,
        status: 'REVIEW_REQUIRED',
        message: 'Payment was not sent to the merchant Telebirr number. Admin review required.',
        amount: Number.isFinite(amount) ? amount : input.expectedAmount,
        requestId,
        settlementMatched: false,
      };
    }

    return {
      verified: true,
      status: 'CONFIRMED',
      message: 'Transaction verified with Verify.ET.',
      amount: Number.isFinite(amount) ? amount : input.expectedAmount,
      currency: 'ETB',
      providerTransactionId: String(item?.referenceNumber || item?.transactionNumber || txn),
      receiverName: item?.receiverName,
      senderName: item?.senderName,
      requestId,
      settlementMatched: true,
    };
  } catch (e: any) {
    const viaBackend = await verifyViaBackend(input);
    if (viaBackend.status !== 'UNAVAILABLE') return viaBackend;
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message: e?.message || 'Could not reach Verify.ET. Try again shortly.',
    };
  }
}

export function createVerifyIdempotencyKey(prefix = 'equb') {
  return `${prefix}-${randomUUID()}`;
}
