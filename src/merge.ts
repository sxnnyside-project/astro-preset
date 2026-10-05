type Plain = Record<string, unknown>;

const isPlain = (x: unknown): x is Plain =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

/**
 * Deep merge where `over` wins. Plain objects merge key by key, arrays (integrations, vite plugins)
 * are concatenated, everything else is replaced.
 */
export function merge<T extends Plain>(base: T, over: Plain): T {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    if (isPlain(current) && isPlain(value)) out[key] = merge(current, value);
    else if (Array.isArray(current) && Array.isArray(value)) out[key] = [...current, ...value];
    else if (value !== undefined) out[key] = value;
  }
  return out as T;
}
