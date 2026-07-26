import { NextResponse } from "next/server";
import { materialsStore } from "@/lib/materials-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/materials — list all materials (admin view, includes unpublished)
export async function GET() {
  return withApiErrorHandling("GET /api/admin/materials", async () =>
    NextResponse.json({ materials: await materialsStore.all() }),
  );
}

// POST /api/admin/materials — publish a new material entry
// Supports two shapes:
//   File-based (drive/gcs/vps): { title, source, sourceRef, fileType, ... }
//   Generated  (source="generated"): { title, source: "generated", content, materialKind, ... }
//   sourceRef is not required for generated materials — content is stored inline.
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/admin/materials", async () => {
    const body = await req.json();
    const { title, description = "", subject = "Maths", boards = [], grades = [], languages = [],
            fileType, source, sourceRef = "", sizeBytes = 0, content, materialKind } = body;

    if (!title || !source) {
      return NextResponse.json({ error: "title and source are required." }, { status: 400 });
    }
    if (source === "generated" && !content) {
      return NextResponse.json({ error: "content is required for generated materials." }, { status: 400 });
    }
    if (source !== "generated" && (!sourceRef || !fileType)) {
      return NextResponse.json({ error: "sourceRef and fileType are required for file-based materials." }, { status: 400 });
    }

    const item = await materialsStore.add({
      title, description, subject, boards, grades, languages,
      fileType: fileType || "text",
      source, sourceRef,
      content, materialKind,
      sizeBytes: sizeBytes || (content ? new TextEncoder().encode(content).length : 0),
      published: true, addedBy: "admin",   // TODO: real user id from session
    });
    return NextResponse.json({ material: item }, { status: 201 });
  });
}

// PATCH /api/admin/materials — update (toggle publish, re-tag, etc.)
export async function PATCH(req: Request) {
  return withApiErrorHandling("PATCH /api/admin/materials", async () => {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
    const updated = await materialsStore.update(id, patch);
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ material: updated });
  });
}

// DELETE /api/admin/materials?id=xxx
export async function DELETE(req: Request) {
  return withApiErrorHandling("DELETE /api/admin/materials", async () => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
    const ok = await materialsStore.remove(id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
