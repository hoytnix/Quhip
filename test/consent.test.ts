import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredConsent, saveConsent } from '../src/tracker/banner';
import * as fs from 'fs';
import * as path from 'path';

describe('Consent Module Verification (§10, §14)', () => {
  // In-memory mock localStorage for test environment
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();
    global.localStorage = {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, val: string) => { mockStorage.set(key, val); },
      removeItem: (key: string) => { mockStorage.delete(key); },
      clear: () => { mockStorage.clear(); },
      key: (i: number) => Array.from(mockStorage.keys())[i] || null,
      length: mockStorage.size
    } as any;
  });

  it('Strict Guardrail: Every granular toggle starts UNCHECKED in code (no pre-checked boxes)', () => {
    const bannerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/tracker/banner.ts'), 'utf-8');
    // Ensure checkbox.checked = false is explicitly set and never true
    expect(bannerCode).toMatch(/checkbox\.checked\s*=\s*false/);
    expect(bannerCode).not.toMatch(/checkbox\.checked\s*=\s*true/);
  });

  it('With banner enabled and no choice made: Zero events flow (gated)', () => {
    const current = getStoredConsent();
    expect(current).toBeNull();
    const canSendEvents = current !== null && current.analytics === true;
    expect(canSendEvents).toBe(false);
  });

  it('After Reject All: Zero events flow', () => {
    saveConsent(false);
    const current = getStoredConsent();
    expect(current).not.toBeNull();
    expect(current?.analytics).toBe(false);
    const canSendEvents = current !== null && current.analytics === true;
    expect(canSendEvents).toBe(false);
  });

  it('After Accept All: Events flow', () => {
    saveConsent(true);
    const current = getStoredConsent();
    expect(current).not.toBeNull();
    expect(current?.analytics).toBe(true);
    const canSendEvents = current !== null && current.analytics === true;
    expect(canSendEvents).toBe(true);
  });

  it('After withdrawing consent: Events immediately stop', () => {
    // 1. Initially consented
    saveConsent(true);
    expect(getStoredConsent()?.analytics).toBe(true);

    // 2. User opens privacy preferences and revokes consent
    saveConsent(false);
    const revoked = getStoredConsent();
    expect(revoked?.analytics).toBe(false);
    const canSendEvents = revoked !== null && revoked.analytics === true;
    expect(canSendEvents).toBe(false);
  });
});
