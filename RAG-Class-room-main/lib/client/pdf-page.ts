/**
 * pdf-page — small client-side pdfjs helpers shared by the Class Room's
 * textbook-based teaching flow.
 *
 * Same worker setup as PDFPagePicker / pdf-text (plain static file from
 * /public, kept in sync by the package.json postinstall script — see
 * components/PDFPagePicker.tsx for the full CDN/webpack history of why).
 */

async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = pdf.numPages;
  await (pdf as any).destroy?.();
  return n;
}

/**
 * Rasterise one page to a JPEG blob at EXPORT scale (2× — same scale
 * PDFPagePicker exports at for the vision model, which was verified to
 * read equations reliably at that resolution).
 */
export async function renderPdfPageToJpeg(
  file: File,
  pageNumber: number,   // 1-based
  scale = 2.0,
): Promise<Blob> {
  const pdfjsLib = await loadPdfjs();
  const pdf  = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width  = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport } as any).promise;

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, "image/jpeg", 0.85));
  await (pdf as any).destroy?.();
  if (!blob) throw new Error("Couldn't render the page.");
  return blob;
}

/**
 * Render the first few pages of a PDF (from raw bytes) to small JPEG
 * data-URLs — used by the shared-textbook browser so a student can SEE
 * pages 1-3 and confirm "yes, this is really my book" before choosing
 * to download it. Small scale on purpose: these are confirmation
 * thumbnails on a budget phone, not reading copies.
 */
export async function renderPdfPagesToDataUrls(
  data: ArrayBuffer,
  pages: number[],      // 1-based page numbers; out-of-range ones are skipped
  scale = 0.7,
): Promise<{ page: number; dataUrl: string }[]> {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out: { page: number; dataUrl: string }[] = [];
  for (const n of pages) {
    if (n < 1 || n > pdf.numPages) continue;
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width  = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport } as any).promise;
    out.push({ page: n, dataUrl: canvas.toDataURL("image/jpeg", 0.8) });
  }
  await (pdf as any).destroy?.();
  return out;
}
