import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Verification (§14)', () => {
  it('Snippet parsing and execution benchmark shows negligible render delay (< 2ms)', () => {
    const snippetCode = fs.readFileSync(path.resolve(process.cwd(), 'dist/quhip.js'), 'utf-8');

    // Simulate browser window & document mock
    const listeners: Record<string, Function[]> = {};
    const mockWindow: any = {
      location: { href: 'https://example.com/test', pathname: '/test', search: '', hostname: 'example.com' },
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: (type: string, fn: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', webdriver: false, sendBeacon: () => true },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {}
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {}
      },
      history: {
        pushState: () => {},
        replaceState: () => {}
      },
      setInterval: () => 123,
      clearInterval: () => {}
    };

    const mockDocument: any = {
      currentScript: {
        getAttribute: (attr: string) => (attr === 'data-site' ? 'qhp_bench_key' : null)
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: (type: string, fn: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      visibilityState: 'visible',
      documentElement: { scrollWidth: 1920, scrollHeight: 3000, scrollTop: 0 },
      body: { scrollHeight: 3000, childElementCount: 20 }
    };

    // Measure execution time of snippet initialization
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const runner = new Function('window', 'document', 'navigator', 'sessionStorage', 'localStorage', 'history', snippetCode);
      runner(mockWindow, mockDocument, mockWindow.navigator, mockWindow.sessionStorage, mockWindow.localStorage, mockWindow.history);
    }

    const totalTimeMs = performance.now() - start;
    const avgExecutionTimeMs = totalTimeMs / iterations;

    console.log(`[Performance Benchmark Results]`);
    console.log(`Snippet Iterations: ${iterations}`);
    console.log(`Total Execution Time: ${totalTimeMs.toFixed(3)} ms`);
    console.log(`Avg Snippet Execution Time: ${avgExecutionTimeMs.toFixed(4)} ms per page load`);

    // Must be under 2 ms (virtually zero overhead)
    expect(avgExecutionTimeMs).toBeLessThan(2.0);
  });
});
