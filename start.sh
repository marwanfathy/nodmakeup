#!/usr/bin/env bash
set -e

# ============================================================
#  nod | Rouge Makeup — Universal Startup Script
#  Updates .env files, starts/stops services with logging.
#
#  Usage:
#    ./start.sh [--ip host] [options] [<ip>]
#    ./start.sh --stop [all|admin|web|media|backend|control-center]
#    ./start.sh --status
#
#  Options:
#    -h, --help                    Show this help
#    --ip <host>                   Base IP/domain (default: localhost)
#    --backend-port <port>         Backend API port (default: 5001)
#    --admin-port <port>           Admin Panel port (default: 3000)
#    --web-port <port>             Main Website port (default: 3001)
#    --media-port <port>           Media Server port (default: 5002)
#    --control-port <port>         Control Center port (default: 4000)
#    --https                       Use https:// instead of http://
#    --no-admin                    Skip starting Admin Panel
#    --no-web                      Skip starting Main Website
#    --no-media                    Skip starting Media Server
#    --no-backend                  Skip starting Backend API
#    --no-control                  Skip starting Control Center
#    --no-start                    Only update configs, do not start services
#    --no-update                   Only start services, do not update configs
#    --stop [all|admin|web|media|backend|control-center]
#                                  Stop running service(s)
#    --status                      Show running services
# ============================================================

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT/run"
LOGS_DIR="$ROOT/logs"
SERVICES=(admin web media backend control-center)

service_label() {
  case "$1" in
    admin)           echo "Admin Panel"    ;;
    web)             echo "Main Website"   ;;
    media)           echo "Media Server"   ;;
    backend)         echo "Backend API"    ;;
    control-center)  echo "Control Center" ;;
  esac
}

# ---- Helpers ----
pid_file()   { echo "$RUN_DIR/$1.pid"; }
log_file()   { echo "$LOGS_DIR/$1.log"; }

mk_run_dirs() {
  mkdir -p "$RUN_DIR" "$LOGS_DIR"
}

ts_awk() {
  local label="$1"
  awk -v label="$label" '{ print strftime("[%Y-%m-%d %H:%M:%S]"), "[" label "]", $0; fflush() }'
}

# ---- Stop ----
stop_service() {
  local name="$1" pid_file pid
  pid_file="$(pid_file "$name")"
  if [ ! -f "$pid_file" ]; then
    echo "   [${name}] not running (no PID file)"
    return 0
  fi
  pid=$(cat "$pid_file")
  if kill "$pid" 2>/dev/null; then
    echo "   [${name}] stopped (PID $pid)"
  else
    echo "   [${name}] process not found, removing stale PID file"
  fi
  rm -f "$pid_file"
}

stop_all() {
  echo "  ── Stopping services ──"
  for s in "${SERVICES[@]}"; do stop_service "$s"; done
  echo "  All services stopped."
}

# ---- Status ----
show_status() {
  echo "  ── Service status ──"
  local any=0
  for s in "${SERVICES[@]}"; do
    local pf label
    pf="$(pid_file "$s")"
    label="$(service_label "$s")"
    if [ -f "$pf" ]; then
      local pid
      pid=$(cat "$pf")
      if kill -0 "$pid" 2>/dev/null; then
        echo "   ✓ ${label} (PID $pid)"
        any=1
      else
        echo "   ✗ ${label} — stale PID $pid (remove $(pid_file "$s"))"
        rm -f "$pf"
      fi
    else
      echo "   - ${label} — not running"
    fi
  done
  [ "$any" -eq 0 ] && echo "   (no services running)"
}

# ---- Defaults ----
BASE="localhost"
BACKEND_PORT=5001
ADMIN_PORT=3000
WEB_PORT=3001
MEDIA_PORT=5002
CC_PORT=4000
PROTO="http"
START_ADMIN=1
START_WEB=1
START_MEDIA=1
START_BACKEND=1
START_CONTROL=1
DO_UPDATE=1
DO_START=1

STOP_TARGET=""
DO_STATUS=0

