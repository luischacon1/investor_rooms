import { useEffect, useRef, useState } from 'react';
import { getCachedPDF, pdfjsLib } from '../lib/docPreloader';

export default function PDFViewer({ url, onLoad, onError }) {
  const containerRef   = useRef();
  const [containerW, setContainerW] = useState(0);
  const [pages,     setPages]     = useState([]);
  const [useFallback, setUseFallback] = useState(false);

  // Measure container width immediately + via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const immediate = Math.floor(el.getBoundingClientRect().width);
    if (immediate > 0) setContainerW(immediate);
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render PDF pages
  useEffect(() => {
    if (!url || !containerW || useFallback) return;
    let cancelled = false;
    setPages([]);

    async function render() {
      try {
        // Use cached PDF if already loading/loaded in background
        const pdfPromise = getCachedPDF(url)
          ?? pdfjsLib.getDocument({ url, withCredentials: false }).promise;

        const pdf = await pdfPromise;
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page   = await pdf.getPage(i);
          const baseVP = page.getViewport({ scale: 1 });
          const scale  = (containerW / baseVP.width) * dpr;
          const vp     = page.getViewport({ scale });

          const canvas         = document.createElement('canvas');
          canvas.width         = Math.floor(vp.width);
          canvas.height        = Math.floor(vp.height);
          canvas.style.display = 'block';
          canvas.style.width   = `${containerW}px`;
          canvas.style.height  = `${Math.floor(vp.height / dpr)}px`;

          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          if (cancelled) break;

          setPages(p => [...p, canvas]);
          if (i === 1) onLoad?.();
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('PDF.js failed, falling back to native viewer:', err);
        // Fallback: let the browser render it natively via iframe
        setUseFallback(true);
        onLoad?.();
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url, containerW, useFallback]);

  // Native iframe fallback (works on Safari/Firefox when PDF.js fails)
  if (useFallback) {
    return (
      <iframe
        src={url}
        title="PDF"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
      style={{ background: '#525659', WebkitOverflowScrolling: 'touch' }}
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
  return <div ref={ref} style={{ marginBottom: '2px' }} />;
}
