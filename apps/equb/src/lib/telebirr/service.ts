/**
 * Telebirr merchant adapter.
 * Endpoints are NOT invented. Paths come from the merchant's official docs via env.
 * Without credentials, verification returns unavailable — never a fake CONFIRMED.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { telebirrPublicConfig } from './config';

export type PaymentResult = {
  ok: boolean;
  checkoutUrl?: string;
  merchantOrderId: string;
  message: string;
};

export type PaymentStatus = {
  ok: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'UNAVAILABLE';
  amount?: number;
  currency?: string;
  providerTransactionId?: string;
  receiverPhone?: string;
  message: string;
};

export type VerificationResult = {
  verified: boolean;
  status: 'CONFIRMED' | 'FAILED' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';
  amount?: number;
  currency?: string;
  providerTransactionId?: string;
  message: string;
};

function baseUrl() {
  return (process.env.TELEBIRR_BASE_URL || '').replace(/\/$/, '');
}

export async function createPayment(params: {
  merchantOrderId: string;
  amount: number;
  title: string;
  notifyUrl: string;
  returnUrl: string;
}): Promise<PaymentResult> {
  if (!baseUrl() || !process.env.TELEBIRR_FABRIC_APP_ID) {
    return {
      ok: false,
      merchantOrderId: params.merchantOrderId,
      message:
        'Telebirr checkout is not configured. Send to the merchant number, then submit the transaction number for verification.',
    };
  }
  const path = process.env.TELEBIRR_CREATE_ORDER_PATH || '';
  if (!path) {
    return {
      ok: false,
      merchantOrderId: params.merchantOrderId,
      message: 'TELEBIRR_CREATE_ORDER_PATH is not set from merchant documentation.',
    };
  }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': process.env.TELEBIRR_FABRIC_APP_ID || '',
      },
      body: JSON.stringify({
        merchantAppId: process.env.TELEBIRR_MERCHANT_APP_ID,
        merchantCode: process.env.TELEBIRR_MERCHANT_CODE,
        merchOrderId: params.merchantOrderId,
        title: params.title,
        totalAmount: params.amount,
        currency: 'ETB',
        notifyUrl: params.notifyUrl,
        redirectUrl: params.returnUrl,
        timeoutExpress: process.env.TELEBIRR_TIMEOUT || '30m',
        shortCode: process.env.TELEBIRR_SHORT_CODE,
      }),
    });
    const json = await res.json().catch(() => ({}));
    const checkoutUrl = json?.checkoutUrl || json?.data?.checkoutUrl || json?.biz_content?.checkoutUrl;
    if (!res.ok || !checkoutUrl) {
      return {
        ok: false,
        merchantOrderId: params.merchantOrderId,
        message: 'Telebirr did not return a checkout URL.',
      };
    }
    return { ok: true, checkoutUrl, merchantOrderId: params.merchantOrderId, message: 'Checkout created' };
  } catch {
    return {
      ok: false,
      merchantOrderId: params.merchantOrderId,
      message: 'Telebirr is temporarily unavailable.',
    };
  }
}

export async function queryPayment(merchantOrderId: string): Promise<PaymentStatus> {
  if (!baseUrl() || !process.env.TELEBIRR_QUERY_ORDER_PATH) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      message: 'Telebirr verification is temporarily unavailable.',
    };
  }
  try {
    const res = await fetch(`${baseUrl()}${process.env.TELEBIRR_QUERY_ORDER_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': process.env.TELEBIRR_FABRIC_APP_ID || '',
      },
      body: JSON.stringify({ merchOrderId: merchantOrderId }),
    });
    const json = await res.json().catch(() => ({}));
    const raw = String(json?.tradeStatus || json?.status || json?.data?.tradeStatus || '').toUpperCase();
    const status =
      raw === 'SUCCESS' || raw === 'COMPLETED' || raw === 'PAY_SUCCESS'
        ? 'SUCCESS'
        : raw === 'FAILED' || raw === 'CLOSED'
          ? 'FAILED'
          : 'PENDING';
    return {
      ok: res.ok,
      status,
      amount: Number(json?.totalAmount ?? json?.data?.totalAmount),
      currency: json?.currency || 'ETB',
      providerTransactionId: json?.transId || json?.data?.transId,
      receiverPhone: json?.receiveAccount || telebirrPublicConfig().merchantPhone,
      message: res.ok ? 'Queried' : 'Query failed',
    };
  } catch {
    return { ok: false, status: 'UNAVAILABLE', message: 'Telebirr verification is temporarily unavailable.' };
  }
}

export async function verifyPayment(params: {
  merchantOrderId: string;
  transactionNumber: string;
  expectedAmount: number;
}): Promise<VerificationResult> {
  const queried = await queryPayment(params.merchantOrderId);
  if (queried.status === 'UNAVAILABLE') {
    return { verified: false, status: 'UNAVAILABLE', message: 'Telebirr verification is temporarily unavailable.' };
  }
  if (queried.status !== 'SUCCESS') {
    return {
      verified: false,
      status: queried.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
      message: queried.status === 'FAILED' ? 'Verification failed.' : 'Payment verification is in progress.',
    };
  }
  const cfg = telebirrPublicConfig();
  if (queried.currency && queried.currency !== 'ETB') {
    return { verified: false, status: 'REVIEW_REQUIRED', message: 'Currency is not ETB.' };
  }
  if (queried.amount == null || Math.round(queried.amount * 100) !== Math.round(params.expectedAmount * 100)) {
    return { verified: false, status: 'REVIEW_REQUIRED', amount: queried.amount, message: 'The verified payment amount does not match the deposit amount.' };
  }
  if (queried.receiverPhone && queried.receiverPhone.replace(/\D/g, '').slice(-9) !== cfg.merchantPhone.replace(/\D/g, '').slice(-9)) {
    return { verified: false, status: 'REVIEW_REQUIRED', message: 'Receiver does not match merchant account.' };
  }
  return {
    verified: true,
    status: 'CONFIRMED',
    amount: queried.amount,
    currency: 'ETB',
    providerTransactionId: queried.providerTransactionId || params.transactionNumber,
    message: 'Verified',
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TELEBIRR_WEBHOOK_SECRET || '';
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
