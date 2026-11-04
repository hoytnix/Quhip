// Quhip Consent Banner Module (§10)
// Cookieless, zero pre-checked boxes, equal button weights, strictly gated.

const CONSENT_STORAGE_KEY = 'quhip_consent_choice';

export interface ConsentRecord {
  analytics: boolean;
  timestamp: number;
}

export function getStoredConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean): void {
  try {
    const record: ConsentRecord = {
      analytics,
      timestamp: Date.now()
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

export function renderConsentBanner(onConsentChange: (consented: boolean) => void): void {
  // If already chosen, do not render banner
  const current = getStoredConsent();
  if (current !== null) {
    createSettingsButton(onConsentChange);
    return;
  }

  const existingBanner = document.getElementById('quhip-consent-banner');
  if (existingBanner) existingBanner.remove();

  const container = document.createElement('div');
  container.id = 'quhip-consent-banner';
  container.setAttribute('data-quhip-ignore', 'true'); // Never track banner clicks

  container.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    max-width: 480px;
    margin: 0 auto;
    background: #18181b;
    color: #f4f4f5;
    padding: 18px 20px;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    z-index: 2147483647;
    box-sizing: border-box;
    border: 1px solid #27272a;
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 600; font-size: 15px; margin-bottom: 6px; color: #ffffff;';
  title.textContent = 'Privacy & Analytics Preferences';

  const desc = document.createElement('div');
  desc.style.cssText = 'color: #a1a1aa; font-size: 13px; margin-bottom: 14px;';
  desc.textContent = 'We respect your privacy. Quhip uses cookieless, aggregated analytics with zero user profiles or cross-site tracking.';

  // Granular toggles (§10: MUST START UNCHECKED. No pre-checked boxes, ever!)
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 10px 12px; background: #27272a; border-radius: 8px;';

  const toggleLabel = document.createElement('label');
  toggleLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #e4e4e7;';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'quhip-analytics-checkbox';
  checkbox.checked = false; // STRICT REQUIREMENT: UNCHECKED BY DEFAULT (§10)
  checkbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6;';

  const checkboxText = document.createElement('span');
  checkboxText.textContent = 'Allow cookieless engagement analytics';

  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(checkboxText);
  toggleRow.appendChild(toggleLabel);

  // Equal visual weight buttons (§10: same size, same weight, no dark patterns)
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

  const btnReject = document.createElement('button');
  btnReject.type = 'button';
  btnReject.textContent = 'Reject All';
  btnReject.style.cssText = `
    flex: 1;
    padding: 9px 14px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #f4f4f5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s ease;
  `;

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.textContent = 'Save Choices';
  btnSave.style.cssText = `
    flex: 1;
    padding: 9px 14px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #f4f4f5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s ease;
  `;

  const btnAccept = document.createElement('button');
  btnAccept.type = 'button';
  btnAccept.textContent = 'Accept All';
  btnAccept.style.cssText = `
    flex: 1;
    padding: 9px 14px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #f4f4f5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s ease;
  `;

  btnReject.onclick = () => {
    saveConsent(false);
    container.remove();
    createSettingsButton(onConsentChange);
    onConsentChange(false);
  };

  btnSave.onclick = () => {
    const isGranted = checkbox.checked;
    saveConsent(isGranted);
    container.remove();
    createSettingsButton(onConsentChange);
    onConsentChange(isGranted);
  };

  btnAccept.onclick = () => {
    // Visitor actively tapped Accept All
    saveConsent(true);
    container.remove();
    createSettingsButton(onConsentChange);
    onConsentChange(true);
  };

  buttonRow.appendChild(btnReject);
  buttonRow.appendChild(btnSave);
  buttonRow.appendChild(btnAccept);

  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(toggleRow);
  container.appendChild(buttonRow);

  mountElement(container);
}

function mountElement(el: HTMLElement): void {
  if (typeof document === 'undefined') return;
  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        document.body.appendChild(el);
      }
    });
  }
}

// Persistent small settings control (§10: easy to change later)
function createSettingsButton(onConsentChange: (consented: boolean) => void): void {
  const existing = document.getElementById('quhip-consent-settings-btn');
  if (existing) return;

  const btn = document.createElement('button');
  btn.id = 'quhip-consent-settings-btn';
  btn.setAttribute('data-quhip-ignore', 'true');
  btn.title = 'Privacy Preferences';
  btn.textContent = '⚙ Privacy';
  btn.style.cssText = `
    position: fixed;
    bottom: 12px;
    right: 12px;
    padding: 5px 9px;
    background: rgba(24, 24, 27, 0.85);
    color: #a1a1aa;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    cursor: pointer;
    z-index: 2147483646;
    opacity: 0.7;
    transition: opacity 0.2s;
  `;
  btn.onmouseover = () => { btn.style.opacity = '1'; };
  btn.onmouseout = () => { btn.style.opacity = '0.7'; };
  btn.onclick = () => {
    btn.remove();
    // Clear choice and re-render banner so user can change/withdraw
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    renderConsentBanner(onConsentChange);
  };

  mountElement(btn);
}
