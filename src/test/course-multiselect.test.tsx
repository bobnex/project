import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CourseMultiSelect } from "@/components/game/course-multiselect";
import type { Subject } from "@/lib/subjects";

const SUBJECTS: Subject[] = [
  { id: "chm101", name: "CHM101", fullName: "General Chemistry I" },
  { id: "mth201", name: "MTH201", fullName: "Calculus II" },
  { id: "bio101", name: "BIO101" },
];

/** Keeps the picker's own selection in state, the way a page would. */
function Harness({ onChange }: { onChange: (v: string[]) => void }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <CourseMultiSelect
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      subjects={SUBJECTS}
    />
  );
}

describe("picking several courses at once", () => {
  it("starts on every course", () => {
    render(<CourseMultiSelect value={[]} onChange={() => {}} subjects={SUBJECTS} />);
    expect(screen.getByRole("combobox", { name: "Pick courses" })).toHaveTextContent("All courses");
  });

  it("stacks two courses, shows both, and drops one again", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Pick courses" }));
    fireEvent.click(await screen.findByText("CHM101 — General Chemistry I"));
    fireEvent.click(await screen.findByText("MTH201 — Calculus II"));

    expect(onChange).toHaveBeenLastCalledWith(["CHM101", "MTH201"]);
    expect(screen.getByRole("combobox", { name: "Pick courses" })).toHaveTextContent("CHM101 +1 more");
    expect(screen.getByRole("button", { name: "Remove MTH201" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove MTH201" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["CHM101"]));
    expect(screen.queryByRole("button", { name: "Remove MTH201" })).not.toBeInTheDocument();
  });

  it("finds a course by its full name while picking", async () => {
    render(<Harness onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Pick courses" }));
    fireEvent.change(screen.getByPlaceholderText("Search courses…"), { target: { value: "chemistry" } });

    expect(await screen.findByText("CHM101 — General Chemistry I")).toBeInTheDocument();
    expect(screen.queryByText("MTH201 — Calculus II")).not.toBeInTheDocument();
  });
});
