/**
 * Filter and matching utilities for PASAYA inventory
 * Handles multi-department/line tokens, whitespace trimming, and exact matching
 * to prevent data leakage across departments/sections.
 */

// Splits a string by common multi-value delimiters: comma, slash, semicolon, plus, pipe, newline
export function parseTokens(val: string | undefined | null): string[] {
  if (!val) return [];
  return val
    .split(/[,/;\+|\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s !== "-");
}

/**
 * Checks if a candidate line string matches a target line.
 * Exact token matching prevents "1" matching "10", or "ส่วน" matching "ส่วนตัด"
 */
export function matchesLine(
  candidateLine: string | undefined | null,
  targetLine: string | undefined | null
): boolean {
  if (!targetLine || targetLine === "all" || targetLine.toLowerCase() === "all") {
    return true;
  }
  if (!candidateLine || !candidateLine.trim()) return false;

  const targetClean = targetLine.trim().toLowerCase();
  if (targetClean === "all") return true;

  const candidateClean = candidateLine.trim().toLowerCase();
  if (candidateClean === targetClean) return true;

  const tokens = parseTokens(candidateClean);
  return tokens.includes(targetClean);
}

/**
 * Checks if a candidate line matches any of the target lines in a multi-select filter
 */
export function matchesLineMulti(
  candidateLine: string | undefined | null,
  targetLines: string[] | undefined | null
): boolean {
  if (
    !targetLines ||
    targetLines.length === 0 ||
    targetLines.includes("all") ||
    targetLines.includes("ALL")
  ) {
    return true;
  }
  return targetLines.some((tl) => matchesLine(candidateLine, tl));
}

/**
 * Checks if a candidate attribute (category, supplier, location) matches target
 */
export function matchesExactOrToken(
  candidate: string | undefined | null,
  target: string | undefined | null
): boolean {
  if (!target || target === "all" || target.toLowerCase() === "all") {
    return true;
  }
  if (!candidate || !candidate.trim()) return false;

  const targetClean = target.trim().toLowerCase();
  if (targetClean === "all") return true;

  const candidateClean = candidate.trim().toLowerCase();
  if (candidateClean === targetClean) return true;

  const tokens = parseTokens(candidateClean);
  return tokens.includes(targetClean);
}

/**
 * Checks if a candidate attribute matches any of target values in multi-select filter
 */
export function matchesExactOrTokenMulti(
  candidate: string | undefined | null,
  targets: string[] | undefined | null
): boolean {
  if (
    !targets ||
    targets.length === 0 ||
    targets.includes("all") ||
    targets.includes("ALL")
  ) {
    return true;
  }
  return targets.some((t) => matchesExactOrToken(candidate, t));
}
