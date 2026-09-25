// lib/types.ts
// The typed language of the control plane: one contract shared by the route
// handlers (server) and the UI (client). Every "device command" (service
// start/stop/restart), status report, log event, metric series and audit
// record is a named type here — no untyped object flows between the browser
// and the process-control layer.

// ---------------------------------------------------------------------------
// Services & process control ("device commands")
// ---------------------------------------------------------------------------

export type ServiceName =
  | 'backend'
  | 'media'
  | 'admin'
  | 'web'
  | 'tunnel-api'
  | 'tunnel-media'
  | 'tunnel-quick-api'
  | 'tunnel-quick-media';

export type ServiceAction = 'start' | 'stop' | 'restart';

export interface ServiceHealthPath {
  path: string;
  match: number;
}

/** Absolute-URL health probe — for services without a local HTTP port (the
 *  Cloudflare tunnel is probed at its own metrics endpoint instead). */
export interface ServiceProbe {
  url: string;
  match: number;
}

/** One regex extracting a dynamic per-run value from a service's log (e.g. a
 *  trycloudflare hostname that rotates every restart). Capture group 1 wins,
 *  otherwise the whole match. */
export interface LivePattern {
  key: string;
  re: RegExp;
}

/** Static registry entry for one managed service (mirrors start.sh). */
export interface ServiceDef {
  name: ServiceName;
  label: string;
  dir: string;
  portKey: string;
  defaultPort: number;
  health: ServiceHealthPath[];
  /** When set, probes these absolute URLs instead of port-based `health`. */
  probes?: ServiceProbe[];
  /** Public clickable URLs shown on the service card (e.g. tunnel hostnames). */
  links?: string[];
  /** Discover dynamic values from the service's own log. Values are
   *  `${key}`-substituted into `probes[].url`, and a value keyed `url` is
   *  prepended to the card links (quick tunnels: random hostname + metrics
   *  port per run, so neither can be static). */
  liveFrom?: {
    /** File name inside LOGS_DIR. */
    file: string;
    patterns: LivePattern[];
  };
  cmd: string;
}

/** Immediate process state (pid file / /proc discovery, no health probe). */
export interface ServiceState {
  name: ServiceName;
  pid: number | null;
  running: boolean;
}

/** Row for the overview grid: registry + process state + probe result. */
export interface ServiceView extends ServiceState {
  label: string;
  url: string;
  port: number;
  /** Public URLs for services exposed to the internet (tunnel hostnames). */
  links: string[];
  up: boolean;
  code: number;
  latencyMs: number;
  checkedAt: string | null;
}

export interface ProbeResult {
  path: string;
  code: number;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Full health-probe record for one service. */
export interface ServiceStatus {
  name: ServiceName;
  label: string;
  up: boolean;
  code: number;
  latencyMs: number;
  checkedAt: string | null;
  probes: ProbeResult[];
}

/** Result of a start/stop/restart command. */
export type ActionResult =
  | { action: ServiceAction; name: ServiceName; ok: true; already?: boolean; pid?: number; up?: boolean; port?: number; error?: never }
  | { action: ServiceAction; name: ServiceName; ok: false; error: string };

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface SeriesData {
  t: number[];
  v: number[];
}

export interface SeriesStats {
  avg: number;
  min: number;
  max: number;
}

export interface SeriesHint {
  name: string;
  stats: SeriesStats;
  last: number;
}

export interface SystemMetric {
  cpu_pct: number | null;
  mem_pct: number | null;
  mem_used_mb: number | null;
  disk_pct: number | null;
  disk_free_mb: number | null;
}

export interface ProcMetric {
  pid: number;
  name: string;
  cpu_pct: number;
  mem_pct: number;
}

export interface SystemMetrics {
  system: SystemMetric;
  procs: ProcMetric[];
  source: string;
  at: string | null;
}

export interface MonitorTarget {
  job: string;
  instance: string;
  up: boolean;
}

export interface MonitoringStatus {
  up: boolean;
  targets: MonitorTarget[];
  error: string | null;
  checkedAt: string | null;
}

// ---------------------------------------------------------------------------
// Logs (static tail + live SSE events)
// ---------------------------------------------------------------------------

export interface LogFileInfo {
  name: string;
  label: string;
  size: number;
  exists: boolean;
}

export interface LogLinesResponse {
  name: string;
  lines: string[];
}

/** Events pushed over the /api/logs/stream Server-Sent Event feed. */
export type LogStreamEvent =
  | { event: 'connected'; name: string; ok: true }
  | { event: 'lines'; name: string; lines: string[] };

// ---------------------------------------------------------------------------
// Tracing
// ---------------------------------------------------------------------------

export interface Span {
  id: string;
  service: string;
  time: string | null;
  method: string | null;
  url: string;
  status: number | null;
  durationMs: number | null;
  raw: string;
}

export interface SpanSummary {
  total: number;
  errors: number;
  byService: Record<string, number>;
  window: string | null;
}

export interface SpanDetail {
  id: string;
  spans: Span[];
  chain: boolean;
  services: string[];
}

// ---------------------------------------------------------------------------
// Config (.env editor) & flags & audit
// ---------------------------------------------------------------------------

export type EnvKeyType = 'port' | 'url' | 'bool' | 'secret' | 'string';

export interface EnvKeyInfo {
  key: string;
  type: EnvKeyType;
  secret: boolean;
  value: string;
}

export interface EnvUpdate {
  key: string;
  value: string | null; // null deletes the key
}

export interface EnvApplyResult {
  written: string[];
  removed: string[];
  synced: boolean;
  syncOutput?: string;
}

export interface FlagDef {
  key: string;
  title: string;
  description: string;
  value: boolean;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthSetupState {
  setupRequired: boolean;
}

export interface AuthResponse {
  ok: true;
  csrfToken: string;
  username: string;
}

export interface AuthMe {
  username: string;
  csrfToken: string;
}

// ---------------------------------------------------------------------------
// Overview aggregate
// ---------------------------------------------------------------------------

export interface OverviewPayload {
  adminUrl: string | null;
  services: ServiceView[];
  system: SystemMetrics;
  seriesHints: SeriesHint[];
  tracing: SpanSummary;
  monitoring: MonitoringStatus;
  sampleMs: number;
}