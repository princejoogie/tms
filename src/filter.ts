import type { Row } from "./types";

export function filterRows(rows: Row[], query: string): Row[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return rows;
  }

  const matched = new Set<string>();
  for (const row of rows) {
    const search = row.filterText.toLowerCase();
    if (tokens.every((token) => fuzzyMatch(search, token))) {
      matched.add(row.id);
      if (row.parentId) {
        matched.add(row.parentId);
      }
    }
  }

  return rows.filter((row) => matched.has(row.id));
}

function fuzzyMatch(search: string, token: string) {
  let searchIndex = 0;

  for (const char of token) {
    searchIndex = search.indexOf(char, searchIndex);
    if (searchIndex === -1) {
      return false;
    }
    searchIndex += char.length;
  }

  return true;
}
