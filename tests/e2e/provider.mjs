// Isolated HTTP test double. Never imported by the application or used for real accounts.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

const users = new Map();
const sessions = new Map();
const tokens = new Map();
const outbox = [];
const profiles = new Map();
let refreshes = 0;

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: expires, iat: expires - 3600, aud: 'authenticated', role: 'authenticated', session_id: randomUUID() })).toString('base64url');
  const value = { access_token: `${header}.${payload}.test-signature`, refresh_token: randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
  sessions.set(value.access_token, value);
  return value;
}

function sendMail(user, type, redirect) {
  const hash = (type === 'signup' ? 'pkce_' : '') + randomBytes(28).toString('hex');
  tokens.set(hash, { user, type });
  outbox.push({ email: user.email, url: `${redirect}&token_hash=${hash}&type=${type}` });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:54331');
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString());
  } catch { res.writeHead(400).end(); return; }
  const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value, (key, item) => key === 'password' ? undefined : item)); };
  const fail = (code = 'invalid_credentials') => send({ code, msg: code, error_code: code }, 400);
  const current = sessions.get(req.headers.authorization?.replace('Bearer ', ''));

  if (url.pathname === '/health') return send({ mode: 'TEST DOUBLE ONLY' });
  if (url.pathname === '/__test/mail') return send(outbox.filter((mail) => mail.email === url.searchParams.get('email')).at(-1) ?? {});
  if (url.pathname === '/__test/refreshes') return send({ count: refreshes });
  if (url.pathname === '/auth/v1/signup') {
    if (users.has(body.email)) return send({ user: { id: randomUUID(), identities: [] }, session: null });
    const user = { id: randomUUID(), email: body.email, password: body.password, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: body.data ?? {}, created_at: new Date().toISOString(), identities: [] };
    users.set(user.email, user);
    sendMail(user, 'signup', url.searchParams.get('redirect_to'));
    return send({ ...user, password: undefined });
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const previous = [...sessions.values()].find((value) => value.refresh_token === body.refresh_token);
      if (!previous) return fail('refresh_token_not_found');
      refreshes++;
      return send(session(previous.user));
    }
    const user = users.get(body.email);
    if (!user || user.password !== body.password) return fail();
    if (!user.email_confirmed_at) return fail('email_not_confirmed');
    return send(session(user));
  }
  if (url.pathname === '/auth/v1/recover') {
    const user = users.get(body.email);
    if (user) sendMail(user, 'recovery', url.searchParams.get('redirect_to'));
    return send({});
  }
  if (url.pathname === '/auth/v1/verify') {
    const token = tokens.get(body.token_hash);
    if (!token || token.type !== body.type) return fail('otp_expired');
    tokens.delete(body.token_hash);
    token.user.email_confirmed_at = new Date().toISOString();
    return send(session(token.user));
  }
  if (url.pathname === '/auth/v1/user') {
    if (!current) return send({ code: 'session_not_found', msg: 'session_not_found' }, 401);
    if (req.method === 'PUT') current.user.password = body.password;
    return send({ ...current.user, password: undefined });
  }
  if (url.pathname === '/auth/v1/logout') {
    if (current) for (const [key, value] of sessions) {
      if (url.searchParams.get('scope') === 'global' ? value.user.id === current.user.id : key === current.access_token) sessions.delete(key);
    }
    return send({});
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (!current && url.searchParams.get('select') === 'id') return send([]);
    if (!current) return send({ message: 'denied' }, 401);
    const profile = profiles.get(current.user.id) ?? { id: current.user.id, display_name: current.user.user_metadata.display_name || null, avatar_url: null, timezone: 'UTC', preferred_language: 'en', onboarding_completed_at: null, product_analytics_enabled: true };
    if (req.method === 'PATCH') { Object.assign(profile, body); profiles.set(current.user.id, profile); }
    return send(profile);
  }
  if (url.pathname === '/rest/v1/rpc/record_product_event') {
    if (!current) return send({ message: 'denied' }, 401);
    return send(randomUUID());
  }
  return send({ message: 'Unhandled test provider route' }, 404);
}).listen(54331, '127.0.0.1', () => console.log('Test-only auth provider listening on 127.0.0.1:54331'));
