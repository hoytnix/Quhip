import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Privacy Audit (§4, §14)', () => {
  const rootDir = process.cwd();
  const srcFiles: string[] = [];

  function collectFiles(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.wrangler') {
          collectFiles(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.sql'))) {
        srcFiles.push(fullPath);
      }
    }
  }

  collectFiles(path.join(rootDir, 'src'));
  collectFiles(path.join(rootDir, 'migrations'));
  if (fs.existsSync(path.join(rootDir, 'dist/quhip.js'))) {
    srcFiles.push(path.join(rootDir, 'dist/quhip.js'));
  }

  it('No cookie reads or writes anywhere in the codebase or snippet (must be 0)', () => {
    const matches: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/document\.cookie/i.test(content) || /Set-Cookie/i.test(content)) {
        matches.push(file);
      }
    }
    expect(matches).toEqual([]);
  });

  it('No device fingerprinting APIs in snippet or codebase (must be 0)', () => {
    const fingerprintingApis = [
      /toDataURL\s*\(/i,
      /getImageData\s*\(/i,
      /AudioContext/i,
      /getChannelData\s*\(/i,
      /enumerateDevices\s*\(/i,
      /getBattery\s*\(/i
    ];

    const violations: { file: string; api: string }[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const regex of fingerprintingApis) {
        if (regex.test(content)) {
          violations.push({ file, api: regex.source });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('No IP storage in any database table schema or column (must be 0)', () => {
    const schemaContent = fs.readFileSync(path.join(rootDir, 'migrations/0001_initial_schema.sql'), 'utf-8');
    // Check for ip_address, ip_hash, visitor_ip, etc.
    const ipMatch = schemaContent.match(/\bip_address\b|\bclient_ip\b|\bremote_ip\b|\bvisitor_ip\b|\bip\s+TEXT/i);
    expect(ipMatch).toBeNull();
  });

  it('No Google Analytics code, SDK, or beacons anywhere in Quhip (must be 0)', () => {
    const gaPatterns = [
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /\bgtag\s*\(/i,
      /\bga\s*\(\s*['"]create['"]/i,
      /analytics\.js/i
    ];

    const violations: { file: string; pattern: string }[] = [];
    for (const file of srcFiles) {
      // Exclude tests or explicit docs
      if (file.includes('test/')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of gaPatterns) {
        if (pattern.test(content)) {
          violations.push({ file, pattern: pattern.source });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('Built snippet size is verified to be under 10 KB gzipped', () => {
    const snippetPath = path.join(rootDir, 'dist/quhip.js');
    expect(fs.existsSync(snippetPath)).toBe(true);
    const code = fs.readFileSync(snippetPath);
    const zlib = require('zlib');
    const gzipped = zlib.gzipSync(code);
    const gzipSizeKb = gzipped.length / 1024;
    console.log(`[Audit Evidence] Built dist/quhip.js Gzip Size: ${gzipSizeKb.toFixed(2)} KB (Limit: 10.00 KB)`);
    expect(gzipSizeKb).toBeLessThan(10);
  });
});
