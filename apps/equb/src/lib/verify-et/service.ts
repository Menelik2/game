/**
 * Verify.ET client — https://verify.et/docs/api
 *
 * Base: https://verify.et
 * Auth: x-api-key header
 * Telebirr body:
 *   { bank: "telebirr", transactionNumber, settlementAccount? }
 * Optional waitMs query → 200 when done, 202 + statusUrl when queued
 * Poll: GET /api/verify/:requestId
 */

import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
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
  bank?: string;
};

type VerifyItem = {
  requestId?: string;
  bank?: string;
  status?: string;
  verified?: boolean;
  amount?: number | string;
  currency?: string;
  senderName?: string;
  receiverName?: string;
  receiverAccount?: string;
  referenceNumber?: string;
  transactionNumber?: string;
  receiptNumber?: string;
  timestamp?: string;
  processingStatus?: string;
  settlementAccountMatch?: {
    matched?: boolean;
    ambiguous?: boolean;
    reason?: string;
  };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseItem(json: Record<string, unknown>): VerifyItem | null {
  const data = json?.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    return data[0] as VerifyItem;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as VerifyItem;
  }
  const verification = json?.verification;
  if (verification && typeof verification === 'object') {
    return verification as VerifyItem;
  }
  return null;
}

function mapCompleted(item: VerifyItem, expectedAmount: number): VerifyEtResult {
  const requestId = item.requestId;
  const verified = Boolean(
    item.verified === true || item.status === 'success',
  );
  const amount = Number(item.amount);
  const currency = String(item.currency || 'ETB').toUpperCase();
  const match = item.settlementAccountMatch;
  const settlementMatched =
    match == null
      ? true
      : Boolean(match.matched) && !Boolean(match.ambiguous);

  if (!verified) {
    return {
      verified: false,
      status: 'FAILED',
      message: 'Transaction could not be verified with Verify.ET.',
      amount: Number.isFinite(amount) ? amount : undefined,
      settlementMatched,
      bank: item.bank,
      requestId,
    };
  }

  if (currency !== 'ETB') {
    return {
      verified: false,
      status: 'REVIEW_REQUIRED',
      message: 'Currency is not ETB.',
      bank: item.bank,
      requestId,
    };
  }

  if (
    expectedAmount > 0 &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) !== Math.round(expectedAmount * 100)
  ) {
    return {
      verified: false,
      status: 'REVIEW_REQUIRED',
      message: `Amount mismatch: paid ${amount} ETB, expected ${expectedAmount} ETB.`,
      amount,
      bank: item.bank,
      requestId,
    };
  }

  if (match && !settlementMatched) {
    return {
      verified: false,
      status: 'REVIEW_REQUIRED',
      message:
        match.reason === 'no_registered_accounts'
          ? 'Settlement account not matched. Register merchant phone on Verify.ET or set TELEBIRR_MERCHANT_PHONE.'
          : 'Payment was not sent to the merchant Telebirr number. Admin review required.',
      amount: Number.isFinite(amount) ? amount : expectedAmount || undefined,
      settlementMatched: false,
      bank: item.bank,
      requestId,
    };
  }

  return {
    verified: true,
    status: 'CONFIRMED',
    message: 'Transaction verified with Verify.ET.',
    amount: Number.isFinite(amount)
      ? amount
      : expectedAmount > 0
        ? expectedAmount
        : undefined,
    currency: 'ETB',
    providerTransactionId: String(
      item.referenceNumber ||
        item.transactionNumber ||
        item.receiptNumber ||
        '',
    ),
    receiverName: item.receiverName,
    senderName: item.senderName,
    settlementMatched: true,
    bank: item.bank || 'telebirr',
    requestId,
  };
}

