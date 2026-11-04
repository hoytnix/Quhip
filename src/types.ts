export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  ADMIN_PASSWORD?: string;
}

export type EventType = 'pageview' | 'click' | 'scroll' | 'goal' | 'element_view' | 'session_flush';

export interface TrackerEvent {
  type: EventType;
  path: string; // page path without query string
  session_id: string; // ephemeral session ID from sessionStorage
  timestamp?: number; // client timestamp (server time is authoritative)
  // Context
  referrer_domain?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  device_class?: 'desktop' | 'mobile' | 'tablet';
  browser_class?: 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'other';
  viewport_bucket?: string; // e.g. "1920x1080", "390x844"
  // Element interaction (clicks & element_view)
  element_identity?: string;
  element_label?: string;
  element_tag?: string;
  is_outbound?: boolean;
  dest_domain?: string;
  is_rage_click?: boolean;
  is_dead_click?: boolean;
  // Heatmap click coordinates (normalized 0-99 percentage)
  click_x?: number;
  click_y?: number;
  // Scroll metrics
  scroll_depth?: number; // 0 to 100
  // Active time & page session
  active_time?: number; // seconds of active time on this page
  is_entry?: boolean;
  is_exit?: boolean;
  // Goal
  goal_name?: string;
  goal_type?: 'click' | 'path' | 'outbound';
  goal_target?: string;
}

export interface IngestPayload {
  site_key: string;
  events: TrackerEvent[];
}

export interface SiteRecord {
  id: string;
  name: string;
  domain: string;
  site_key: string;
  owner_id: string;
  timezone: string;
  consent_banner_enabled: number;
  created_at: string;
}

export interface GoalRecord {
  id: string;
  site_id: string;
  name: string;
  type: 'click' | 'path' | 'outbound';
  target: string;
  created_at: string;
}

export interface ActiveSessionBuffer {
  site_id: string;
  session_id: string;
  first_seen_at: number;
  last_seen_at: number;
  landing_path: string;
  current_path: string;
  page_count: number;
  path_history: string[];
  total_active_time: number;
  has_interaction: number;
  has_goal: number;
  max_scroll: number;
  elements_seen: string[];
  elements_clicked: string[];
  goals_completed: string[];
  source: string;
  medium: string;
  campaign: string;
  channel: string;
  device_class: string;
  browser_class: string;
  country: string;
  expires_at: number;
}
