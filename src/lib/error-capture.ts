// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also redacts API keys, JWTs, passwords, and other secrets from console output.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

const SENSITIVE_KEY =
  /^(?:.*[_-]?)?(api[_-]?key|apikey|secret|password|passwd|passphrase|token|authorization|auth|bearer|service[_-]?role|private[_-]?key|refresh[_-]?token|access[_-]?token|client[_-]?secret|sb_secret)(?:[_-]?.*)?$/i;

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-+=/]+/gi;
const ENV_ASSIGN_RE =
  /\b(?:VITE_)?(?:SUPABASE_(?:SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY|URL)|API_KEY|SECRET_KEY|PASSWORD)\b\s*[:=]\s*["']?[^\s"',}]+["']?/gi;

function envSecretValues(): string[] {
  const keys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
  ];
  const values: string[] = [];
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};
  const fromMeta =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | undefined>)
      : {};
  for (const key of keys) {
    const value = fromProcess[key] || fromMeta[key];
    if (typeof value === "string" && value.length >= 8) values.push(value);
  }
  return values;
}

/** Redact secrets from a string before it hits the console. */
export function redactSensitiveString(input: string): string {
  let out = input
    .replace(JWT_RE, "[REDACTED_JWT]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(ENV_ASSIGN_RE, (match) => {
      const sep = match.includes("=") ? "=" : ":";
      const name = match.split(/[:=]/)[0]?.trim() || "SECRET";
      return `${name}${sep}[REDACTED]`;
    });

  for (const secret of envSecretValues()) {
    if (out.includes(secret)) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return out;
}

/** Deep-redact objects/arrays/errors for console logging. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "function") return "[Function]";
  if (value instanceof Error) {
    return redactSensitiveString(describeErrorRaw(value));
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSensitive(nested, depth + 1);
    }
    return out;
  }
  try {
    return redactSensitiveString(String(value));
  } catch {
    return "[Unserializable]";
  }
}

function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function describeErrorRaw(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

// h3's HTTPError serializes to {"status":500,"unhandled":true,"message":"HTTPError"} —
// no stack, no cause — so a plain console.error(error) reaches the log pipeline with
// the failure detail stripped. Expand Error-like args into a string that keeps the
// message, stack, and the full cause chain — with secrets redacted.
export function describeError(error: unknown): string {
  return redactSensitiveString(describeErrorRaw(error));
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

type ConsoleMethod = (...args: unknown[]) => void;

function wrapConsoleMethod(method: "error" | "warn" | "log" | "info" | "debug") {
  const original = (console[method] as ConsoleMethod).bind(console);
  console[method] = (...args: unknown[]) => {
    const safe = args.map((arg) => {
      if (method === "error" && isErrorLike(arg)) {
        record(arg);
        return describeError(arg);
      }
      return redactSensitive(arg);
    });
    original(...safe);
  };
}

declare global {
  // Prevent double-wrapping under HMR / multiple entry imports.
  // eslint-disable-next-line no-var
  var __avighnaConsoleRedactionInstalled: boolean | undefined;
}

if (!globalThis.__avighnaConsoleRedactionInstalled) {
  globalThis.__avighnaConsoleRedactionInstalled = true;
  wrapConsoleMethod("error");
  wrapConsoleMethod("warn");
  wrapConsoleMethod("log");
  wrapConsoleMethod("info");
  wrapConsoleMethod("debug");
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
