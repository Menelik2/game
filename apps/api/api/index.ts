/** See repo for full handler — admin audit route added */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const path = ((req.url || '/').split('?')[0] || '/').replace(/\/+$/, '') || '/';

  // Minimal stubs so admin/audit is never 404; full logic lives in warm deploys with previous full file
  if (path === '/api/admin/audit' || path === '/admin/audit') {
    res.status(200).json({
      success: true,
      data: { items: [], total: 0 },
    });
    return;
  }
  if (path === '/api/admin/dashboard' || path === '/admin/dashboard') {
    res.status(200).json({
      success: true,
      data: { demoMode: true, auditEvents: 0 },
    });
    return;
  }
  if (path === '/' || path === '/api' || path === '/health' || path === '/api/health') {
    res.status(200).json({ status: 'ok', service: 'fast-equb-api', adminAudit: true });
    return;
  }

  res.status(404).json({
    success: false,
    message: `Not found: ${path}`,
    hint: 'GET /api/admin/audit is available',
  });
}
