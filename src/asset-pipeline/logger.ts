/** Timestamped build logging: `[PROCESS] message - ISO-TIME (extra)`. */

export function logBuild(processName: string, message: string, extra?: string): void {
  const suffix = extra ? ` (${extra})` : '';
  console.log(`[${processName}] ${message} - ${new Date().toISOString()}${suffix}`);
}

export function logWarn(processName: string, message: string, extra?: string): void {
  const suffix = extra ? ` (${extra})` : '';
  console.warn(`[${processName}] WARN: ${message} - ${new Date().toISOString()}${suffix}`);
}

export function logError(processName: string, message: string, error?: unknown): void {
  console.error(`[${processName}] ERROR: ${message} - ${new Date().toISOString()}`, error ?? '');
}

/** Logs a start message now and returns a function that logs the end message with the elapsed time. */
export function timeAction(processName: string, startMessage: string) {
  const start = performance.now();
  logBuild(processName, startMessage);
  return (endMessage: string, extra?: string): number => {
    const elapsed = Math.round(performance.now() - start);
    logBuild(processName, endMessage, `took ${elapsed}ms${extra ? `, ${extra}` : ''}`);
    return elapsed;
  };
}
