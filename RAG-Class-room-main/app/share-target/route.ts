import { NextResponse } from "next/server";

// Always handle live — this receives a real POST navigation from the OS
// share sheet, never something to prerender.
export const dynamic = "force-dynamic";

const MAX_SHARE_BYTES = 4 * 1024 * 1024; // 4 MB — keeps the base64 handoff comfortably under typical sessionStorage per-origin quotas

/**
 * POST /share-target
 *
 * The actual receiving end of the PWA Web Share Target registered in
 * public/manifest.json. When a student downloads a textbook PDF from an
 * official government site (see /materials/textbooks) and taps Android's
 * Share button, choosing "AI Guru" sends the file here as a real
 * top-level POST navigation — this is why the handler returns HTML, not
 * JSON: the browser is navigating, not fetching.
 *
 * The file is small enough to hand off via a short client-side detour
 * (base64 in sessionStorage) straight into the classroom's existing
 * "Teach from textbook" upload pipeline — no new server-side storage,
 * no persistence needed for what's a one-time handoff.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return htmlRedirect("/materials/textbooks", "No file was shared.");
    }
    if (file.size > MAX_SHARE_BYTES) {
      return htmlRedirect(
        "/classroom",
        `That file is too large to share directly (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use "Teach from textbook" and upload it manually instead.`,
      );
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      return htmlRedirect("/classroom", "Only PDF, JPG, or PNG files can be shared in.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AI Guru</title></head>
<body style="background:#16241d;color:#f4f1e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <div style="font-size:14px;">Opening in AI Guru…</div>
  </div>
  <script>
    try {
      sessionStorage.setItem("gg_shared_file", JSON.stringify({
        base64: ${JSON.stringify(base64)},
        name: ${JSON.stringify(file.name || "shared-file")},
        type: ${JSON.stringify(file.type)},
      }));
      window.location.replace("/classroom?fromShare=1");
    } catch (e) {
      window.location.replace("/classroom");
    }
  </script>
</body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("[/share-target]", err);
    return htmlRedirect("/classroom", "Could not process the shared file.");
  }
}

function htmlRedirect(path: string, message: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AI Guru</title></head>
<body style="background:#16241d;color:#f4f1e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
  <div>${escapeHtml(message)}</div>
  <script>window.location.replace(${JSON.stringify(path)});</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
