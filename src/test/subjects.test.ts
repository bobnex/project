import { describe, expect, it } from "vitest";
import { resolveSubjects } from "@/lib/subjects";

describe("dynamic subjects", () => {
  it("adds a new subject like CHM101", () => {
    const r = resolveSubjects([{ id: "physics", name: "Physics" }], ["CHM101"]);
    expect(r.added).toEqual([{ id: "chm101", name: "CHM101" }]);
  });
  it("ignores duplicates regardless of casing and spaces", () => {
    const r = resolveSubjects([{ id: "chm101", name: "CHM101" }], ["  chm101 ", "Chm101", "new  subject", "New Subject"]);
    expect(r.added.map((a) => a.name)).toEqual(["new subject"]);
    expect(r.canonicalName(" chm101")).toBe("CHM101");
  });
});
