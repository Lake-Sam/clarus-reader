import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Provider, Settings } from "./types";

export function isDesktop() { return "__TAURI_INTERNALS__" in window; }

export async function saveKey(provider: Provider, key: string) {
  if (!isDesktop()) throw new Error("API keys can only be saved in the installed desktop app.");
  return invoke("save_api_key", { provider, key });
}
export async function deleteKey(provider: Provider) {
  if (isDesktop()) await invoke("delete_api_key", { provider });
}
export async function hasKey(provider: Provider) {
  if (provider === "ollama") return true;
  return isDesktop() ? invoke<boolean>("has_api_key", { provider }) : false;
}

export async function complete(settings: Settings, system: string, messages: ChatMessage[], imageDataUrl?: string) {
  if (!isDesktop()) throw new Error("AI requests run through Clarus’s secure desktop process. Use the installed app to connect a model.");
  return invoke<string>("complete_ai", {
    request: {
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl || null,
      system,
      imageDataUrl: imageDataUrl || null,
      messages: messages.map(({ role, content }) => ({ role, content }))
    }
  });
}
