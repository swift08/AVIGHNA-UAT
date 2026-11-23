/** Demo/local password login — off in production; on for tests only unless explicitly enabled. */
export function isDemoAuthEnabled(): boolean {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | boolean | undefined>)
      : undefined;
  const flag = env?.["VITE_ALLOW_DEMO_AUTH"];
  if (flag === "true" || flag === true) return true;
  if (flag === "false" || flag === false) return false;
  // Vitest / unit tests still need demo actors when the flag is unset.
  if (env?.["MODE"] === "test") return true;
  if (typeof process !== "undefined") {
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "true") return true;
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "false") return false;
    if (process.env["NODE_ENV"] === "test") return true;
  }
  return false;
}
