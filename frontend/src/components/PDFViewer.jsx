import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export default function PDFViewer({ url, onLoad, onError }) {
  const containerRef = useRef();
  const [pages, setPages] = useState([]);
  const [containerW, setContainerW] = useState(0);
  const renderingRef = useRef(false);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF and render pages
  useEffect(() => {
    if (!url || !containerW || renderingRef.current) return;
    renderingRef.current = true;

    let cancelled = false;

    async function load() {
      try {
        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const pageCount = pdf.numPages;
        const canvases = [];

        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const scale = containerW / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width  = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.display = 'block';
          canvas.style.width   = '100%';

          await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
          if (cancelled) break;
          canvases.push(canvas);
          setPages([...canvases]); // show pages as they render
        }

        if (!cancelled) onLoad?.();
      } catch (err) {
        if (!cancelled) { console.error('PDF load error', err); onError?.(); }
      } finally {
        renderingRef.current = false;
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url, containerW]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden bg-zinc-800"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {pages.map((canvas, i) => (
        <CanvasPage key={i} canvas={canvas} />
      ))}
    </div>
  );
}

function CanvasPage({ canvas }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current && canvas) {
      ref.current.innerHTML = '';
      ref.current.appendChild(canvas);
    }
  }, [canvas]);
  return <div ref={ref} className="w-full mb-1" />;
}
