/** Demo/local password login — never in production builds; on for tests unless production. */
export function isDemoAuthEnabled(): boolean {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | boolean | undefined>)
      : undefined;

  // Hard lock: production builds never expose demo quick-login (ignores env mistakes).
  if (env?.["PROD"] === true || env?.["MODE"] === "production") return false;
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return false;

  // Unit tests need demo actors even if .env sets the flag false.
  if (env?.["MODE"] === "test") return true;
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "test") return true;

  const flag = env?.["VITE_ALLOW_DEMO_AUTH"];
  if (flag === "true" || flag === true) return true;
  if (flag === "false" || flag === false) return false;

  if (typeof process !== "undefined") {
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "true") return true;
    if (process.env["VITE_ALLOW_DEMO_AUTH"] === "false") return false;
  }
  return false;
}
