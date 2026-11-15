import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const ADMIN_COOKIE_NAME = 'karya_admin_session';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function createSignedAdminToken(): string {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const payload = `${expiresAt}.${crypto.randomBytes(16).toString('hex')}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySignedAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresStr, nonce, sig] = parts;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const payload = `${expiresStr}.${nonce}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

function safePinCompare(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health endpoint for Cloud Run / deployment readiness checks
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'karya-morocco-spa',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/admin/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const authenticated =
      verifySignedAdminToken(cookies[ADMIN_COOKIE_NAME]) ||
      verifySignedAdminToken(bearerToken);
    res.json({ authenticated });
  });

  app.post('/api/admin/verify-pin', async (req, res) => {
    const submittedPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const configuredPin = (process.env.ADMIN_PIN || '').trim();

    let verified = false;

    if (configuredPin) {
      verified = Boolean(submittedPin) && safePinCompare(submittedPin, configuredPin);
      if (!verified) {
        return res.status(401).json({
          ok: false,
          error: 'الرمز السري غير صحيح. يرجى التحقق والمحاولة مرة أخرى.',
        });
      }
    } else {
      const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const rawKey = (
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ''
      ).trim();

      const supabaseUrl =
        /^https?:\/\//i.test(rawUrl) && !rawUrl.includes('your-project')
          ? rawUrl
          : 'https://fvadhrdyxykromonpnoo.supabase.co';
      const supabaseAnonKey =
        rawKey.length > 30 && !rawKey.includes('your-supabase-anon-key')
          ? rawKey
          : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YWRocmR5eHlrcm9tb25wbm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzE2NjgsImV4cCI6MjExMDMwNzY2OH0.Snu4HAl3pgxuHcaNMJCSzdKMbe4y6brSWo07hWDFozY';

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_admin_pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ p_pin: submittedPin }),
          });

          if (rpcRes.ok) {
            const rpcData = (await rpcRes.json()) as unknown;
            if (rpcData === true) {
              verified = true;
            } else {
              return res.status(401).json({
                ok: false,
                error: 'الرمز السري غير صحيح. يرجى التحقق والمحاولة مرة أخرى.',
              });
            }
          }
        } catch {
          // Fall through to 503 if RPC unreachable
        }
      }

      if (!verified) {
        return res.status(503).json({
          ok: false,
          notConfigured: true,
          error:
            'لم يتم تفعيل الرمز السري للإدارة بعد (عبر دالة verify_admin_pin في Supabase أو متغير الخادم ADMIN_PIN).',
        });
      }
    }

    const token = createSignedAdminToken();
    const isHttps = isProduction || req.headers['x-forwarded-proto'] === 'https';
    const cookieAttrs = isHttps ? '; Secure; SameSite=None' : '; SameSite=Lax';
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}${cookieAttrs}`,
    );
    return res.json({ ok: true, token });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    );
    res.json({ ok: true });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Karya server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
