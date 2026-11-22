/** Returns an error message when any required value is empty / invalid after trim. */
export function missingRequired(
  fields: Array<{ label: string; value: unknown }>,
): string | null {
  for (const field of fields) {
    const raw = field.value;
    if (raw === null || raw === undefined) {
      return `${field.label} is required.`;
    }
    if (typeof raw === "string" && !raw.trim()) {
      return `${field.label} is required.`;
    }
    if (typeof raw === "number" && !Number.isFinite(raw)) {
      return `${field.label} is required.`;
    }
  }
  return null;
}

/** Phone must have at least 8 digits (spaces/symbols ignored). */
export function missingPhone(label: string, value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8) {
    return `${label} is required (enter a valid phone number).`;
  }
  return null;
}
