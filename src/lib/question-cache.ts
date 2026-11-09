import { collection, getDocs, limit, query, where, type Firestore } from "firebase/firestore";
import { coursePickChunks, coursePickKey, parseCoursePick, type CoursePick } from "./course-pick";
import type { Question } from "./engine";

export const QUESTION_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const PREFIX = "fb_qcache_v1:";
const mem = new Map<string, { at: number; rows: Question[] }>();
const inflight = new Map<string, Promise<Question[]>>();

function read(key: string, now: number): Question[] | null {
  const m = mem.get(key);
  if (m && now - m.at < QUESTION_CACHE_TTL_MS) return m.rows;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREFIX + key) : null;
    if (raw) {
      const v = JSON.parse(raw) as { at: number; rows: Question[] };
      if (now - v.at < QUESTION_CACHE_TTL_MS) { mem.set(key, v); return v.rows; }
    }
  } catch {}
  return null;
}

function write(key: string, rows: Question[], now: number) {
  const v = { at: now, rows };
  mem.set(key, v);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(v)); } catch {}
}

function row(id: string, data: Omit<Question, "id">): Question {
  return { id, ...(data as Omit<Question, "id">) };
}

/** Active questions for one course or a stack of them (empty = every course), cached for 2 hours. */
export function getSubjectQuestions(db: Firestore, subject?: string | string[], now = Date.now()): Promise<Question[]> {
  const pick = parseCoursePick(subject);
  const key = coursePickKey(pick);
  const hit = read(key, now);
  if (hit) return Promise.resolve(hit);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetchQuestions(db, pick)
    .then((rows) => {
      write(key, rows, Date.now());
      return rows;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Pulls active questions for the picked courses. Several courses need one
 * `in` filter per 30 courses, and results are merged without repeats.
 */
async function fetchQuestions(db: Firestore, pick: CoursePick): Promise<Question[]> {
  if (!pick.length) {
    const snap = await getDocs(query(collection(db, "questions"), where("active", "==", true), limit(1000)));
    return snap.docs.map((d) => row(d.id, d.data() as Omit<Question, "id">));
  }
  const seen = new Set<string>();
  const rows: Question[] = [];
  for (const chunk of coursePickChunks(pick)) {
    const snap = await getDocs(
      query(collection(db, "questions"), where("active", "==", true), where("subject", "in", chunk), limit(1000)),
    );
    snap.docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      rows.push(row(d.id, d.data() as Omit<Question, "id">));
    });
  }
  return rows;
}

export function clearQuestionCache() {
  mem.clear();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {}
}
