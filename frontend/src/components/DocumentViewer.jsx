import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader, AlertCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import PDFViewer from './PDFViewer';

const IMAGE_TYPES  = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const PDF_TYPES    = ['pdf'];
const VIDEO_TYPES  = ['mp4', 'webm', 'mov'];
const OFFICE_TYPES = ['xlsx', 'xls', 'ppt', 'pptx', 'doc', 'docx'];

function getViewerType(ext) {
  if (PDF_TYPES.includes(ext))    return 'pdf';
  if (IMAGE_TYPES.includes(ext))  return 'image';
  if (VIDEO_TYPES.includes(ext))  return 'video';
  if (OFFICE_TYPES.includes(ext)) return 'office';
  return 'unsupported';
}

const ZOOM_STEP    = 0.25;
const ZOOM_MIN     = 0.5;
const ZOOM_MAX     = 5;
const IFRAME_REF_W = 1200; // reference width we render iframes at, then scale down

// ── Pinch-to-zoom (images only) ───────────────────────────────────────────────
function usePinchZoom(containerRef, { enabled, setZoom }) {
  const lastDist = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    function onStart(e)  { if (e.touches.length === 2) lastDist.current = dist(e.touches); }
    function onMove(e) {
      if (e.touches.length !== 2 || !lastDist.current) return;
      e.preventDefault();
      const d = dist(e.touches);
      setZoom(z => Math.min(Math.max(z * (d / lastDist.current), ZOOM_MIN), ZOOM_MAX));
      lastDist.current = d;
    }
    function onEnd() { lastDist.current = null; }
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [enabled, containerRef, setZoom]);
}

