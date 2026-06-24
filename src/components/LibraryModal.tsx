import { useMemo, useState } from "react";
import { BookOpen, FilePlus2, Folder, FolderPlus, Trash2, X } from "lucide-react";
import { addToProject, chooseAndImport, createProject, deleteDocument, deleteProject, removeFromProject } from "../lib/library";
import type { LibraryDocument, LibraryState } from "../lib/types";

export default function LibraryModal({ library, selectedProjectId, onProject, onLibrary, onOpen, onClose }: {
  library: LibraryState; selectedProjectId: string; onProject: (id: string) => void; onLibrary: (state: LibraryState) => void; onOpen: (document: LibraryDocument) => void; onClose: () => void;
}) {
  const [newProject, setNewProject] = useState("");
  const [adding, setAdding] = useState("");
  const assigned = useMemo(() => new Set(library.projects.flatMap(project => project.documentIds)), [library]);
  const documents = selectedProjectId === "unfiled" ? library.documents.filter(document => !assigned.has(document.id)) : library.documents.filter(document => library.projects.find(project => project.id === selectedProjectId)?.documentIds.includes(document.id));
  const currentProject = library.projects.find(project => project.id === selectedProjectId);
  async function act(task: Promise<LibraryState>) { try { onLibrary(await task); } catch (error) { alert(String(error)); } }

  return <div className="library-backdrop">
    <section className="library-modal" aria-label="Document library">
      <header><div><p className="eyebrow">Local workspace</p><h2>Your library</h2></div><button className="icon-button" aria-label="Close library" onClick={onClose}><X /></button></header>
      <div className="library-layout">
        <aside className="project-list">
          <h3>Projects</h3>
          {library.projects.map(project => <div className={selectedProjectId === project.id ? "project-row active" : "project-row"} key={project.id}>
            <button onClick={() => onProject(project.id)}><Folder />{project.name}<span>{project.documentIds.length}</span></button>
            <button className="project-delete" aria-label={`Delete ${project.name}`} onClick={() => confirm(`Delete project “${project.name}”? Its PDFs will move to Unfiled.`) && act(deleteProject(project.id))}><Trash2 /></button>
          </div>)}
          <button className={selectedProjectId === "unfiled" ? "project-row-button active" : "project-row-button"} onClick={() => onProject("unfiled")}><Folder />Unfiled<span>{library.documents.length - assigned.size}</span></button>
          <form onSubmit={event => { event.preventDefault(); if (newProject.trim()) act(createProject(newProject)).then(() => setNewProject("")); }}><input aria-label="New project name" placeholder="New project" value={newProject} onChange={event => setNewProject(event.target.value)} /><button aria-label="Create project" disabled={!newProject.trim()}><FolderPlus /></button></form>
        </aside>
        <main className="library-documents">
          <div className="library-heading"><div><h3>{currentProject?.name || "Unfiled"}</h3><p>{documents.length} document{documents.length === 1 ? "" : "s"} · stored locally</p></div><button className="primary" onClick={async () => { const state = await chooseAndImport(currentProject?.id); if (state) onLibrary(state); }}><FilePlus2 />Import PDF</button></div>
          <div className="document-cards">
            {!documents.length && <div className="library-empty"><BookOpen /><h4>No PDFs here yet</h4><p>Import a PDF or add one from another project.</p></div>}
            {documents.map(document => <article className="library-card" key={document.id}>
              <button className="document-open" onClick={() => onOpen(document)}><BookOpen /><span><b>{document.name}</b><small>{document.indexed ? `${document.pageCount} pages · Ready` : "Indexing begins when opened"}</small></span></button>
              <div className="document-actions">
                {currentProject && <button onClick={() => act(removeFromProject(document.id, currentProject.id))}>Remove</button>}
                <select aria-label={`Add ${document.name} to project`} value={adding} onChange={event => { const id = event.target.value; setAdding(""); if (id) act(addToProject(document.id, id)); }}><option value="">Add to project…</option>{library.projects.filter(project => !project.documentIds.includes(document.id)).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <button className="danger-action" aria-label={`Delete ${document.name}`} onClick={() => confirm(`Delete “${document.name}” from Clarus? The original file you imported is not affected.`) && act(deleteDocument(document.id))}><Trash2 /></button>
              </div>
            </article>)}
          </div>
        </main>
      </div>
    </section>
  </div>;
}
