import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export default function PDFViewer({ url, onLoad, onError }) {
  const containerRef = useRef();
  const [containerW, setContainerW] = useState(0);
  const [pages, setPages] = useState([]); // array of { canvas }
  const loadedRef = useRef(false);

  // Measure container width once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render PDF pages
  useEffect(() => {
    if (!url || !containerW || loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;

    async function render() {
      try {
        const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
        if (cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const rendered = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const baseVP  = page.getViewport({ scale: 1 });
          // Scale so page fills the container width, then multiply by dpr for sharpness
          const scale   = (containerW / baseVP.width) * dpr;
          const vp      = page.getViewport({ scale });

          const canvas  = document.createElement('canvas');
          canvas.width  = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          // CSS size = logical pixels (container width, proportional height)
          canvas.style.display = 'block';
          canvas.style.width   = `${containerW}px`;
          canvas.style.height  = `${Math.floor(vp.height / dpr)}px`;

          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          if (cancelled) break;

          rendered.push(canvas);
          setPages(p => [...p, canvas]); // show each page as it renders
        }

        if (!cancelled) onLoad?.();
      } catch (err) {
        if (!cancelled) { console.error('PDF error', err); onError?.(); }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url, containerW]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
      style={{ background: '#525659', WebkitOverflowScrolling: 'touch' }}
    >
      {pages.map((canvas, i) => (
        <CanvasPage key={i} canvas={canvas} last={i === pages.length - 1} />
      ))}
    </div>
  );
}

function CanvasPage({ canvas, last }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current && canvas) {
      ref.current.innerHTML = '';
      ref.current.appendChild(canvas);
    }
  }, [canvas]);
  return <div ref={ref} style={{ marginBottom: last ? 0 : '2px' }} />;
}
