import { useState } from "react";
import { Check, ChevronsUpDown, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getCourseDisplayName, type Subject } from "@/lib/subjects";
import { coursePickLabel, MAX_COURSES, toggleCourse, type CoursePick } from "@/lib/course-pick";

interface Props {
  /** Picked course names; empty means every course. */
  value: CoursePick;
  onChange: (value: CoursePick) => void;
  subjects: Subject[];
  allLabel?: string;
  className?: string;
}

/** Searchable course picker that lets several courses be stacked at once. */
export function CourseMultiSelect({ value, onChange, subjects, allLabel = "All courses", className }: Props) {
  const [open, setOpen] = useState(false);
  const isPicked = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase());
  const full = value.length >= MAX_COURSES;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Pick courses"
            className="w-full max-w-64 justify-between rounded-xl font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Layers className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{coursePickLabel(value, allLabel)}</span>
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search courses…" className="h-9" />
            <CommandList className="max-h-64">
              <CommandEmpty>No course matches your search.</CommandEmpty>
              <CommandGroup>
                {subjects.map((s) => {
                  const on = isPicked(s.name);
                  return (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.fullName ?? ""}`}
                      onSelect={() => onChange(toggleCourse(value, s.name))}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="truncate">{getCourseDisplayName(s)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-border flex items-center justify-between gap-2 border-t p-2">
            <span className="text-muted-foreground text-xs">
              {value.length ? `${value.length} of ${subjects.length} picked` : `Every course`}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                All
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(toggleCourse(value, v))}
              aria-label={`Remove ${v}`}
              className="border-primary/25 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
            >
              {v}
              <X className="size-3" />
            </button>
          ))}
          {full && <span className="text-muted-foreground text-xs">Maximum {MAX_COURSES} courses.</span>}
        </div>
      )}
    </div>
  );
}
