import type { ChatMessage, Highlight, Settings } from "./types";

export const defaults: Settings = {
  provider: "openai",
  model: "gpt-5-mini",
  baseUrl: "",
  theme: "system",
  hoverDefinitions: true
};

export function loadSettings(): Settings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem("clarus:settings") || "{}") }; }
  catch { return defaults; }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem("clarus:settings", JSON.stringify(settings));
}

export function documentId(name: string, size: number) {
  return `${name}:${size}`.replace(/[^a-z0-9:._-]/gi, "_");
}

export function loadChat(id: string): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(`clarus:chat:${id}`) || "[]"); }
  catch { return []; }
}

export function saveChat(id: string, messages: ChatMessage[]) {
  localStorage.setItem(`clarus:chat:${id}`, JSON.stringify(messages.slice(-80)));
}

export function clearChat(id: string) { localStorage.removeItem(`clarus:chat:${id}`); }

export function loadHighlights(id: string): Highlight[] {
  try { return JSON.parse(localStorage.getItem(`clarus:highlights:${id}`) || "[]"); }
  catch { return []; }
}

export function saveHighlights(id: string, highlights: Highlight[]) {
  localStorage.setItem(`clarus:highlights:${id}`, JSON.stringify(highlights));
}