async function pollStatus(
  baseUrl: string,
  apiKey: string,
  requestId: string,
  expectedAmount: number,
  attempts = 6,
): Promise<VerifyEtResult> {
  for (let i = 0; i < attempts; i++) {
    await sleep(1500);
    try {
      const res = await fetch(`${baseUrl}/api/verify/${requestId}`, {
        headers: { 'x-api-key': apiKey },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const item = parseItem(json);
      const processing =
        (item?.processingStatus ||
          (json.verification as VerifyItem | undefined)?.processingStatus) ||
        '';

      if (
        processing === 'completed' ||
        item?.verified === true ||
        item?.status === 'success' ||
        item?.status === 'failed'
      ) {
        if (!item) {
          return {
            verified: false,
            status: 'FAILED',
            message: 'Empty Verify.ET status response.',
            requestId,
          };
        }
        const mapped = mapCompleted(item, expectedAmount);
        mapped.requestId = requestId;
        return mapped;
      }
    } catch {
      /* retry */
    }
  }
  return {
    verified: false,
    status: 'PROCESSING',
    message: 'Verification still running. Try again in a few seconds.',
    requestId,
  };
}

/**
 * Submit Telebirr receipt to Verify.ET (official contract).
 * Docs: https://verify.et/docs/api
 */
export async function verifyTelebirrWithVerifyEt(input: {
  transactionNumber: string;
  expectedAmount: number;
}): Promise<VerifyEtResult> {
  const cfg = verifyEtConfig();
  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return {
      verified: false,
      status: 'FAILED',
      message: 'Enter a valid Telebirr transaction number.',
    };
  }

  if (!cfg.configured) {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message:
        'VERIFY_ET_API_KEY is not set. Deposits stay in admin review until the key is configured on Vercel.',
    };
  }

  // Official Telebirr body + settlement account matching
  const body: Record<string, string> = {
    bank: 'telebirr',
    transactionNumber: txn,
  };
  if (cfg.settlementAccount) {
    body.settlementAccount = cfg.settlementAccount;
  }

  const idempotencyKey = `equb-telebirr-${txn}-${Math.round(input.expectedAmount * 100)}`.slice(
    0,
    255,
  );

  try {
    // waitMs: API waits briefly; returns 200 if done, else 202 + statusUrl
    const res = await fetch(`${cfg.baseUrl}/api/verify?waitMs=8000`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const requestId = String(
      json.requestId ||
        (json.verification as VerifyItem | undefined)?.requestId ||
        '',
    );
    const item = parseItem(json);

    // 202 Queued or still pending
    if (
      res.status === 202 ||
      item?.processingStatus === 'queued' ||
      item?.processingStatus === 'running' ||
      item?.status === 'pending'
    ) {
      if (requestId) {
        return pollStatus(
          cfg.baseUrl,
          cfg.apiKey,
          requestId,
          input.expectedAmount,
        );
      }
      return {
        verified: false,
        status: 'PROCESSING',
        message: 'Verification is in progress. Wait a few seconds and try again.',
        requestId: requestId || undefined,
      };
    }

    if (!res.ok) {
      const err = json.error as { code?: string; message?: string } | undefined;
      const msg =
        (typeof json.message === 'string' && json.message) ||
        err?.message ||
        (res.status === 401
          ? 'Invalid Verify.ET API key (401).'
          : res.status === 403
            ? 'Permission denied: verification:write required (403).'
            : res.status === 402
              ? 'Verify.ET credits exhausted (402).'
              : res.status === 429
                ? 'Verify.ET rate limit — retry later (429).'
                : `Verify.ET error (${res.status})`);
      return {
        verified: false,
        status: 'FAILED',
        message: String(msg),
        requestId: requestId || undefined,
      };
    }

    if (!item) {
      return {
        verified: false,
        status: 'FAILED',
        message: 'Empty Verify.ET response.',
        requestId: requestId || undefined,
      };
    }

    const mapped = mapCompleted(item, input.expectedAmount);
    mapped.requestId = requestId || mapped.requestId;
    return mapped;
  } catch (e: unknown) {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message:
        e instanceof Error
          ? e.message
          : 'Could not reach Verify.ET. Try again shortly.',
    };
  }
}

/** Validate dashboard webhook signature: X-Webhook-Signature: sha256=<hex> */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  timestamp?: string | null,
): boolean {
  if (!secret) return true; // not configured → accept (dev)
  if (!signatureHeader) return false;
  try {
    // Header may list one or two sha256= values during secret rotation
    const candidates = signatureHeader
      .split(/[\s,]+/)
      .map((p) => p.replace(/^sha256=/i, '').trim())
      .filter(Boolean);

    // Docs: sign timestamp + period + raw body with HMAC-SHA256
    const payloads = timestamp
      ? [`${timestamp}.${rawBody}`, rawBody]
      : [rawBody];

    for (const payload of payloads) {
      const expected = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      const a = Buffer.from(expected);
      for (const c of candidates) {
        const b = Buffer.from(c);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function createVerifyRequestId() {
  return randomUUID();
}