# ---- Parse options ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo ""
      echo "  Usage: $0 [--ip host] [options] [<ip>]"
      echo "         $0 --stop [all|admin|web|media|backend]"
      echo "         $0 --status"
      echo ""
      echo "  Options:"
      echo "    -h, --help                    Show this help"
      echo "    --ip <host>                   Base IP/domain (default: localhost)"
      echo "    --backend-port <port>         Backend API port (default: 5001)"
      echo "    --admin-port <port>           Admin Panel port (default: 3000)"
      echo "    --web-port <port>             Main Website port (default: 3001)"
      echo "    --media-port <port>           Media Server port (default: 5002)"
      echo "    --control-port <port>         Control Center port (default: 4000)"
      echo "    --https                       Use https:// instead of http://"
      echo "    --no-admin                    Skip starting Admin Panel"
      echo "    --no-web                      Skip starting Main Website"
      echo "    --no-media                    Skip starting Media Server"
      echo "    --no-backend                  Skip starting Backend API"
      echo "    --no-control                  Skip starting Control Center"
      echo "    --no-start                    Only update configs, do not start services"
      echo "    --no-update                   Only start services, do not update configs"
      echo "    --stop [all|admin|web|media|backend|control-center]"
      echo "                                  Stop running service(s)"
      echo "    --status                      Show running services"
      echo ""
      echo "  Examples:"
      echo "    $0                                   # localhost, all services"
      echo "    $0 192.168.1.100                      # custom IP"
      echo "    $0 --ip mydomain.com --no-web         # without main site"
      echo "    $0 --https --no-start                 # HTTPS config only"
      echo "    $0 --status                           # check what's running"
      echo "    $0 --stop media                       # stop media server only"
      echo ""
      exit 0
      ;;
    --ip)            BASE="$2";        shift 2 ;;
    --backend-port)  BACKEND_PORT="$2"; shift 2 ;;
    --admin-port)    ADMIN_PORT="$2";   shift 2 ;;
    --web-port)      WEB_PORT="$2";     shift 2 ;;
    --media-port)    MEDIA_PORT="$2";   shift 2 ;;
    --control-port)  CC_PORT="$2";      shift 2 ;;
    --https)         PROTO="https";     shift   ;;
    --no-admin)      START_ADMIN=0;     shift   ;;
    --no-web)        START_WEB=0;       shift   ;;
    --no-media)      START_MEDIA=0;     shift   ;;
    --no-backend)    START_BACKEND=0;   shift   ;;
    --no-control)    START_CONTROL=0;   shift   ;;
    --no-start)      DO_START=0;        shift   ;;
    --no-update)     DO_UPDATE=0;       shift   ;;
    --stop)
      STOP_TARGET="${2:-all}"
      [[ "$STOP_TARGET" =~ ^(all|admin|web|media|backend|control-center)$ ]] || {
        echo "Invalid target: $STOP_TARGET (use: all|admin|web|media|backend|control-center)"; exit 1
      }
      shift 2
      ;;
    --status)        DO_STATUS=1;       shift   ;;
    -*)
      echo "Unknown option: $1"; echo "Usage: $0 [--ip host] [options]"; exit 1 ;;
    *)
      BASE="$1"; shift ;;
  esac
done

# ---- Dispatch stop / status ----
if [ -n "$STOP_TARGET" ]; then
  mk_run_dirs
  if [ "$STOP_TARGET" = "all" ]; then stop_all; else stop_service "$STOP_TARGET"; fi
  exit 0
fi

if [ "$DO_STATUS" -eq 1 ]; then
  mk_run_dirs
  show_status
  exit 0
fi

# ============================================================
#  1.  UPDATE CONFIGURATION  (single source of truth)
# ============================================================
if [ "$DO_UPDATE" -eq 1 ]; then
  echo ""
  echo "  ╔═══════════════════════════════════════════╗"
  echo "  ║   nod  |  Rouge Makeup  —  Startup        ║"
  echo "  ╚═══════════════════════════════════════════╝"
  echo "  Base:  ${PROTO}://${BASE}"
  echo "  Ports: backend=${BACKEND_PORT}  admin=${ADMIN_PORT}  web=${WEB_PORT}  media=${MEDIA_PORT}"
  echo ""
  echo "  ── Updating configuration (root .env -> all services) ──"

  # Build the shared runtime contract when it is missing.
  if [ ! -f "$ROOT/shared/dist/runtime/config.js" ]; then
    (cd "$ROOT/shared" && npm run build)
  fi

  # ONE source of truth: the root .env. sync-env validates it, merges the dev
  # host into SAFE_ORIGINS, and renders the deploy/.env production bundle.
  # Every service reads the root .env directly — no per-service copies.
  node "$ROOT/scripts/sync-env.mjs" \
    --base "$BASE" \
    --proto "$PROTO" \
    --admin-port "$ADMIN_PORT" \
    --web-port "$WEB_PORT" \
    --media-port "$MEDIA_PORT"

  # Materialize @nod/shared into the frontends' node_modules (CRA/Next cannot
  # import outside the project root).
  (cd "$ROOT/admin-panel" && node ../scripts/materialize-shared.mjs .)
  (cd "$ROOT/main-website" && node ../scripts/materialize-shared.mjs . --design-system)

  echo ""
