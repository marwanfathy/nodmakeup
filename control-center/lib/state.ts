// lib/state.ts
// Next dev (Turbopack) can evaluate one module into several registries — the
// instrumentation graph and the route-handler graph can hold separate copies
// of module scope. Mutable server state must therefore live on globalThis so
// every registry shares the same object; otherwise the dashboard heartbeat
// (sampler) would write buffers the API routes never see, and sessions would
// silently diverge. This is the Next-docs "singletons" pattern:
//   https://nextjs.org/docs/app/building-your-application/rendering/... (singletons)
//
// Everything that is written somewhere and read somewhere else goes through
// globalState(). Read-only derived values (env tables, service definitions)
// may stay in module scope — every registry computes the same thing.
const G = globalThis as unknown as { __nodCc?: Record<string, unknown> };

export function globalState<T>(key: string, factory: () => T): T {
  const box = (G.__nodCc ??= {});
  return (box[key] ??= factory()) as T;
}

/** Mutable box for state that gets reassigned wholesale. */
export function globalBox<T>(key: string, factory: () => T): { value: T } {
  const box = (G.__nodCc ??= {});
  return (box[key] ??= { value: factory() }) as { value: T };
}