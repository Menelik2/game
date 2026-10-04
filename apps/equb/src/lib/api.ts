/** Nest API client — real users in Postgres */

export function getApiBase(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '';
  return raw.replace(/\/$/, '');
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

type AuthResult = {
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

function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as Record<string, unknown>;
  const msg =
    (b.message as string) ||
    (b.error as string) ||
    ((b.data as { message?: string })?.message);
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg) return msg;
  return fallback;
}

export async function apiRegister(input: {
  fullName: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const base = getApiBase();
  if (!base) {
    throw new Error('API አልተገናኘም — NEXT_PUBLIC_API_URL ያዘጋጁ');
  }

  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      fullName: input.fullName,
      phone: input.phone,
      password: input.password,
      country: 'ET',
      acceptTerms: true,
      acceptAge: true,
    }),
  });

  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'መመዝገብ አልተሳካም'));
  }
  return unwrapData<AuthResult>(body);
}

export async function apiLogin(input: {
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const base = getApiBase();
  if (!base) {
    throw new Error('API አልተገናኘም — NEXT_PUBLIC_API_URL ያዘጋጁ');
  }

  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      phone: input.phone,
      password: input.password,
    }),
  });

  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'ግባት አልተሳካም'));
  }
  return unwrapData<AuthResult>(body);
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
      ((data?.wallets as { balance?: number }[])?.[0]?.balance);
    return typeof bal === 'number' ? bal : null;
  } catch {
    return null;
  }
}
