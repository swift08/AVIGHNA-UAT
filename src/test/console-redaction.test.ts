import { describe, expect, it } from "vitest";
import { redactSensitive, redactSensitiveString } from "@/lib/error-capture";

describe("console secret redaction", () => {
  it("redacts JWTs and bearer tokens in strings", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturepart";
    expect(redactSensitiveString(`key=${jwt}`)).toContain("[REDACTED_JWT]");
    expect(redactSensitiveString(`Authorization: Bearer ${jwt}`)).not.toContain(jwt);
    expect(redactSensitiveString(`Authorization: Bearer ${jwt}`)).toMatch(/Bearer \[REDACTED/);
  });

  it("redacts sensitive object keys", () => {
    const redacted = redactSensitive({
      password: "Password@123",
      token: "abc123secret",
      service_role: "super-secret",
      email: "owner@avighna.com",
    }) as Record<string, unknown>;
    expect(redacted["password"]).toBe("[REDACTED]");
    expect(redacted["token"]).toBe("[REDACTED]");
    expect(redacted["service_role"]).toBe("[REDACTED]");
    expect(redacted["email"]).toBe("owner@avighna.com");
  });

  it("redacts env-style key assignments", () => {
    expect(
      redactSensitiveString("SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb"),
    ).toMatch(/SUPABASE_SERVICE_ROLE_KEY=\[REDACTED\]/);
  });
});
