import type { Definition } from "./types";

type Pos = "noun" | "verb" | "adj" | "adv";
const labels: Record<Pos, string> = { noun: "noun", verb: "verb", adj: "adjective", adv: "adverb" };
const indexCache = new Map<Pos, Map<string, number[]>>();
const dataCache = new Map<Pos, string>();

async function loadIndex(pos: Pos) {
  if (indexCache.has(pos)) return indexCache.get(pos)!;
  const text = await fetch(`/wordnet/index.${pos}`).then(r => {
    if (!r.ok) throw new Error("Offline dictionary files are unavailable");
    return r.text();
  });
  const map = new Map<string, number[]>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith(" ")) continue;
    const fields = line.trim().split(/\s+/);
    const synsets = Number(fields[2]);
    const pointers = Number(fields[3]);
    const offsetStart = 6 + pointers;
    map.set(fields[0], fields.slice(offsetStart, offsetStart + synsets).map(Number));
  }
  indexCache.set(pos, map);
  return map;
}

async function loadData(pos: Pos) {
  if (dataCache.has(pos)) return dataCache.get(pos)!;
  const text = await fetch(`/wordnet/data.${pos}`).then(r => r.text());
  dataCache.set(pos, text);
  return text;
}

function parseGloss(data: string, offset: number) {
  const line = data.slice(offset, data.indexOf("\n", offset));
  const gloss = line.split(" | ")[1];
  if (!gloss) return null;
  return gloss.split("; \"")[0].trim().replace(/^"|"$/g, "");
}

export async function define(raw: string): Promise<Definition[]> {
  const word = raw.toLowerCase().replace(/[^a-z'-]/g, "").replace(/-/g, "_");
  if (word.length < 2 || word.length > 40) return [];
  const results: Definition[] = [];
  for (const pos of ["noun", "verb", "adj", "adv"] as Pos[]) {
    const index = await loadIndex(pos);
    let offsets = index.get(word);
    if (!offsets) {
      const stems = word.endsWith("ies") ? [word.slice(0, -3) + "y"] : word.endsWith("ing") ? [word.slice(0, -3), word.slice(0, -3) + "e"] : word.endsWith("ed") ? [word.slice(0, -2), word.slice(0, -1)] : word.endsWith("s") ? [word.slice(0, -1)] : [];
      offsets = stems.map(s => index.get(s)).find(Boolean);
    }
    if (!offsets) continue;
    const data = await loadData(pos);
    for (const offset of offsets.slice(0, 2)) {
      const text = parseGloss(data, offset);
      if (text) results.push({ partOfSpeech: labels[pos], text });
    }
  }
  return results.slice(0, 5);
}
