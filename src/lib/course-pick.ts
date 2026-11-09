// Pure helpers for picking one or more courses (no React, no database) so the
// selection rules stay unit-testable.

/** Stored value used when every course is in play. */
export const ALL_COURSES = "all";

/** Picked course names; an empty list means every course. */
export type CoursePick = string[];

/** Firestore allows at most 30 values in one `in` filter. */
export const COURSE_IN_CHUNK = 30;

/** Max courses a player may stack into one battle or tournament. */
export const MAX_COURSES = 30;

function clean(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function has(list: CoursePick, name: string): boolean {
  return list.some((n) => n.toLowerCase() === name.toLowerCase());
}

/**
 * Reads a stored selection — "all", "CHM101", "CHM101, MTH201", an array, or
 * nothing — into a clean, deduped list of course names.
 */
export function parseCoursePick(value: unknown): CoursePick {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? ALL_COURSES);
  const pick: CoursePick = [];
  for (const part of raw.split(",")) {
    const name = clean(part);
    if (!name || name.toLowerCase() === ALL_COURSES) continue;
    if (!has(pick, name)) pick.push(name);
  }
  return pick;
}

/** Writes a selection back to its stored form: "all" or a comma-joined list. */
export function formatCoursePick(pick: CoursePick): string {
  return pick.length ? pick.join(", ") : ALL_COURSES;
}

/** True when two selections cover exactly the same courses, in any order. */
export function sameCoursePick(a: CoursePick, b: CoursePick): boolean {
  return a.length === b.length && a.every((n) => has(b, n));
}

/** Order-independent key so the same course stack reuses one cache entry. */
export function coursePickKey(pick: CoursePick): string {
  return pick.length ? [...pick].sort((a, b) => a.localeCompare(b)).join(",") : ALL_COURSES;
}

/** Short label: "All courses", "CHM101", or "CHM101 +2 more". */
export function coursePickLabel(pick: CoursePick, allLabel = "All courses"): string {
  if (!pick.length) return allLabel;
  if (pick.length === 1) return pick[0];
  return `${pick[0]} +${pick.length - 1} more`;
}

/** Splits a selection into chunks small enough for a Firestore `in` filter. */
export function coursePickChunks(pick: CoursePick, size = COURSE_IN_CHUNK): CoursePick[] {
  const out: CoursePick[] = [];
  for (let i = 0; i < pick.length; i += size) out.push(pick.slice(i, i + size));
  return out;
}

/** Adds a course when absent, removes it when present, and refuses to exceed MAX_COURSES. */
export function toggleCourse(pick: CoursePick, name: string): CoursePick {
  const cleanName = clean(name);
  if (!cleanName) return pick;
  if (has(pick, cleanName)) return pick.filter((n) => n.toLowerCase() !== cleanName.toLowerCase());
  if (pick.length >= MAX_COURSES) return pick;
  return [...pick, cleanName];
}
