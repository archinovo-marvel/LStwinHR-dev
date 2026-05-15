/**
 * Shared login rate limiter — single Map shared across all auth routes.
 * Fixes: (1) rate limits not shared across authRoutes/corpAuthRoutes/personalAuthRoutes,
 * (2) unbounded Map growth under unique-IP DDoS (size cap with eviction).
 */

const _loginAttempts = new Map();
let _loginAttemptsSweepTs = 0;

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_ENTRIES = 10000;
const EVICT_FRACTION = 0.5;

function checkLoginRateLimit(ip) {
  const now = Date.now();

  // Sweep stale entries at most once per minute
  if (now - _loginAttemptsSweepTs > SWEEP_INTERVAL_MS) {
    _loginAttemptsSweepTs = now;
    for (const [key, val] of _loginAttempts) {
      if (now - val.windowStart > WINDOW_MS) _loginAttempts.delete(key);
    }
  }

  // Evict oldest entries if Map exceeds size cap (prevents unbounded growth under DDoS)
  if (_loginAttempts.size > MAX_ENTRIES) {
    const entries = [..._loginAttempts.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
    const evictCount = Math.floor(entries.length * EVICT_FRACTION);
    for (let i = 0; i < evictCount; i++) {
      _loginAttempts.delete(entries[i][0]);
    }
  }

  let entry = _loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    _loginAttempts.set(ip, entry);
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

function resetLoginAttempts(ip) {
  _loginAttempts.delete(ip);
}

module.exports = { checkLoginRateLimit, resetLoginAttempts };
