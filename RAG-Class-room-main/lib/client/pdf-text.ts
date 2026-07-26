/**
 * Extracts plain text from a single PDF page using pdfjs-dist's text content API.
 * Called client-side immediately after the user picks a page, so the server gets
 * both the rendered image AND the raw text — Claude uses the image as ground truth
 * but the text gives it a head start on equations and special characters.
 *
 * Returns empty string if the PDF is scanned (no text layer) or pdfjs fails.
 */
export async function extractPageText(
  file: File,
  pageNumber: number,   // 1-based
): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    // Plain static file from /public — see components/PDFPagePicker.tsx
    // for the full explanation of why (CDN URL 404s on version mismatch;
    // webpack asset bundling fails Next.js's production Terser pass on
    // `import.meta` inside the emitted .mjs). Kept in sync by the
    // "postinstall" script in package.json.
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page        = await pdf.getPage(pageNumber);
    const content     = await page.getTextContent();

    return content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{3,}/g, " ")
      .trim();
  } catch {
    return "";   // fail silently — image alone is still enough
  }
}
