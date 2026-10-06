/**
 * Vercel serverless — Equb + wallet + admin audit + Verify.ET (Telebirr)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';

const ROUND_MS = 60_000;
const START = 5000;

type Member = { playerId: string; name: string; pick: number; joinedAt: number };
type Room = {
  id: string; templateId: string; groupSize: number; prizePool: number;
  contribution: number; tier: string; status: 'open' | 'drawing' | 'completed';
  members: Member[]; winningNumber: number | null; winnerId: string | null;
  entropyHex: string | null; commitmentHash: string | null;
  drawAt: number; secondsLeft: number; createdAt: number; updatedAt: number;
};
type Wallet = { playerId: string; balance: number; updatedAt: number; version: number };
type Audit = { id: string; action: string; userId?: string; metadata?: object; at: number };

const g = globalThis as any;
if (!g.__r) g.__r = new Map();
if (!g.__w) g.__w = new Map();
if (!g.__a) g.__a = [];
const rooms: Map<string, Room> = g.__r;
const wallets: Map<string, Wallet> = g.__w;
const audits: Audit[] = g.__a;

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function verifyEtConfig() {
  const apiKey = firstEnv(
    'VERIFY_ET_API_KEY',
    'VERIFY_BANK_ET_API_KEY',
    'VERIFY_ET_KEY',
    'VERIFYET_API_KEY',
    'VERIFY_API_KEY',
  );
  const baseUrl = (firstEnv('VERIFY_ET_BASE_URL') || 'https://verify.et').replace(/\/$/, '');
  const settlementAccount =
    firstEnv('TELEBIRR_MERCHANT_PHONE', 'WALLET_MERCHANT_PHONE') || '0977832379';
  const merchantName =
    firstEnv('TELEBIRR_MERCHANT_NAME', 'WALLET_MERCHANT_NAME') || 'Menelik';
  return {
    apiKey,
    baseUrl,
    settlementAccount,
    merchantName,
    configured: apiKey.length > 8,
    keyHint: apiKey ? `${apiKey.slice(0, 8)}…(${apiKey.length} chars)` : null,
  };
}

/** Server-side Telebirr check via Verify.ET official API */
async function verifyTelebirr(input: {
  transactionNumber: string;
  expectedAmount: number;
}) {
  const cfg = verifyEtConfig();
  const txn = String(input.transactionNumber || '').trim();
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
        'VERIFY_ET_API_KEY is missing on the backend. Add it on game-rho-eight-15.vercel.app → Settings → Environment Variables, then Redeploy.',
    };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/api/verify?waitMs=8000`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'Idempotency-Key': `api-${txn}-${Math.round(input.expectedAmount * 100)}`,
      },
      body: JSON.stringify({
        bank: 'telebirr',
        transactionNumber: txn,
        settlementAccount: cfg.settlementAccount,
      }),
    });
    const json = await res.json().catch(() => ({}));
    const item = Array.isArray(json?.data)
      ? json.data[0]
      : json?.data || json?.verification || json;
    const requestId = json?.requestId || item?.requestId;

    if (
      res.status === 202 ||
      item?.processingStatus === 'queued' ||
      item?.status === 'pending'
    ) {
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

    if (!verified) {
      return {
        verified: false,
        status: 'FAILED',
        message: json?.message || item?.reason || 'Transaction could not be verified.',
        amount: Number.isFinite(amount) ? amount : undefined,
        requestId,
      };
    }
    if (currency !== 'ETB') {
      return {
        verified: false,
        status: 'REVIEW_REQUIRED',
        message: 'Currency is not ETB.',
        requestId,
      };
    }
    if (
      Number.isFinite(amount) &&
      Math.round(amount * 100) !== Math.round(input.expectedAmount * 100)
    ) {
      return {
        verified: false,
        status: 'REVIEW_REQUIRED',
        message: `Amount mismatch: paid ${amount} ETB, expected ${input.expectedAmount} ETB.`,
        amount,
        requestId,
      };
    }
    return {
      verified: true,
      status: 'CONFIRMED',
      message: 'Transaction verified with Verify.ET.',
      amount: Number.isFinite(amount) ? amount : input.expectedAmount,
      currency: 'ETB',
      providerTransactionId: String(
        item?.referenceNumber || item?.transactionNumber || txn,
      ),
      requestId,
    };
  } catch (e: any) {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      message: e?.message || 'Could not reach Verify.ET.',
    };
  }
}

function contrib(p: number, s: number) { return Math.round((p / s) * 100) / 100; }
function rnd(n: number) {
  const lim = Math.floor(0x100000000 / n) * n;
  for (;;) { const x = randomBytes(4).readUInt32BE(0); if (x < lim) return x % n; }
}
function draw(gs: number) {
  const e = randomBytes(32).toString('hex');
  const w = rnd(gs) + 1;
  const c = createHash('sha256').update(`${e}:${gs}:${w}`).digest('hex');
  return { winningNumber: w, entropyHex: e, commitmentHash: c };
}
function audit(action: string, userId?: string, metadata?: object) {
  audits.unshift({ id: `a_${Date.now().toString(36)}`, action, userId, metadata, at: Date.now() });
  if (audits.length > 200) audits.length = 200;
}
function wallet(id: string): Wallet {
  let w = wallets.get(id);
  if (!w) { w = { playerId: id, balance: START, updatedAt: Date.now(), version: 1 }; wallets.set(id, w); }
  return w;
}
function delta(id: string, d: number, reason: string): Wallet {
  const w = wallet(id);
  w.balance = Math.max(0, Math.round((w.balance + d) * 100) / 100);
  w.updatedAt = Date.now(); w.version++;
  audit(d < 0 ? 'wallet.debit' : 'wallet.credit', id, { d, reason, balance: w.balance });
  return { ...w };
}
function timer(r: Room): Room {
  return { ...r, secondsLeft: Math.max(0, Math.ceil((r.drawAt - Date.now()) / 1000)) };
}
function open(tid: string): Room {
  for (const r of rooms.values()) {
    if (r.templateId === tid && r.status === 'open' && r.members.length < r.groupSize) return timer(r);
  }
  const m = /^equb-(\d+)-(\d+)$/.exec(tid);
  if (!m) throw new Error('Invalid template');
  const gs = +m[1], pp = +m[2], now = Date.now();
  const room: Room = {
    id: `${tid}-${now.toString(36)}`, templateId: tid, groupSize: gs, prizePool: pp,
    contribution: contrib(pp, gs), tier: pp <= 500 ? 'entry' : 'low', status: 'open',
    members: [], winningNumber: null, winnerId: null, entropyHex: null, commitmentHash: null,
    drawAt: now + ROUND_MS, secondsLeft: 60, createdAt: now, updatedAt: now,
  };
  rooms.set(room.id, room);
  return timer(room);
}
function maybeDraw(room: Room): Room {
  if (room.status !== 'open' || Date.now() < room.drawAt) return timer(room);
  if (!room.members.length) { room.drawAt = Date.now() + ROUND_MS; return timer(room); }
  const picks = room.members.map(m => m.pick);
  let p = draw(room.groupSize);
  if (!picks.includes(p.winningNumber)) {
    for (let i = 0; i < 40; i++) { p = draw(room.groupSize); if (picks.includes(p.winningNumber)) break; }
    if (!picks.includes(p.winningNumber)) p.winningNumber = picks[rnd(picks.length)]!;
  }
  const win = room.members.find(m => m.pick === p.winningNumber);
  room.status = 'completed'; room.winningNumber = p.winningNumber; room.winnerId = win?.playerId ?? null;
  room.entropyHex = p.entropyHex; room.commitmentHash = p.commitmentHash; room.updatedAt = Date.now();
  if (win) delta(win.playerId, Math.round(room.prizePool * 0.9 * 100) / 100, `win:${room.id}`);
  audit('room.draw', win?.playerId, { roomId: room.id, winningNumber: room.winningNumber });
  return timer(room);
}
function join(tid: string, playerId: string, name: string, pick: number) {
  let room = open(tid);
  room = maybeDraw(room);
  if (room.status !== 'open') room = open(tid);
  if (room.members.some(m => m.playerId === playerId)) throw new Error('Already in room');
  if (pick < 1 || pick > room.groupSize) throw new Error('Invalid pick');
  if (room.members.some(m => m.pick === pick)) throw new Error('Number taken');
  const w = wallet(playerId);
  if (w.balance < room.contribution) throw new Error(`Need ${room.contribution}, have ${w.balance}`);
  const after = delta(playerId, -room.contribution, `bet:${tid}`);
  room.members.push({ playerId, name: name.slice(0, 40), pick, joinedAt: Date.now() });
  room.updatedAt = Date.now();
  rooms.set(room.id, room);
  return { room: timer(room), wallet: after };
}
function ok(data: unknown) { return { success: true, data }; }
function cors(res: VercelResponse, o?: string | string[]) {
  const origin = Array.isArray(o) ? o[0] : o;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const path = ((req.url || '/').split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

  try {
    if (path === '/' || path === '/api' || path === '/health' || path === '/api/health') {
      const ve = verifyEtConfig();
      res.status(200).json({
        status: 'ok',
        service: 'fast-equb-api',
        wallet: true,
        adminAudit: true,
        verifyEt: ve.configured,
      });
      return;
    }

    // ── Verify.ET status (safe — no full key) ──
    if (
      (path === '/api/verify-et/status' || path === '/verify-et/status') &&
      req.method === 'GET'
    ) {
      const c = verifyEtConfig();
      res.status(200).json({
        success: true,
        configured: c.configured,
        baseUrl: c.baseUrl,
        merchantPhone: c.settlementAccount,
        merchantName: c.merchantName,
        keyPresent: Boolean(c.apiKey),
        keyHint: c.keyHint,
        message: c.configured
          ? 'VERIFY_ET_API_KEY is loaded on backend. Telebirr verify is ready.'
          : 'VERIFY_ET_API_KEY is missing on this backend deployment.',
      });
      return;
    }

    // ── Verify.ET Telebirr check ──
    if (
      (path === '/api/verify-et/telebirr' || path === '/verify-et/telebirr') &&
      req.method === 'POST'
    ) {
      const txn = String(body.transactionNumber || body.reference || '').trim();
      const expectedAmount = Number(body.expectedAmount || body.amount || 0);
      if (!txn) {
        res.status(400).json({ success: false, message: 'transactionNumber required' });
        return;
      }
      const result = await verifyTelebirr({
        transactionNumber: txn,
        expectedAmount: Number.isFinite(expectedAmount) ? expectedAmount : 0,
      });
      audit('verify.et.telebirr', String(body.userId || ''), {
        txn: txn.slice(0, 12),
        status: result.status,
        verified: result.verified,
      });
      res.status(result.verified ? 200 : result.status === 'UNAVAILABLE' ? 503 : 400).json({
        success: result.verified,
        ...result,
      });
      return;
    }

    if ((path === '/api/admin/audit' || path === '/admin/audit') && req.method === 'GET') {
      const limit = Math.min(100, Number((req.query as any)?.limit) || 50);
      res.status(200).json(ok({ items: audits.slice(0, limit), total: audits.length }));
      return;
    }
    if ((path === '/api/admin/dashboard' || path === '/admin/dashboard') && req.method === 'GET') {
      res.status(200).json(ok({
        wallets: wallets.size, rooms: rooms.size, auditEvents: audits.length, demoMode: true,
        verifyEt: verifyEtConfig().configured,
      }));
      return;
    }
    if ((path === '/api/admin/users' || path === '/admin/users') && req.method === 'GET') {
      res.status(200).json(ok({ items: [...wallets.values()], total: wallets.size }));
      return;
    }

    const gw = path.match(/^\/api\/wallet\/([^/]+)$/);
    if (gw && req.method === 'GET' && !['debit','credit','ensure','set'].includes(gw[1]!)) {
      res.status(200).json(ok(wallet(decodeURIComponent(gw[1]!))));
      return;
    }
    if (path === '/api/wallet/debit' && req.method === 'POST') {
      const id = String(body.playerId || ''); const amt = Number(body.amount);
      if (!id || !(amt > 0)) { res.status(400).json({ success: false, message: 'playerId and amount' }); return; }
      const w = wallet(id);
      if (w.balance < amt) { res.status(400).json({ success: false, message: 'Insufficient balance', data: w }); return; }
      res.status(200).json(ok(delta(id, -amt, String(body.reason || 'debit'))));
      return;
    }
    if (path === '/api/wallet/credit' && req.method === 'POST') {
      const id = String(body.playerId || ''); const amt = Number(body.amount);
      if (!id || !(amt > 0)) { res.status(400).json({ success: false, message: 'playerId and amount' }); return; }
      res.status(200).json(ok(delta(id, amt, String(body.reason || 'credit'))));
      return;
    }

    if (path === '/api/equb/templates' && req.method === 'GET') {
      const sizes = [5,10,20,30,40,50,60,70,80,90,100];
      const pools = [500,1000,2000,3000,4000,5000,6000,7000,8000,9000];
      const catalog = [];
      for (const s of sizes) for (const p of pools) {
        catalog.push({ id: `equb-${s}-${p}`, groupSize: s, prizePool: p, contribution: contrib(p,s), tier: p<=500?'entry':'low' });
      }
      res.status(200).json(ok(catalog));
      return;
    }
    const openM = path.match(/^\/api\/equb\/rooms\/([^/]+)\/open$/);
    if (openM && req.method === 'POST') {
      res.status(200).json(ok(open(decodeURIComponent(openM[1]!))));
      return;
    }
    const joinM = path.match(/^\/api\/equb\/rooms\/([^/]+)\/join$/);
    if (joinM && req.method === 'POST') {
      try {
        const r = join(decodeURIComponent(joinM[1]!), String(body.playerId||''), String(body.name||'Player'), Number(body.pick));
        res.status(200).json(ok({ ...r.room, wallet: r.wallet }));
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message || 'Join failed' });
      }
      return;
    }
    const getR = path.match(/^\/api\/equb\/rooms\/([^/]+)$/);
    if (getR && req.method === 'GET') {
      const id = decodeURIComponent(getR[1]!);
      let room = rooms.get(id);
      if (!room && /^equb-\d+-\d+$/.test(id)) room = open(id);
      if (!room) { res.status(404).json({ success: false, message: 'Room not found' }); return; }
      room = maybeDraw(room); rooms.set(room.id, room);
      res.status(200).json(ok(timer(room)));
      return;
    }

    res.status(404).json({ success: false, message: `Not found: ${path}`, hint: 'GET /api/verify-et/status' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'error' });
  }
}
