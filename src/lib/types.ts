export type Provider = "openai" | "anthropic" | "compatible" | "ollama";
export type Theme = "system" | "light" | "dark";
export type ExplainLevel = "very-simple" | "simple" | "detailed";

export interface Settings {
  provider: Provider;
  model: string;
  visionModel: string;
  baseUrl: string;
  theme: Theme;
  hoverDefinitions: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  basis?: "direct" | "inference" | "external" | "insufficient";
}

export interface PageText { page: number; text: string }
export type ChatSourceMode = "document" | "project" | "external";
export interface Citation { documentId: string; documentName: string; page: number; passage: string }
export interface LibraryDocument { id: string; name: string; size: number; importedAt: number; pageCount: number; indexed: boolean }
export interface LibraryProject { id: string; name: string; documentIds: string[]; createdAt: number }
export interface LibraryState { version: number; projects: LibraryProject[]; documents: LibraryDocument[] }
export interface Definition { partOfSpeech: string; text: string }
export interface Highlight { id: string; page: number; text: string; createdAt: number }