// ── ScaledIframe ──────────────────────────────────────────────────────────────
// Renders iframe at IFRAME_REF_W px wide and scales it down to fill the container.
// This guarantees the full page is visible regardless of document proportions.
function ScaledIframe({ src, title, containerW, containerH, rotated, onLoad, onError }) {
  if (!containerW || !containerH) return null;

  if (!rotated) {
    // Portrait: scale iframe to fit containerW
    const scale = containerW / IFRAME_REF_W;
    const iframeH = containerH / scale;
    return (
      <iframe
        key={`${src}-portrait`}
        src={src}
        title={title}
        onLoad={onLoad}
        onError={onError}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${IFRAME_REF_W}px`,
          height: `${iframeH}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          border: 'none',
        }}
      />
    );
  } else {
    // Landscape (rotated 90°): use screen height as the width
    const scale = containerH / IFRAME_REF_W;
    const iframeH = containerW / scale;
    // After rotate(90deg): width ↔ height. We position so it's centered.
    const offset = (containerH - containerW) / 2;
    return (
      <iframe
        key={`${src}-landscape`}
        src={src}
        title={title}
        onLoad={onLoad}
        onError={onError}
        style={{
          position: 'absolute',
          top: offset,
          left: -offset,
          width: `${IFRAME_REF_W}px`,
          height: `${iframeH}px`,
          transform: `scale(${scale}) rotate(90deg)`,
          transformOrigin: 'top left',
          border: 'none',
        }}
      />
    );
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const wrapperRef   = useRef();
  const containerRef = useRef();
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState(false);
  const [zoom,    setZoom]    = useState(1);
  const [rotated, setRotated] = useState(false);
  const [dims,    setDims]    = useState({ w: 0, h: 0 });

  const ext        = doc?.file_type?.toLowerCase();
  const viewerType = getViewerType(ext);
  const canZoom    = viewerType === 'image';
  const canRotate  = ['pdf', 'office', 'image'].includes(viewerType);

  const origin    = window.location.origin;
  const viewUrl   = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;

  // Measure container
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset on doc change
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
    setRotated(false);
  }, [doc.id]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (!canZoom) return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
      if (e.key === '-')                   setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
      if (e.key === '0')                   setZoom(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, canZoom]);

  // Scroll-wheel zoom (desktop images)
  const onWheel = useCallback((e) => {
    if (!canZoom) return;
    e.preventDefault();
    setZoom(z => Math.min(Math.max(z + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), ZOOM_MIN), ZOOM_MAX));
  }, [canZoom]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canZoom) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel, canZoom]);

  usePinchZoom(containerRef, { enabled: canZoom, setZoom });

  function blockContext(e) { e.preventDefault(); }
  function handleRotate() { setRotated(r => !r); setLoaded(false); }

  return (
    <div
      onContextMenu={blockContext}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <button onClick={onClose} className="shrink-0 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 touch-manipulation">
          <X size={20} />
        </button>
        <span className="text-sm font-medium text-white truncate flex-1 min-w-0">{doc.display_name}</span>

        {canZoom && (
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg px-1 shrink-0">
            <button onClick={() => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN))} disabled={zoom <= ZOOM_MIN}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 touch-manipulation">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => setZoom(1)} className="text-xs text-zinc-400 hover:text-white w-11 text-center touch-manipulation">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX))} disabled={zoom >= ZOOM_MAX}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 touch-manipulation">
              <ZoomIn size={16} />
            </button>
          </div>
        )}

        {canRotate && (
          <button
            onClick={handleRotate}
            title={rotated ? 'Ver en vertical' : 'Ver en horizontal (más grande)'}
            className={`p-2 rounded-lg touch-manipulation transition-colors ${rotated ? 'text-white bg-zinc-700' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          >
            <RotateCw size={18} />
          </button>
        )}
      </div>

      {/* ── Viewer area ── */}
      <div ref={wrapperRef} className="flex-1 relative overflow-hidden bg-zinc-950">

        {!loaded && !error && viewerType !== 'unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <Loader size={28} className="text-zinc-500 animate-spin" />
          </div>
        )}

        {/* PDF — rendered page-by-page via PDF.js, fits screen width exactly */}
        {viewerType === 'pdf' && (
          <PDFViewer
            url={viewUrl}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
        )}

        {/* Image — object-fit contain + zoom + rotate */}
        {viewerType === 'image' && (
          <>
            <div className="absolute inset-0 z-10" onContextMenu={blockContext} onDragStart={e => e.preventDefault()} />
            <div ref={containerRef} className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                key={`${doc.id}-${rotated}`}
                src={viewUrl}
                alt={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                draggable={false}
                className="select-none pointer-events-none block max-w-full max-h-full"
                style={{
                  transform: `scale(${zoom})${rotated ? ' rotate(90deg)' : ''}`,
                  transformOrigin: 'center center',
                  opacity: loaded ? 1 : 0,
                  transition: 'opacity 0.3s, transform 0.15s',
                }}
              />
            </div>
          </>
        )}

        {/* Video */}
        {viewerType === 'video' && (
          <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-black p-3">
            <video
              key={doc.id}
              src={viewUrl}
              controls
              controlsList="nodownload"
              playsInline
              onLoadedData={() => setLoaded(true)}
              onError={() => { setError(true); setLoaded(true); }}
              className="max-w-full max-h-full rounded-lg w-full"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
          </div>
        )}

        {/* Office (Excel, Word, PPT) — MS Office Online viewer, responsive */}
        {viewerType === 'office' && (
          <iframe
            key={`${doc.id}-office`}
            src={officeUrl}
            title={doc.display_name}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 'none',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          />
        )}

        {viewerType === 'unsupported' && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <p className="text-white font-medium">{doc.display_name}</p>
            <p className="text-zinc-500 text-sm">Formato {ext?.toUpperCase()} no soportado.</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-950 z-30">
            <AlertCircle size={36} className="text-red-500" />
            <p className="text-zinc-400 text-sm">No se pudo cargar el documento.</p>
            <button onClick={() => { setError(false); setLoaded(false); }} className="text-xs text-zinc-500 underline mt-1">
              Reintentar
            </button>
          </div>
        )}
      </div>

      {canZoom && loaded && !error && zoom === 1 && (
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-zinc-300 text-xs px-4 py-2 rounded-full pointer-events-none">
          Pellizca para hacer zoom
        </div>
      )}
    </div>
  );
}
