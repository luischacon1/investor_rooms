import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader, AlertCircle, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

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

const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 5;
const LOAD_TIMEOUT_MS = 9000; // if nothing loads by then, surface the "open in new tab" escape hatch

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

// ── Main ───────────────────────────────────────────────────────────────────────
// Deliberately simple: PDFs and Office files use the browser's own native viewer
// inside a plain iframe. No PDF.js, no canvas rendering, no custom scaling math —
// those all introduced failure modes (frozen tabs, blank pages) across devices.
// A visible "open in new tab" link is always available as a guaranteed fallback.
export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const containerRef = useRef();
  const [loaded,  setLoaded]   = useState(false);
  const [error,   setError]    = useState(false);
  const [zoom,    setZoom]     = useState(1);
  const [slow,    setSlow]     = useState(false);

  const ext        = doc?.file_type?.toLowerCase();
  const viewerType = getViewerType(ext);
  const canZoom    = viewerType === 'image';

  const origin    = window.location.origin;
  const viewUrl   = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;

  // Reset on doc change
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
    setSlow(false);
  }, [doc.id]);

  // Surface "open in new tab" if loading takes too long (covers silent failures)
  useEffect(() => {
    if (loaded || error) return;
    const t = setTimeout(() => setSlow(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded, error, doc.id]);

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

        {/* Always-available escape hatch for pdf/office — guarantees the visitor can see the file */}
        {(viewerType === 'pdf' || viewerType === 'office') && (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en pestaña nueva"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 touch-manipulation"
          >
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {/* ── Viewer area ── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-zinc-950">

        {!loaded && !error && viewerType !== 'unsupported' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 px-6 text-center">
            <Loader size={28} className="text-zinc-500 animate-spin" />
            {slow && (viewerType === 'pdf' || viewerType === 'office') && (
              <>
                <p className="text-zinc-500 text-sm">Esto está tardando más de lo normal.</p>
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-zinc-900 text-sm font-medium rounded-lg px-4 py-2 pointer-events-auto"
                >
                  <ExternalLink size={16} /> Abrir en pestaña nueva
                </a>
              </>
            )}
          </div>
        )}

        {/* PDF — native browser viewer via plain iframe (most reliable across devices) */}
        {viewerType === 'pdf' && (
          <iframe
            key={doc.id}
            src={viewUrl}
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

        {/* Image — zoom + pinch */}
        {viewerType === 'image' && (
          <>
            <div className="absolute inset-0 z-10" onContextMenu={blockContext} onDragStart={e => e.preventDefault()} />
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                key={doc.id}
                src={viewUrl}
                alt={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                draggable={false}
                className="select-none pointer-events-none block max-w-full max-h-full"
                style={{
                  transform: `scale(${zoom})`,
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
          <div className="w-full h-full flex items-center justify-center bg-black p-3">
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

        {/* Office (Excel, Word, PPT) — Microsoft Office Online viewer */}
        {viewerType === 'office' && (
          <iframe
            key={doc.id}
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
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-zinc-900 text-sm font-medium rounded-lg px-4 py-2 mt-1"
            >
              <ExternalLink size={16} /> Abrir en pestaña nueva
            </a>
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
