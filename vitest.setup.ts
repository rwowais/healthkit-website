/**
 * Minimal browser polyfills so the real storage/datasource modules run
 * under Node without pulling in jsdom. Only what those modules touch:
 * localStorage, window event bus, CustomEvent.
 */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.CustomEvent === "undefined") {
  class CE<T = unknown> extends Event {
    detail: T | undefined;
    constructor(type: string, init?: { detail?: T }) {
      super(type);
      this.detail = init?.detail;
    }
  }
  g.CustomEvent = CE;
}

// supabase-js eagerly constructs a realtime WebSocket; Node < 22 has no
// global WebSocket. Only matters for the opt-in staging smoke; harmless
// for the deterministic suite (which mocks supabase entirely).
if (typeof g.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    g.WebSocket = require("ws");
  } catch {
    /* ws not installed — staging smoke will surface a clear error */
  }
}

const bus = new EventTarget();
const windowStub = {
  addEventListener: bus.addEventListener.bind(bus),
  removeEventListener: bus.removeEventListener.bind(bus),
  dispatchEvent: bus.dispatchEvent.bind(bus),
};

g.window = windowStub;
g.localStorage = new MemoryStorage();
(g.window as Record<string, unknown>).localStorage = g.localStorage;

/** Per-test reset of the polyfilled browser state. */
g.__resetBrowser = () => {
  (g.localStorage as MemoryStorage).clear();
};

// Make ONLY the STAGING_* vars from the gitignored .env.local visible to
// the (opt-in, network) staging smoke. Vitest doesn't load .env.local
// the way Next does; the deterministic suite never reads these.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(STAGING_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env.local — staging smoke just skips */
}
