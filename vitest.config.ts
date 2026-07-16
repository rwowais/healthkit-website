import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    clearMocks: true,
    // The 365-day persona simulations nominally run just under vitest's 5s
    // default timeout — on a thermally-throttled machine they take 5-10× as
    // long and time out en masse. That was the suite's longstanding "rare
    // flake under heavy CPU load" (root-caused 2026-07-12 via a stash A/B:
    // identical timings on pre/post-change trees). Correctness is guarded by
    // assertions, not wall-clock — so give slow hardware room to finish.
    testTimeout: 120_000,
  },
});
