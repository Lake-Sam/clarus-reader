import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize, Minus, Square, X } from "lucide-react";
import logo from "../assets/logo.svg";
import { isDesktop } from "../lib/ai";

export default function TitleBar() {
  const window = isDesktop() ? getCurrentWindow() : null;
  return <div className="titlebar" data-tauri-drag-region onDoubleClick={() => window?.toggleMaximize()}>
    <div className="titlebar-brand" data-tauri-drag-region><img src={logo} />Clarus Reader</div>
    <div className="window-controls">
      <button aria-label="Minimize window" onClick={() => window?.minimize()}><Minus /></button>
      <button aria-label="Maximize window" onClick={() => window?.toggleMaximize()}>{isDesktop() ? <Square /> : <Maximize />}</button>
      <button className="window-close" aria-label="Close window" onClick={() => window?.close()}><X /></button>
    </div>
  </div>;
}
