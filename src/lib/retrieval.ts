import type { PageText } from "./types";

const stop = new Set("the a an and or but if then than to of in on at for from by with as is are was were be been being it this that these those i you we they he she not no do does did can could would should may might will what which who how why where when".split(" "));

export function tokens(text: string) {
  return [...new Set((text.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !stop.has(w)))];
}

export function retrieve(query: string, pages: PageText[], limit = 5): PageText[] {
  const terms = tokens(query);
  if (!terms.length) return pages.slice(0, limit);
  return pages.map(page => {
    const lower = page.text.toLowerCase();
    const score = terms.reduce((n, term) => n + (lower.split(term).length - 1), 0) / Math.max(1, Math.log(page.text.length));
    return { page, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.page);
}

export function contextBlock(pages: PageText[]) {
  return pages.map(p => `--- Page ${p.page} ---\n${p.text.slice(0, 7000)}`).join("\n\n");
}

export function parseCitations(text: string) {
  const found = [...text.matchAll(/\[p(?:age)?\.?\s*(\d+)\]/gi)].map(m => Number(m[1]));
  return [...new Set(found)];
}
