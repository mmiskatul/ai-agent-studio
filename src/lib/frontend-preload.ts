type Task = () => void | Promise<void>;

function runTask(task: Task) {
  void Promise.resolve().then(task).catch(() => undefined);
}

export function scheduleIdleTask(task: Task, timeout = 1_000) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const runWhenIdle = window.requestIdleCallback as (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    const cancelIdleTask = window.cancelIdleCallback as ((handle: number) => void) | undefined;
    const handle = runWhenIdle(() => runTask(task), { timeout });
    return () => cancelIdleTask?.(handle);
  }

  const handle = globalThis.setTimeout(() => runTask(task), 0);
  return () => globalThis.clearTimeout(handle);
}

export function scheduleDelayedTask(delayMs: number, task: Task) {
  const handle = globalThis.setTimeout(() => runTask(task), delayMs);
  return () => globalThis.clearTimeout(handle);
}

export const PRELOAD_ROUTES = ["/dashboard", "/agents", "/agents/new", "/profile"] as const;

export const CHAT_WORKSPACE_PRELOAD_LIMIT = 3;
export const CHAT_WORKSPACE_PRELOAD_DELAY_MS = 1_200;
