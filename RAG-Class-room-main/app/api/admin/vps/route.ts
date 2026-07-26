import { NextResponse } from "next/server";
import { listVPSFiles } from "@/lib/storage/vps";

// GET /api/admin/vps?subfolder=maths/class8
export async function GET(req: Request) {
  const subfolder = new URL(req.url).searchParams.get("subfolder") || "";
  try {
    const files = listVPSFiles(subfolder);
    return NextResponse.json({ files });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
