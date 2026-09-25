// instrumentation.ts — runs once when the Next server boots (dev + prod).
// Next compiles this file for BOTH the nodejs and edge runtimes, so it must
// stay import-free here: the node-only wiring lives in instrumentation-node.ts
// and is pulled in only for the nodejs runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { start } = await import('./instrumentation-node');
    start();
  }
}