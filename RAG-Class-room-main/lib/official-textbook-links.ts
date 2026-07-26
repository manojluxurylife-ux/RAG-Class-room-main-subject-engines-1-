/**
 * Official government textbook portals — verified links only, no hosting.
 *
 * IMPORTANT: These are OUTBOUND links to each board's own official site.
 * AI Guru never downloads, mirrors, or hosts these PDFs itself.
 * NCERT's own terms are explicit: "No website or online service is
 * permitted to host these online textbooks." — the same restriction
 * applies in spirit to the state boards. Downloading and personal/
 * classroom use is freely permitted; redistribution is not.
 *
 * The actual flow: student clicks a link here → downloads the PDF on the
 * OFFICIAL government site (leaves our app entirely, as it must) → comes
 * back to AI Guru and uploads that PDF via the existing "Teach from
 * textbook" flow in /classroom, or shares it in directly via the PWA
 * Share Target (see public/manifest.json + app/share-target/route.ts).
 *
 * Verified July 2026 — government sites occasionally restructure; if a
 * link breaks, update the URL here (single source of truth, not scattered
 * across pages).
 */

export interface BoardPortal {
  boardId:      string;   // matches the syllabus/board IDs used everywhere else in the app
  boardLabel:   string;
  portalName:   string;
  url:          string;
  howTo:        string;   // short plain-language instructions specific to that portal's UI
}

export const OFFICIAL_TEXTBOOK_PORTALS: BoardPortal[] = [
  {
    boardId: "cbse",
    boardLabel: "CBSE (NCERT)",
    portalName: "NCERT — Textbooks (ncert.nic.in)",
    url: "https://ncert.nic.in/textbooks.php?ln=en",
    howTo: "Click \"Publications\" → \"E-books\" → \"PDF (I-XII)\", then pick your Class and Subject.",
  },
  {
    boardId: "kerala",
    boardLabel: "Kerala State Syllabus",
    portalName: "Samagra — SCERT Kerala (samagra.kite.kerala.gov.in)",
    url: "https://samagra.kite.kerala.gov.in/#/textbook/page",
    howTo: "Select your Class, then Medium (Malayalam/English), then Subject to see the download link.",
  },
  {
    boardId: "tamilnadu",
    boardLabel: "Tamil Nadu State Board",
    portalName: "Tamil Nadu Textbook Corporation (textbookcorp.tn.gov.in)",
    url: "https://textbookcorp.tn.gov.in/textbook1.php",
    howTo: "Choose your Class and Medium (Tamil/English) to find the textbook PDF.",
  },
  {
    boardId: "karnataka",
    boardLabel: "Karnataka State Board",
    portalName: "Karnataka Textbook Society (textbooks.karnataka.gov.in)",
    url: "https://textbooks.karnataka.gov.in/en",
    howTo: "Select \"Text Book Online\", then your Class, Medium, and Subject.",
  },
];

export function portalForBoard(boardId: string): BoardPortal | undefined {
  return OFFICIAL_TEXTBOOK_PORTALS.find(p => p.boardId === boardId);
}
