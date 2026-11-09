import { describe, expect, it } from "vitest";
import {
  coursePickChunks,
  coursePickKey,
  coursePickLabel,
  formatCoursePick,
  MAX_COURSES,
  parseCoursePick,
  sameCoursePick,
  toggleCourse,
} from "@/lib/course-pick";

describe("multi-course selection", () => {
  it("treats a stored 'all' and an empty selection as every course", () => {
    expect(parseCoursePick("all")).toEqual([]);
    expect(parseCoursePick(undefined)).toEqual([]);
    expect(sameCoursePick(parseCoursePick("all"), parseCoursePick([]))).toBe(true);
    expect(coursePickLabel([])).toBe("All courses");
  });

  it("reads a single course out of the old single-course format", () => {
    expect(parseCoursePick("CHM101")).toEqual(["CHM101"]);
    expect(coursePickLabel(parseCoursePick("CHM101"))).toBe("CHM101");
  });

  it("splits a comma list, keeps the first spelling and drops repeats", () => {
    expect(parseCoursePick("CHM101, mth201, chm101")).toEqual(["CHM101", "mth201"]);
    expect(parseCoursePick(["CHM101", "all", " MTH201 "])).toEqual(["CHM101", "MTH201"]);
    expect(coursePickLabel(["CHM101", "MTH201", "BIO101"])).toBe("CHM101 +2 more");
  });

  it("stores a selection as 'all' or a comma list and reads it back unchanged", () => {
    expect(formatCoursePick([])).toBe("all");
    expect(formatCoursePick(["CHM101", "MTH201"])).toBe("CHM101, MTH201");
    expect(parseCoursePick(formatCoursePick(["CHM101", "MTH201"]))).toEqual(["CHM101", "MTH201"]);
  });

  it("only pairs players whose course stack matches exactly, in any order", () => {
    expect(sameCoursePick(["CHM101", "MTH201"], ["MTH201", "CHM101"])).toBe(true);
    expect(sameCoursePick(["CHM101"], ["CHM101", "MTH201"])).toBe(false);
    expect(sameCoursePick(["CHM101"], ["chm101"])).toBe(true);
  });

  it("caches one course stack under the same key whatever order it was picked in", () => {
    expect(coursePickKey(["MTH201", "CHM101"])).toBe(coursePickKey(["CHM101", "MTH201"]));
    expect(coursePickKey([])).toBe("all");
  });

  it("splits a big selection into Firestore-sized chunks of 30", () => {
    const many = Array.from({ length: 31 }, (_, i) => `C${i}`);
    expect(coursePickChunks(many).map((c) => c.length)).toEqual([30, 1]);
    expect(coursePickChunks([])).toEqual([]);
  });

  it("adds a course, removes it again, and stops at the limit", () => {
    expect(toggleCourse([], "CHM101")).toEqual(["CHM101"]);
    expect(toggleCourse(["CHM101", "MTH201"], "chm101")).toEqual(["MTH201"]);
    const full = Array.from({ length: MAX_COURSES }, (_, i) => `C${i}`);
    expect(toggleCourse(full, "NEW101")).toEqual(full);
  });
});
