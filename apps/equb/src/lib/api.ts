/** Nest API client — real users in Postgres */

export function getApiBase(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '';
  return String(raw).trim().replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return Boolean(getApiBase());
}

export type ApiUser = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  status?: string;
  country?: string | null;
};

export type AuthResult = {
  user: ApiUser;
  accessToken: string;
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || res.statusText };
  }
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Nest AllExceptionsFilter: { success:false, error:{ code, message } } */
function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as Record<string, unknown>;

  const nested = b.error;
  if (nested && typeof nested === 'object') {
    const e = nested as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message) return e.message;
    if (Array.isArray(e.message)) return (e.message as string[]).join(', ');
    if (typeof e.details === 'string') return e.details;
    if (Array.isArray(e.details)) return (e.details as string[]).join(', ');
  }

  if (typeof b.message === 'string' && b.message) return b.message;
  if (Array.isArray(b.message)) return (b.message as string[]).join(', ');
  if (typeof b.error === 'string' && b.error) return b.error;

  return fallback;
}

export async function apiRegister(input: {
  fullName: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const base = getApiBase();
  if (!base) {
    throw new Error('API_NOT_CONFIGURED');
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        password: input.password,
        country: 'ET',
        acceptTerms: true,
        acceptAge: true,
      }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'መመዝገብ አልተሳካም'));
  }
  const data = unwrapData<AuthResult>(body);
  if (!data?.user?.id) {
    throw new Error('መለያ ተፈጥሯል ግን ምላሽ ትክክል አይደለም');
  }
  return data;
}

export async function apiLogin(input: {
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const base = getApiBase();
  if (!base) {
    throw new Error('API_NOT_CONFIGURED');
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phone: input.phone.trim(),
        password: input.password,
      }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'ግባት አልተሳካም'));
  }
  const data = unwrapData<AuthResult>(body);
  if (!data?.user?.id) {
    throw new Error('ግባት ተሳክቷል ግን ምላሽ ትክክል አይደለም');
  }
  return data;
}

export async function apiWalletBalance(accessToken: string): Promise<number | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/wallet`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = await parseJson(res);
    const data = unwrapData<Record<string, unknown>>(body);
    const bal =
      (data?.balance as number) ??
      (data?.available as number) ??
      (typeof data?.availableBalance === 'string'
        ? parseFloat(data.availableBalance as string)
        : null) ??
      ((data?.wallets as { balance?: number; availableBalance?: string }[])?.[0]
        ?.balance);
    return typeof bal === 'number' && !Number.isNaN(bal) ? bal : null;
  } catch {
    return null;
  }
}
