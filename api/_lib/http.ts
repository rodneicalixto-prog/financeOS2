import type { VercelRequest, VercelResponse } from '@vercel/node';

export function withCors(res: VercelResponse): VercelResponse {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res;
}

export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  withCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function jsonError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  withCors(res);
  return res.status(status).json({ success: false, error_code: code, message, ...extra });
}

export function jsonOk(res: VercelResponse, body: Record<string, unknown> = {}) {
  withCors(res);
  return res.status(200).json({ success: true, ...body });
}
