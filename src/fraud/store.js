// ponytail: abstracted velocity store — uses in-memory Map by default, swap to
// Redis by uncommenting the ioredis path. No Redis infra needed for dev/test.
// import Redis from 'ioredis';

// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

class MemoryStore {
  constructor() {
    this.data = new Map();
    // ponytail: clean up stale entries every 5 minutes
    this._interval = setInterval(() => this._cleanup(), 300000);
    if (this._interval.unref) this._interval.unref();
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entries] of this.data) {
      this.data.set(key, entries.filter(e => now - e.time < e.ttl));
      if (this.data.get(key).length === 0) this.data.delete(key);
    }
  }

  append(key, value, ttl = 86400000) {
    if (!this.data.has(key)) this.data.set(key, []);
    this.data.get(key).push({ value, time: Date.now(), ttl });
  }

  count(key, windowMs) {
    const now = Date.now();
    const entries = this.data.get(key) || [];
    return entries.filter(e => now - e.time < windowMs).length;
  }

  unique(key, field, windowMs) {
    const now = Date.now();
    const entries = this.data.get(key) || [];
    const recent = entries.filter(e => now - e.time < windowMs);
    return new Set(recent.map(e => e.value && e.value[field])).size;
  }

  // TOTP rate limit — track failed attempts
  // ponytail: increment returns count after adding, check with get()
  increment(key, ttl = 900000) {
    if (!this.data.has(key)) this.data.set(key, [{ value: 1, time: Date.now(), ttl }]);
    else {
      const entries = this.data.get(key);
      const total = entries.reduce((s, e) => s + e.value, 0);
      entries.push({ value: 1, time: Date.now(), ttl });
      return total + 1;
    }
    return 1;
  }

  // ponytail: filters expired entries before summing — prevents permanent lockout
  // must filter by ttl to respect the rate-limit window
  get(key) {
    const now = Date.now();
    const entries = (this.data.get(key) || []).filter(e => now - e.time < e.ttl);
    return entries.reduce((s, e) => s + e.value, 0);
  }

  delete(key) {
    this.data.delete(key);
  }
}

const store = new MemoryStore();
export default store;
