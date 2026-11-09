import { describe, expect, it } from "vitest";
import { countsForRank, DEFAULT_RANKED } from "@/lib/ranked";
import { matchesCourse, getCourseDisplayName } from "@/lib/subjects";

describe("rank counting", () => {
  it("unplaced players only progress in ranked battles", () => {
    expect(countsForRank(false, { placementPlayed: 2 }, DEFAULT_RANKED)).toBe(false);
    expect(countsForRank(true, { placementPlayed: 2 }, DEFAULT_RANKED)).toBe(true);
  });
  it("placed players earn RP from every battle", () => {
    expect(countsForRank(false, { placed: true }, DEFAULT_RANKED)).toBe(true);
    expect(countsForRank(false, { placementPlayed: DEFAULT_RANKED.placementMatches }, DEFAULT_RANKED)).toBe(true);
  });
});

describe("course directory search", () => {
  const c = { name: "CHM101", fullName: "General Chemistry I" };
  it("finds a course by code or full name", () => {
    expect(matchesCourse(c, "chm 101")).toBe(true);
    expect(matchesCourse(c, "chemistry")).toBe(true);
    expect(matchesCourse(c, "physics")).toBe(false);
  });
  it("shows code with full name", () => {
    expect(getCourseDisplayName(c)).toBe("CHM101 — General Chemistry I");
    expect(getCourseDisplayName({ name: "MTH101" })).toBe("MTH101");
  });
});
