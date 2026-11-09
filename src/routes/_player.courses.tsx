import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { getCourseDisplayName, matchesCourse, useSubjects } from "@/lib/subjects";
import { cbtSettings } from "@/lib/cbt-rules";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/courses")({
  head: () => pageMeta("Course Directory", "Browse available courses and their full names."),
  component: CourseDirectory,
});

function CourseDirectory() {
  const { fb } = useApp();
  const subjects = useSubjects(fb?.db);
  const [search, setSearch] = useState("");
  const courses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return subjects.filter((course) =>
      matchesCourse(course, term),
    );
  }, [subjects, search]);

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="size-5" /> Course Directory</h2>
        <p className="text-muted-foreground text-sm">Browse every course available on the website. Course codes and full names are managed by an admin.</p>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input className="pl-9" placeholder="Search by course code or full name" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>

      {courses.length === 0 ? (
        <Empty icon={BookOpen} title={subjects.length ? "No matching courses" : "No courses available"} text={subjects.length ? "Try a different search term." : "Courses added by the admin will appear here."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => {
            const availableForCbt = cbtSettings(course).enabled;
            return (
              <article key={course.id} className="surface-card flex flex-col gap-3 p-4">
                <div>
                  <h3 className="font-bold">{getCourseDisplayName(course)}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">Course code: {course.name}</p>
                </div>
                {availableForCbt ? (
                  <Button asChild className="mt-auto"><Link to="/cbt/$courseId" params={{ courseId: course.id }}>Start CBT practice</Link></Button>
                ) : (
                  <p className="text-muted-foreground mt-auto text-xs">CBT practice is not enabled for this course yet.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
