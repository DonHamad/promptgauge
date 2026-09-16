const SENSITIVE_KEY = /(token|secret|password|credential|authorization|cookie|oauth|key)$/i;

export function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = redactRecord(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function looksLikeSecretFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("credential") ||
    lower.includes(".env") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  );
}