fi

# ============================================================
#  2.  START SERVICES
# ============================================================
if [ "$DO_START" -eq 0 ]; then
  echo "  Config updated. Use \`$0\` without --no-start to launch."
  exit 0
fi

mk_run_dirs

# Rotate old logs
for s in "${SERVICES[@]}"; do
  lf="$(log_file "$s")"
  [ -f "$lf" ] && mv "$lf" "${lf}.old" 2>/dev/null
done

echo "  ── Starting services ──"

# Cleanup on exit
cleanup() {
  echo ""
  echo "  Shutting down..."
  for s in "${SERVICES[@]}"; do stop_service "$s" >/dev/null 2>&1; done
  echo "  All services stopped."
}
trap cleanup EXIT INT TERM

# Helper: start a service and log
start_service() {
  local name="$1" label="$2" port="$3" cmd="$4" sleep_sec="${5:-0}"
  local pf lf
  pf="$(pid_file "$name")"
  lf="$(log_file "$name")"

  echo "   [${name}] ${label}  →  ${PROTO}://${BASE}:${port}  (log: ${lf})"

  if [ -f "$pf" ]; then
    local old_pid
    old_pid=$(cat "$pf")
    if kill -0 "$old_pid" 2>/dev/null; then
      echo "   [${name}] already running (PID $old_pid), skipping"
      return 0
    fi
    rm -f "$pf"
  fi

  eval "$cmd" 2>&1 | ts_awk "$name" >> "$lf" &
  local pid=$!
  echo "$pid" > "$pf"

  [ "$sleep_sec" -gt 0 ] && sleep "$sleep_sec"
}

# Media Server
if [ "$START_MEDIA" -eq 1 ]; then
  start_service media "$(service_label media)" "$MEDIA_PORT" \
    "cd \"$ROOT/media-server\" && PORT=$MEDIA_PORT node src/server.js" \
    2
fi

# Backend
if [ "$START_BACKEND" -eq 1 ]; then
  start_service backend "$(service_label backend)" "$BACKEND_PORT" \
    "cd \"$ROOT/backend\" && npx ts-node-dev --respawn --transpile-only server.ts" \
    6
fi

# Admin Panel
if [ "$START_ADMIN" -eq 1 ]; then
  start_service admin "$(service_label admin)" "$ADMIN_PORT" \
    "cd \"$ROOT/admin-panel\" && BROWSER=none PORT=$ADMIN_PORT npx react-scripts start"
fi

# Main Website
if [ "$START_WEB" -eq 1 ]; then
  start_service web "$(service_label web)" "$WEB_PORT" \
    "cd \"$ROOT/main-website\" && npx next dev -p $WEB_PORT"
fi

# Control Center (operational dashboard — starts last so it can watch every
# service it manages). Next.js (App Router) on 127.0.0.1:$CC_PORT.
if [ "$START_CONTROL" -eq 1 ]; then
  start_service control-center "$(service_label control-center)" "$CC_PORT" \
    "cd \"$ROOT/control-center\" && CC_PORT=$CC_PORT npx next dev -H 127.0.0.1 -p $CC_PORT"
fi

echo ""
echo "  ──────────────────────────────────────────"
echo "    Admin Panel:  ${PROTO}://${BASE}:${ADMIN_PORT}"
echo "    Main Website: ${PROTO}://${BASE}:${WEB_PORT}"
echo "    Backend API:  ${PROTO}://${BASE}:${BACKEND_PORT}"
echo "    Media Server: ${PROTO}://${BASE}:${MEDIA_PORT}"
echo "    Control Ctr:  http://127.0.0.1:${CC_PORT}  (operator-only; binds localhost)"
echo "  ──────────────────────────────────────────"
echo "    Logs:        $LOGS_DIR/<service>.log"
echo "    PIDs:        $RUN_DIR/<service>.pid"
echo "  ──────────────────────────────────────────"
echo ""
echo "  Commands:  $0 --status    $0 --stop [all|<service>]"
echo "  Press Ctrl+C to stop all services."
echo ""

wait
