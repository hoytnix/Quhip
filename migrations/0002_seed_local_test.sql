-- Seed local development owner and test site
-- Username: michael
-- Password: Password123!
-- Salt: a1b2c3d4e5f60718
-- PBKDF2 hash of "Password123!" with salt "a1b2c3d4e5f60718" and 100,000 iterations:

INSERT OR IGNORE INTO owners (id, username, password_hash, salt, created_at)
VALUES (
  'owner_michael',
  'michael',
  'ded82da287a99226810844c8309fa79b3855452cc8e3b1d60a77cc00a3babe23',
  'a1b2c3d4e5f60718',
  '2026-11-04T12:00:00.000Z'
);

INSERT OR IGNORE INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
VALUES (
  'site_local_test',
  'Hello Quhip Local Test',
  'localhost:5173',
  'qhp_local_test_key',
  'owner_michael',
  'UTC',
  0,
  '2026-11-04T12:00:00.000Z'
);

INSERT OR IGNORE INTO goals (id, site_id, name, type, target, created_at)
VALUES
  ('goal_signup', 'site_local_test', 'Signup CTA Click', 'click', 'quhip:signup-btn', '2026-11-04T12:00:00.000Z'),
  ('goal_contact', 'site_local_test', 'Contact Page Visit', 'path', '/contact', '2026-11-04T12:00:00.000Z'),
  ('goal_github', 'site_local_test', 'GitHub Outbound Click', 'outbound', 'github.com', '2026-11-04T12:00:00.000Z');
