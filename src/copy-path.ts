import type { Row } from "./types";
import { expandPath } from "./utils";

export function copyableRepoPath(row: Row | undefined) {
  if (!row?.target.path || row.target.kind === "session") {
    return undefined;
  }

  return expandPath(row.target.path);
}
