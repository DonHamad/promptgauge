import path from "node:path";

export function resolveCliEntry(explicit?: string): string {
  if (explicit && explicit.length > 0) {
    return path.resolve(explicit);
  }
  const argv1 = process.argv[1];
  if (argv1 && argv1.length > 0) {
    return path.resolve(argv1);
  }
  return path.resolve(".");
}
