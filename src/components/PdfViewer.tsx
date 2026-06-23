import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import type { Highlight, PageText } from "../lib/types";

GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  file: File;
  page: number;
  onPageChange: (page: number) => void;
  onPages: (pages: PageText[]) => void;
  onWord: (word: string) => void;
  onSelection: (text: string, page: number) => void;
  highlights: Highlight[];
}

interface PageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  scrollRoot: HTMLDivElement;
  highlights: Highlight[];
  onWord: (word: string) => void;
  onSelection: (text: string, page: number) => void;
  register: (page: number, element: HTMLDivElement | null) => void;
}

function PdfPage({ pdf, pageNumber, scale, scrollRoot, highlights, onWord, onSelection, register }: PageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [nearViewport, setNearViewport] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 612 * scale, height: 792 * scale });

  useEffect(() => {
    register(pageNumber, pageRef.current);
    return () => register(pageNumber, null);
  }, [pageNumber, register]);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      root: scrollRoot,
      rootMargin: "900px 0px"
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!nearViewport || !canvasRef.current || !textRef.current) return;
    let cancelled = false;
    let renderedTextLayer: TextLayer | null = null;
    let canvasRenderTask: RenderTask | null = null;
    const canvas = canvasRef.current;
    const layer = textRef.current;

    pdf.getPage(pageNumber).then(async current => {
      if (cancelled) return;
      const viewport = current.getViewport({ scale });
      setDimensions({ width: viewport.width, height: viewport.height });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d")!;
      canvasRenderTask = current.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]
      });
      try {
        await canvasRenderTask.promise;
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException")) return;
        throw error;
      }
      const content = await current.getTextContent();
      if (cancelled) return;
      layer.replaceChildren();
      layer.style.setProperty("--total-scale-factor", String(scale));
      renderedTextLayer = new TextLayer({ textContentSource: content, container: layer, viewport });
      await renderedTextLayer.render();
      if (cancelled) return;
      const renderedWords: HTMLSpanElement[] = [];

      for (const textDiv of renderedTextLayer.textDivs) {
        const sourceText = textDiv.textContent || "";
        textDiv.replaceChildren();
        for (const part of sourceText.split(/(\s+)/)) {
          const word = document.createElement("span");
          word.textContent = part;
          if (/\w/.test(part)) {
            word.className = "pdf-word";
            const showDefinition = (immediate: boolean) => {
              window.clearTimeout(hoverTimer.current);
              hoverTimer.current = window.setTimeout(() => {
                document.querySelectorAll(".pdf-word.definition-target").forEach(element => element.classList.remove("definition-target"));
                word.classList.add("definition-target");
                onWord(part);
              }, immediate ? 0 : 900);
            };
            word.onmouseenter = () => showDefinition(false);
            word.onmouseleave = () => window.clearTimeout(hoverTimer.current);
            word.oncontextmenu = event => {
              event.preventDefault();
              showDefinition(true);
            };
            renderedWords.push(word);
          }
          textDiv.appendChild(word);
        }
      }

      const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9'-]/g, "");
      const pageWords = renderedWords.map(word => clean(word.textContent || ""));
      for (const quote of highlights.filter(item => item.page === pageNumber).map(item => item.text)) {
        const quoteWords = (quote.match(/[A-Za-z0-9'-]+/g) || []).map(clean);
        if (!quoteWords.length) continue;
        for (let start = 0; start <= pageWords.length - quoteWords.length; start++) {
          if (quoteWords.every((word, offset) => pageWords[start + offset] === word)) {
            for (let offset = 0; offset < quoteWords.length; offset++) renderedWords[start + offset].classList.add("saved-highlight");
            break;
          }
        }
      }
    }).catch(error => {
      if (!cancelled) console.error("Could not render PDF page", error);
    });

    return () => {
      cancelled = true;
      canvasRenderTask?.cancel();
      renderedTextLayer?.cancel();
      window.clearTimeout(hoverTimer.current);
    };
  }, [highlights, nearViewport, onWord, pageNumber, pdf, scale]);

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text.length > 2 && textRef.current?.contains(selection?.anchorNode || null)) onSelection(text, pageNumber);
  }, [onSelection, pageNumber]);

  return <div className="pdf-page-wrap" ref={pageRef} data-page={pageNumber}>
    <span className="page-number">Page {pageNumber}</span>
    <div
      className="pdf-page"
      aria-label={`Page ${pageNumber}`}
      onMouseUp={captureSelection}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {nearViewport && <>
        <canvas ref={canvasRef} />
        <div ref={textRef} className="textLayer text-layer" />
      </>}
    </div>
  </div>;
}

