import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export default function PDFViewer({ url, onLoad, onError }) {
  const containerRef = useRef();
  const [containerW, setContainerW] = useState(0);
  const [pages, setPages] = useState([]);

  // Measure container width — read immediately + ResizeObserver
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

  // Load + render all pages
  useEffect(() => {
    if (!url || !containerW) return;
    let cancelled = false;
    setPages([]);

    async function render() {
      try {
        const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
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
        if (!cancelled) {
          console.error('PDFViewer error:', err);
          onError?.();
        }
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
