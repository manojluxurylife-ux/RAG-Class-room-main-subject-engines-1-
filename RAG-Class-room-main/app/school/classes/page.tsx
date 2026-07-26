import Link from "next/link";
import { Button, Card, PageHeader } from "@/components/ui";

// TODO: replace with real query against the school's classes
const CLASSES = [
  { id: "cl1", name: "Class 8 — Section A", students: 32, board: "Kerala State Syllabus" },
  { id: "cl2", name: "Class 7 — Section B", students: 28, board: "CBSE (NCERT)" },
];

export default function ClassesPage() {
  return (
    <div>
      <PageHeader eyebrow="Classes" title="Class rosters" />
      <div className="flex flex-col gap-3">
        {CLASSES.map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg text-chalk">{c.name}</div>
              <div className="text-xs text-chalkdim">
                {c.students} students · {c.board}
              </div>
            </div>
            <Link href={`/school/classes/${c.id}/students`}>
              <Button variant="ghost">View roster</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
