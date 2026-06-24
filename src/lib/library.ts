import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { LibraryState, PageText } from "./types";
import { isDesktop } from "./ai";

export const emptyLibrary: LibraryState = { version: 1, projects: [], documents: [] };

export async function loadLibrary() {
  return isDesktop() ? invoke<LibraryState>("library_state") : emptyLibrary;
}
export async function createProject(name: string) { return invoke<LibraryState>("create_project", { name }); }
export async function deleteProject(projectId: string) { return invoke<LibraryState>("delete_project", { projectId }); }
export async function addToProject(documentId: string, projectId: string) { return invoke<LibraryState>("add_document_to_project", { documentId, projectId }); }
export async function removeFromProject(documentId: string, projectId: string) { return invoke<LibraryState>("remove_document_from_project", { documentId, projectId }); }
export async function deleteDocument(documentId: string) { return invoke<LibraryState>("delete_document", { documentId }); }
export async function chooseAndImport(projectId?: string) {
  const path = await open({ multiple: false, filters: [{ name: "PDF documents", extensions: ["pdf"] }] });
  if (!path) return null;
  return invoke<LibraryState>("import_document", { sourcePath: path, projectId: projectId || null });
}
export async function readDocument(documentId: string) {
  const encoded = await invoke<string>("read_document", { documentId });
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
export async function saveIndex(documentId: string, pages: PageText[]) {
  return invoke<LibraryState>("save_document_index", { documentId, pages });
}
export async function loadIndex(documentId: string) {
  return invoke<PageText[]>("load_document_index", { documentId });
}
