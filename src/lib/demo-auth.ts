/** Demo/local password login — never in production builds; tests only unless explicitly enabled. */
export function isDemoAuthEnabled(): boolean {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | boolean | undefined>)
      : undefined;

  // Hard lock: production / PROD builds never expose demo quick-login.
  if (env?.["PROD"] === true || env?.["MODE"] === "production") return false;

  const flag = env?.["VITE_ALLOW_DEMO_AUTH"];
  if (flag === "true" || flag === true) return true;
  if (flag === "false" || flag === false) return false;

  // Vitest still needs demo actors when the flag is unset.
  if (env?.["MODE"] === "test") return true;
  if (typeof process !== "undefined") {
    if (process.env["NODE_ENV"] === "production") return false;
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "true") return true;
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "false") return false;
    if (process.env["NODE_ENV"] === "test") return true;
  }
  return false;
}
