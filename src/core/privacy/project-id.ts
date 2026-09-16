import { createHash } from "node:crypto";
import path from "node:path";
import { normalizePathForCompare } from "../../utils/platform.js";

export interface ProjectIdentity {
  projectKey: string;
  projectBasename: string;
}

export function projectIdentityFromPath(projectPath: string): ProjectIdentity {
  const normalized = normalizePathForCompare(projectPath).replace(/\/+$/, "");
  const projectKey = createHash("sha256")
    .update(normalized.toLowerCase())
    .digest("hex")
    .slice(0, 16);
  const projectBasename = path.posix.basename(normalized) || path.basename(projectPath);
  return { projectKey, projectBasename };
}
