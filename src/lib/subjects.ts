// Single source of truth for subjects: the Firestore "subjects" collection.
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, writeBatch, type Firestore } from "firebase/firestore";

export interface Subject {
  id: string;
  name: string;
  /** Admin-written full course title, e.g. "General Chemistry I" for CHM101. */
  fullName?: string;
  /** CBT settings (optional; defaults come from cbt-rules). */
  cbtDuration?: number;
  cbtQuestionCount?: number;
  cbtPassMark?: number;
  cbtEnabled?: boolean;
  cbtInstructions?: string;
}

export function cleanSubjectFullName(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

/** "CHM101 — General Chemistry I" when a full name exists, otherwise just the code. */
export function getCourseDisplayName(s: Pick<Subject, "name" | "fullName">): string {
  const full = cleanSubjectFullName(s.fullName ?? "");
  return full && full.toLowerCase() !== s.name.toLowerCase() ? `${s.name} — ${full}` : s.name;
}

/** Matches a search term against both the course code and full name. */
export function matchesCourse(s: Pick<Subject, "name" | "fullName">, term: string): boolean {
  const t = term.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return true;
  return [s.name, s.fullName ?? ""].some((v) => v.toLowerCase().replace(/\s+/g, "").includes(t));
}

export function cleanSubjectName(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

/** Case/space-insensitive key used as the document id, so duplicates are impossible. */
export function subjectKey(name: string): string {
  return cleanSubjectName(name).toLowerCase().replace(/[\/.#$[\]]/g, "_");
}

/** Returns names not yet known (deduped), keyed by subjectKey, plus a map to canonical names. */
export function resolveSubjects(existing: Subject[], names: string[]) {
  const canonical = new Map<string, string>(existing.map((s) => [s.id, s.name]));
  const added: Subject[] = [];
  for (const raw of names) {
    const name = cleanSubjectName(raw);
    if (!name) continue;
    const id = subjectKey(name);
    if (canonical.has(id)) continue;
    canonical.set(id, name);
    added.push({ id, name });
  }
  return { added, canonicalName: (n: string) => canonical.get(subjectKey(n)) ?? cleanSubjectName(n) };
}

/** Saves any new subjects to Firestore and returns a function mapping a name to its stored spelling. */
export async function registerSubjects(db: Firestore, existing: Subject[], names: string[]) {
  const r = resolveSubjects(existing, names);
  if (r.added.length) {
    const b = writeBatch(db);
    r.added.forEach((s) => b.set(doc(db, "subjects", s.id), { name: s.name, createdAt: Date.now() }, { merge: true }));
    await b.commit();
  }
  return r;
}

export function useSubjects(db: Firestore | null | undefined): Subject[] {
  const [list, setList] = useState<Subject[]>([]);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      collection(db, "subjects"),
      (s) =>
        setList(
          s.docs
            .map((d) => ({ ...(d.data() as Partial<Subject>), id: d.id, name: String(d.data().name ?? d.id) }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      () => {},
    );
  }, [db]);
  return list;
}
