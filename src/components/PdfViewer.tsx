import { useCallback, useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import type { PageText } from "../lib/types";

GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  file: File;
  page: number;
  onPageChange: (page: number) => void;
  onPages: (pages: PageText[]) => void;
  onWord: (word: string, rect: DOMRect) => void;
  onSelection: (text: string, page: number) => void;
  highlights: string[];
}

export default function PdfViewer({ file, page, onPageChange, onPages, onWord, onSelection, highlights }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.15);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<PageText[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    file.arrayBuffer().then(data => getDocument({ data }).promise).then(async doc => {
      if (!active) return;
      setPdf(doc);
      const texts: PageText[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        texts.push({ page: n, text: content.items.map(item => "str" in item ? item.str : "").join(" ") });
      }
      pagesRef.current = texts;
      onPages(texts);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [file, onPages]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !textRef.current) return;
    let cancelled = false;
    pdf.getPage(page).then(async current => {
      const viewport = current.getViewport({ scale });
      const canvas = canvasRef.current!;
      const layer = textRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d")!;
      await current.render({ canvas, canvasContext: ctx, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
      const content = await current.getTextContent();
      if (cancelled) return;
      layer.replaceChildren();
      const renderedWords: HTMLSpanElement[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const tx = viewport.transform;
        const m = item.transform;
        const x = tx[0] * m[4] + tx[2] * m[5] + tx[4];
        const y = tx[1] * m[4] + tx[3] * m[5] + tx[5];
        const fontSize = Math.max(5, Math.hypot(m[2], m[3]) * scale);
        const span = document.createElement("span");
        span.className = "text-item";
        span.style.left = `${x}px`;
        span.style.top = `${y - fontSize}px`;
        span.style.fontSize = `${fontSize}px`;
        span.style.height = `${fontSize * 1.2}px`;
        span.style.width = `${Math.max(item.width * scale, 2)}px`;
        for (const part of item.str.split(/(\s+)/)) {
          const word = document.createElement("span");
          word.textContent = part;
          if (/\w/.test(part)) {
            word.className = "pdf-word";
            word.onmouseenter = () => onWord(part, word.getBoundingClientRect());
            renderedWords.push(word);
          }
          span.appendChild(word);
        }
        layer.appendChild(span);
      }
      const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9'-]/g, "");
      const pageWords = renderedWords.map(word => clean(word.textContent || ""));
      for (const quote of highlights) {
        const quoteWords = (quote.match(/[A-Za-z0-9'-]+/g) || []).map(clean);
        if (!quoteWords.length) continue;
        for (let start = 0; start <= pageWords.length - quoteWords.length; start++) {
          if (quoteWords.every((word, offset) => pageWords[start + offset] === word)) {
            for (let offset = 0; offset < quoteWords.length; offset++) renderedWords[start + offset].classList.add("saved-highlight");
            break;
          }
        }
      }
    });
    return () => { cancelled = true; };
  }, [pdf, page, scale, onWord, highlights]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    setMatches(q ? pagesRef.current.filter(p => p.text.toLowerCase().includes(q)).map(p => p.page) : []);
  }, [query]);

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text.length > 2 && textRef.current?.contains(selection?.anchorNode || null)) onSelection(text, page);
  }, [onSelection, page]);

  return <section className="reader-pane">
    <div className="reader-toolbar">
      <div className="page-controls">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /></button>
        <label><input aria-label="Current page" value={page} onChange={e => onPageChange(Math.max(1, Math.min(pdf?.numPages || 1, Number(e.target.value))))} /> <span>of {pdf?.numPages || "—"}</span></label>
        <button aria-label="Next page" disabled={!pdf || page >= pdf.numPages} onClick={() => onPageChange(page + 1)}><ChevronRight /></button>
      </div>
      <div className="search-box"><Search /><input placeholder="Find in document" value={query} onChange={e => setQuery(e.target.value)} />{query && <span>{matches.length} pages</span>}</div>
      <div className="zoom-controls">
        <button aria-label="Zoom out" onClick={() => setScale(s => Math.max(.55, s - .1))}><Minus /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="Zoom in" onClick={() => setScale(s => Math.min(2.5, s + .1))}><Plus /></button>
      </div>
    </div>
    <div className="document-scroll" onMouseUp={captureSelection}>
      {loading && <div className="pdf-loading"><span className="spinner" />Reading the document…</div>}
      <div className="pdf-page" aria-label={`Page ${page}`}>
        <canvas ref={canvasRef} />
        <div ref={textRef} className="text-layer" />
      </div>
    </div>
  </section>;
}