export default function PdfViewer({ file, page, onPageChange, onPages, onWord, onSelection, highlights }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.05);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const pagesRef = useRef<PageText[]>([]);
  const pageElements = useRef(new Map<number, HTMLDivElement>());
  const internalPageUpdate = useRef(false);
  const navigationTarget = useRef<number | null>(null);
  const navigationTimer = useRef<number | undefined>(undefined);
  const scrollFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    file.arrayBuffer().then(data => getDocument({ data }).promise).then(async document => {
      if (!active) return;
      setPdf(document);
      const texts: PageText[] = [];
      for (let number = 1; number <= document.numPages; number++) {
        const content = await (await document.getPage(number)).getTextContent();
        texts.push({ page: number, text: content.items.map(item => "str" in item ? item.str : "").join(" ") });
      }
      if (!active) return;
      pagesRef.current = texts;
      onPages(texts);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [file, onPages]);

  const registerPage = useCallback((number: number, element: HTMLDivElement | null) => {
    if (element) pageElements.current.set(number, element);
    else pageElements.current.delete(number);
  }, []);

  const alignPage = useCallback((number: number) => {
    const element = pageElements.current.get(number);
    if (!element || !scrollRoot) return;
    scrollRoot.scrollTop = Math.max(0, element.offsetTop - scrollRoot.offsetTop - 18);
  }, [scrollRoot]);

  const navigateToPage = useCallback((number: number, behavior: ScrollBehavior = "smooth") => {
    const target = Math.max(1, Math.min(pdf?.numPages || 1, number));
    navigationTarget.current = target;
    internalPageUpdate.current = true;
    onPageChange(target);
    pageElements.current.get(target)?.scrollIntoView({ behavior, block: "start" });
    window.clearTimeout(navigationTimer.current);
    navigationTimer.current = window.setTimeout(() => {
      alignPage(target);
      internalPageUpdate.current = true;
      onPageChange(target);
      navigationTimer.current = window.setTimeout(() => {
        alignPage(target);
        internalPageUpdate.current = true;
        onPageChange(target);
        navigationTimer.current = window.setTimeout(() => { navigationTarget.current = null; }, 250);
      }, 900);
    }, 650);
  }, [alignPage, onPageChange, pdf?.numPages]);

  useEffect(() => {
    if (internalPageUpdate.current) {
      internalPageUpdate.current = false;
      return;
    }
    navigationTarget.current = page;
    pageElements.current.get(page)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.clearTimeout(navigationTimer.current);
    navigationTimer.current = window.setTimeout(() => {
      alignPage(page);
      navigationTimer.current = window.setTimeout(() => {
        alignPage(page);
        navigationTimer.current = window.setTimeout(() => { navigationTarget.current = null; }, 250);
      }, 900);
    }, 650);
  }, [alignPage, page]);

  const updateVisiblePage = useCallback(() => {
    if (!scrollRoot) return;
    window.cancelAnimationFrame(scrollFrame.current || 0);
    scrollFrame.current = window.requestAnimationFrame(() => {
      if (navigationTarget.current !== null) return;
      const rootTop = scrollRoot.getBoundingClientRect().top + 24;
      let closest = page;
      let distance = Number.POSITIVE_INFINITY;
      pageElements.current.forEach((element, number) => {
        const nextDistance = Math.abs(element.getBoundingClientRect().top - rootTop);
        if (nextDistance < distance) { distance = nextDistance; closest = number; }
      });
      if (closest !== page) {
        internalPageUpdate.current = true;
        onPageChange(closest);
      }
    });
  }, [onPageChange, page, scrollRoot]);

  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    setMatches(normalized ? pagesRef.current.filter(item => item.text.toLowerCase().includes(normalized)).map(item => item.page) : []);
  }, [query]);

  const pageNumbers = useMemo(() => Array.from({ length: pdf?.numPages || 0 }, (_, index) => index + 1), [pdf?.numPages]);

  return <section className="reader-pane">
    <div className="reader-toolbar">
      <div className="page-controls">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => navigateToPage(page - 1)}><ChevronLeft /></button>
        <label><input aria-label="Current page" value={page} onChange={event => navigateToPage(Number(event.target.value) || 1)} /> <span>of {pdf?.numPages || "—"}</span></label>
        <button aria-label="Next page" disabled={!pdf || page >= pdf.numPages} onClick={() => navigateToPage(page + 1)}><ChevronRight /></button>
      </div>
      <div className="search-box"><Search /><input placeholder="Find in document" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && matches[0]) navigateToPage(matches[0]); }} />{query && <span>{matches.length} pages</span>}</div>
      <div className="zoom-controls">
        <button aria-label="Zoom out" onClick={() => setScale(value => Math.max(.55, value - .1))}><Minus /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="Zoom in" onClick={() => setScale(value => Math.min(2.5, value + .1))}><Plus /></button>
      </div>
    </div>
    <div className="document-scroll" ref={setScrollRoot} onScroll={updateVisiblePage}>
      {loading && <div className="pdf-loading"><span className="spinner" />Reading the document…</div>}
      {pdf && scrollRoot && <div className="pdf-pages">
        {pageNumbers.map(number => <PdfPage
          key={number}
          pdf={pdf}
          pageNumber={number}
          scale={scale}
          scrollRoot={scrollRoot}
          highlights={highlights}
          onWord={onWord}
          onSelection={onSelection}
          register={registerPage}
        />)}
      </div>}
    </div>
  </section>;
}
