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
