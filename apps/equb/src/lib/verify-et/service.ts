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

type VerifyPayload = {
  bank: 'telebirr';
  transactionNumber: string;
  settlementAccount?: string;
  expectedAmount?: number;
};

/**
 * Submit Telebirr receipt check to Verify.ET.
 * Docs: https://verify.et/docs/api — POST /api/verify
 * Public UI: https://verify.et/verify
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

  if (!cfg.configured) {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message:
        'Verify.ET is not configured yet. Set VERIFY_ET_API_KEY in Vercel, then redeploy. Until then deposits stay pending for admin review.',
    };
  }

  const body: VerifyPayload = {
    bank: 'telebirr',
    transactionNumber: txn,
    settlementAccount: cfg.settlementAccount,
    expectedAmount: input.expectedAmount,
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
      const msg =
        json?.message ||
        json?.error?.message ||
        (res.status === 401 || res.status === 403
          ? 'Verify.ET API key rejected. Check VERIFY_ET_API_KEY.'
          : `Verify.ET error (${res.status})`);
      return { verified: false, status: 'FAILED', message: String(msg), requestId };
    }

    const verified = Boolean(item?.verified || item?.status === 'success' || json?.success && item?.verified !== false);
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
