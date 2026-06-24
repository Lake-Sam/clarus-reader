import { useEffect, useState } from "react";
import { Check, KeyRound, ShieldCheck, X } from "lucide-react";
import { deleteKey, hasKey, saveKey } from "../lib/ai";
import type { Provider, Settings } from "../lib/types";

const providerNames: Record<Provider, string> = { openai: "OpenAI", anthropic: "Anthropic", compatible: "OpenAI-compatible", ollama: "Ollama (local)" };
const modelDefaults: Record<Provider, string> = { openai: "gpt-5-mini", anthropic: "claude-sonnet-4-5", compatible: "", ollama: "llama3.2" };
const visionDefaults: Record<Provider, string> = { openai: "gpt-5-mini", anthropic: "claude-sonnet-4-5", compatible: "", ollama: "llama3.2-vision" };

export default function SettingsModal({ settings, onSave, onClose }: { settings: Settings; onSave: (value: Settings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { hasKey(draft.provider).then(setSaved); }, [draft.provider]);
  const changeProvider = (provider: Provider) => setDraft(d => ({ ...d, provider, model: modelDefaults[provider], visionModel: visionDefaults[provider], baseUrl: provider === "ollama" ? "http://127.0.0.1:11434" : "" }));

  async function storeKey() {
    try { await saveKey(draft.provider, key); setKey(""); setSaved(true); setStatus("Key saved securely in Windows Credential Manager."); }
    catch (e) { setStatus(String(e)); }
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-header"><div><p className="eyebrow">Preferences</p><h2>Settings</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
      <div className="settings-section">
        <h3>AI provider</h3>
        <p className="muted">Clarus talks directly to your provider. There is no Clarus server or account.</p>
        <div className="provider-grid">{(Object.keys(providerNames) as Provider[]).map(provider => <button key={provider} className={draft.provider === provider ? "provider active" : "provider"} onClick={() => changeProvider(provider)}>{providerNames[provider]}{draft.provider === provider && <Check />}</button>)}</div>
        <label className="field"><span>Model</span><input value={draft.model} onChange={e => setDraft(d => ({ ...d, model: e.target.value }))} placeholder="Model ID" /></label>
        <label className="field"><span>Vision model</span><input value={draft.visionModel} onChange={e => setDraft(d => ({ ...d, visionModel: e.target.value }))} placeholder="Vision-capable model ID" /><small className="field-help">Used only for captured formulas and images. The model must accept image input.</small></label>
        {(draft.provider === "compatible" || draft.provider === "ollama") && <label className="field"><span>Endpoint</span><input value={draft.baseUrl} onChange={e => setDraft(d => ({ ...d, baseUrl: e.target.value }))} placeholder="https://…/v1" /></label>}
        {draft.provider !== "ollama" && <div className="key-field">
          <label className="field"><span>API key {saved && <em><ShieldCheck /> Saved</em>}</span><div className="input-action"><KeyRound /><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={saved ? "••••••••••••••••" : "Paste your key"} /><button disabled={!key.trim()} onClick={storeKey}>Save</button></div></label>
          {saved && <button className="text-button danger" onClick={async () => { await deleteKey(draft.provider); setSaved(false); }}>Remove saved key</button>}
        </div>}
        {status && <p className="status-line">{status}</p>}
      </div>
      <div className="settings-section row-settings">
        <label className="field"><span>Appearance</span><select value={draft.theme} onChange={e => setDraft(d => ({ ...d, theme: e.target.value as Settings["theme"] }))}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="toggle"><span><b>Click definitions</b><small>Click words in the PDF to define them</small></span><input type="checkbox" checked={draft.hoverDefinitions} onChange={e => setDraft(d => ({ ...d, hoverDefinitions: e.target.checked }))} /></label>
      </div>
      <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => { onSave(draft); onClose(); }}>Save settings</button></div>
    </div>
  </div>;
}
