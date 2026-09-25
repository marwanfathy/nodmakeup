#!/usr/bin/env python3
"""control-center system-metrics sidecar (polyglot: python/psutil).

The Node collectors shell out to this for richer OS + per-process metrics than
Node's os module exposes cheaply. Output is a single JSON document on stdout:

  {
    "system": {"cpu_pct": float, "mem_pct": float, "mem_used_mb": int,
               "disk_pct": float, "disk_free_mb": int},
    "procs":  [{"pid": int, "name": str, "cpu_pct": float, "mem_pct": float}]
  }

Usage: python3 py/system_metrics.py [pid ...] [--root DIR]
Run with a short timeout from the collector — this never blocks on its own.
"""
import json
import os
import sys

try:
    import psutil
except ImportError:  # pragma: no cover - degraded mode handled in Node
    print(json.dumps({"error": "psutil-not-installed"}))
    sys.exit(0)


def system():
    mem = psutil.virtual_memory()
    try:
        disk = psutil.disk_usage("/")
    except OSError:
        disk = None
    return {
        "cpu_pct": psutil.cpu_percent(interval=None),
        "mem_pct": mem.percent,
        "mem_used_mb": round(mem.used / 1024 / 1024),
        "disk_pct": round(disk.percent, 1) if disk else None,
        "disk_free_mb": round(disk.free / 1024 / 1024) if disk else None,
    }


def procs(pids):
    out = []
    for pid in pids:
        try:
            p = psutil.Process(pid)
            if not p.is_running():
                continue
            with p.oneshot():
                cpu = p.cpu_percent(interval=None)
                out.append(
                    {
                        "pid": pid,
                        "name": p.name() or "unknown",
                        "cpu_pct": round(cpu, 1),
                        "mem_pct": round(p.memory_percent(), 1),
                    }
                )
        except (psutil.NoSuchProcess, psutil.AccessDenied, ValueError):
            continue
    return out


def main():
    pids = []
    for arg in sys.argv[1:]:
        if arg == "--root":
            # Informational only: the disk_usage target is the process root.
            continue
        if arg.lstrip("-").isdigit():
            pids.append(int(arg))
    print(json.dumps({"system": system(), "procs": procs(pids)}))


if __name__ == "__main__":
    main()