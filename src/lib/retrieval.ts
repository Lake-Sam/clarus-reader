import type { Citation, LibraryDocument, PageText } from "./types";

const stop = new Set("the a an and or but if then than to of in on at for from by with as is are was were be been being it this that these those i you we they he she not no do does did can could would should may might will what which who how why where when explain describe discuss document book author".split(" "));
export function tokens(text: string) { return [...new Set((text.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !stop.has(w)))]; }

export interface IndexedDocument { document: LibraryDocument; pages: PageText[] }
export interface Evidence { citation: Citation; text: string; score: number }

function passage(text: string, terms: string[], length = 360) {
  const lower = text.toLowerCase();
  const hit = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 100);
  const slice = text.slice(start, start + length).replace(/\s+/g, " ").trim();
  return `${start ? "…" : ""}${slice}${start + length < text.length ? "…" : ""}`;
}

export function retrieveLibrary(query: string, documents: IndexedDocument[], limit = 12): Evidence[] {
  const terms = tokens(query);
  const rows = documents.flatMap(({ document, pages }) => pages.map(page => {
    const lower = page.text.toLowerCase();
    const frequencies = terms.map(term => lower.split(term).length - 1);
    const matched = frequencies.filter(Boolean).length;
    const score = frequencies.reduce((sum, n) => sum + Math.log1p(n), 0) + matched * 1.7;
    return { document, page, score: score / Math.max(1, Math.log(page.text.length + 10)) };
  }));
  const ranked = rows.filter(row => terms.length ? row.score > 0 : true).sort((a, b) => b.score - a.score);
  const diversified: typeof ranked = [];
  const perDocument = new Map<string, number>();
  for (const row of ranked) {
    if ((perDocument.get(row.document.id) || 0) >= Math.max(3, Math.ceil(limit / Math.max(1, documents.length)))) continue;
    diversified.push(row); perDocument.set(row.document.id, (perDocument.get(row.document.id) || 0) + 1);
    if (diversified.length >= limit) break;
  }
  return diversified.map(row => ({
    score: row.score,
    text: row.page.text,
    citation: { documentId: row.document.id, documentName: row.document.name, page: row.page.page, passage: passage(row.page.text, terms) }
  }));
}

export function contextBlock(evidence: Evidence[] | PageText[]) {
  return evidence.map(item => "citation" in item ? `--- SOURCE ${item.citation.documentId} | ${item.citation.documentName} | Page ${item.citation.page} ---\n${item.text.slice(0, 5200)}` : `--- Page ${item.page} ---\n${item.text.slice(0, 5200)}`).join("\n\n");
}

export function broadContext(documents: IndexedDocument[], maxCharacters = 90000) {
  const pages = documents.flatMap(item => item.pages.map(page => ({ document: item.document, page })));
  const allowance = Math.max(180, Math.floor(maxCharacters / Math.max(1, pages.length)));
  return pages.map(({ document, page }) => `--- SOURCE ${document.id} | ${document.name} | Page ${page.page} ---\n${page.text.slice(0, allowance)}`).join("\n\n");
}

export function isBroadQuestion(query: string) { return /\b(summar|outline|overall|central argument|whole|entire|structure|compare)\b/i.test(query); }

export function parseGroundedAnswer(raw: string, evidence: Evidence[]) {
  try {
    const clean = raw.replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(clean) as { answer?: string; basis?: string; support?: { documentId: string; page: number }[] };
    const allowed = new Map(evidence.map(item => [`${item.citation.documentId}:${item.citation.page}`, item.citation]));
    const citations = (parsed.support || []).map(item => allowed.get(`${item.documentId}:${item.page}`)).filter(Boolean) as Citation[];
    const basis = (["direct", "inference", "insufficient"].includes(parsed.basis || "") ? parsed.basis : citations.length ? "direct" : "insufficient") as "direct" | "inference" | "insufficient";
    return { content: parsed.answer || raw, basis, citations: basis === "insufficient" ? [] : citations.length ? citations : evidence.slice(0, 3).map(item => item.citation) };
  } catch { return { content: raw, basis: "inference" as const, citations: evidence.slice(0, 3).map(item => item.citation) }; }
}

// Kept for compatibility with focused search and existing tests.
export function retrieve(query: string, pages: PageText[], limit = 5) {
  const document = { id: "current", name: "Current document", size: 0, importedAt: 0, pageCount: pages.length, indexed: true };
  return retrieveLibrary(query, [{ document, pages }], limit).map(item => ({ page: item.citation.page, text: item.text }));
}
export function parseCitations(text: string) { return [...new Set([...text.matchAll(/\[p(?:age)?\.?\s*(\d+)\]/gi)].map(match => Number(match[1])))]; }
