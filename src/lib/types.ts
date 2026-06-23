export type Provider = "openai" | "anthropic" | "compatible" | "ollama";
export type Theme = "system" | "light" | "dark";
export type ExplainLevel = "very-simple" | "simple" | "detailed";

export interface Settings {
  provider: Provider;
  model: string;
  baseUrl: string;
  theme: Theme;
  hoverDefinitions: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: number[];
}

export interface PageText { page: number; text: string }
export interface Definition { partOfSpeech: string; text: string }
export interface Highlight { id: string; page: number; text: string; createdAt: number }
