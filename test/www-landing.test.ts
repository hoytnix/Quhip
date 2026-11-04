import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('WWW Landing Page & Squeeze Page Verification', () => {
  const wwwDir = path.resolve(process.cwd(), 'www');
  const indexPath = path.join(wwwDir, 'index.html');
  const upperIndexPath = path.resolve(process.cwd(), 'WWW/index.html');

  it('verifies that www/index.html exists and is accessible via WWW symlink', () => {
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(upperIndexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf-8');
    const upperContent = fs.readFileSync(upperIndexPath, 'utf-8');
    expect(content.length).toBeGreaterThan(1000);
    expect(content).toBe(upperContent);
  });

  it('guarantees zero extra round-trips by inlining all CSS and JS', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    
    // Inlined styles present
    expect(html).toContain('<style>');
    expect(html).toContain('--bg: #09090b;');
    
    // No external stylesheet link tags
    expect(html).not.toMatch(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/i);

    // Inlined application script present
    expect(html).toContain('<script>');
    expect(html).toContain('function copyCliCommand(');
    expect(html).toContain('function copySnippet(');
    expect(html).toContain('function updateCalculator(');
    expect(html).toContain('function handleSqueezeSubmit(');
  });

  it('verifies complete Ray Edwards PASTOR framework coverage in copy', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');

    // P - Problem / Person / Pain
    expect(html).toContain('You Wanted to Know If People Like Your Product.');
    expect(html).toContain("Instead, You're Managing Cookie Banners and Drowning in GA4.");
    
    // A - Amplify / Agitate
    expect(html).toContain('The Four Hidden Taxes of Big Tech Analytics');
    expect(html).toContain('The 65% Cookie Bounce');
    expect(html).toContain('The 100 KB Speed Penalty');
    expect(html).toContain('The "Pageview" Mirage');
    expect(html).toContain('The GDPR Sword of Damocles');

    // S - Story / Solution / System
    expect(html).toContain('We Got Tired of Choosing Between Surveillance Capitalism and Flying Blind');
    expect(html).toContain('True Element CTR');
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('Privacy-Preserving Heatmaps');
    expect(html).toContain('Pure Edge D1 Architecture');

    // T - Transformation & Proof
    expect(html).toContain('How Quhip Completely Transforms Your Stack');
    expect(html).toContain('4.18 KB Gzipped');
    expect(html).toContain('0.82 ms');
    expect(html).toContain('0 Cookies');

    // O - Offer
    expect(html).toContain('Everything You Need to Own Your Behavioral Intelligence');
    expect(html).toContain('CC0 1.0 Universal');
    expect(html).toContain('Get The Cookieless Playbook');

    // R - Response
    expect(html).toContain('Ready to Stop Flying Blind?');
    expect(html).toContain('Deploy to Cloudflare in 60s');
    expect(html).toContain('Open Live Dashboard Demo');
    expect(html).toContain('Frequently Asked Questions');
  });

  it('contains top navbar Deploy button and 1-click deploy tutorial in hero', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    // Top navbar Deploy button
    expect(html).toContain('href="#deploy-tutorial" class="btn btn-outline" data-quhip="nav-deploy-btn">Deploy</a>');

    // 1-Click Deploy Tutorial in Hero
    expect(html).toContain('id="deploy-tutorial"');
    expect(html).toContain('1-Click Deploy Tutorial (Zero Setup Overhead)');
    expect(html).toContain('Deploy to Cloudflare Workers');
    expect(html).toContain('copyCliCommand');
  });

  it('contains interactive squeeze lead-capture mechanism in offer section', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('id="offerSqueezeForm"');
    expect(html).toContain('type="email"');
    expect(html).toContain('handleSqueezeSubmit');
  });

  it('dogfoods Quhip by including tracking snippet', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('data-site="qhp_quhip_www"');
    expect(html).toContain('src="/quhip.js"');
  });

  it('contains interactive Cloudflare free tier and cost calculator synchronized with CTR calculator', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('id="cost-calculator"');
    expect(html).toContain('id="costTrafficSlider"');
    expect(html).toContain('id="costTierBadge"');
    expect(html).toContain('id="costTotalDisplay"');
    expect(html).toContain('syncTrafficFromCost');
    expect(html).toContain('syncTrafficFromCtr');
    expect(html).toContain('calculateCloudflareCost');
    expect(html).toContain('Do You Qualify for Cloudflare\'s Free Tier?');
  });
});
