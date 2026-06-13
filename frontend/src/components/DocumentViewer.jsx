import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';

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

const isMobile = () => window.innerWidth < 768 || 'ontouchstart' in window;

const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 5;

// ── Pinch-to-zoom hook ────────────────────────────────────────────────────────
function usePinchZoom(containerRef, { enabled, zoom, setZoom }) {
  const lastDist = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    function dist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) lastDist.current = dist(e.touches);
    }
    function onTouchMove(e) {
      if (e.touches.length !== 2 || lastDist.current === null) return;
      e.preventDefault();
      const d = dist(e.touches);
      const scale = d / lastDist.current;
      lastDist.current = d;
      setZoom(z => Math.min(Math.max(z * scale, ZOOM_MIN), ZOOM_MAX));
    }
    function onTouchEnd() { lastDist.current = null; }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [enabled, containerRef, setZoom]);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const containerRef = useRef();
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);
  const [zoom, setZoom]     = useState(1);

  const ext        = doc?.file_type?.toLowerCase();
  const viewerType = getViewerType(ext);
  const canZoom    = viewerType === 'image';

  const origin    = window.location.origin;
  const viewUrl   = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;

  // Reset state when doc changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
  }, [doc.id]);

  // Keyboard shortcuts (desktop)
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

  // Scroll-to-zoom (desktop)
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

  // Pinch-to-zoom (mobile)
  usePinchZoom(containerRef, { enabled: canZoom, zoom, setZoom });

  function blockContext(e) { e.preventDefault(); }
  const zoomPct = Math.round(zoom * 100);

  return (
    <div
      onContextMenu={blockContext}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <button
          onClick={onClose}
          className="shrink-0 p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800 touch-manipulation"
        >
          <X size={20} />
        </button>

        <span className="text-sm font-medium text-white truncate flex-1 min-w-0">{doc.display_name}</span>

        {/* Zoom controls — images only */}
        {canZoom && (
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg px-1 shrink-0">
            <button
              onClick={() => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN))}
              disabled={zoom <= ZOOM_MIN}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 touch-manipulation"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="text-xs text-zinc-400 hover:text-white w-11 text-center touch-manipulation"
            >
              {zoomPct}%
            </button>
            <button
              onClick={() => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX))}
              disabled={zoom >= ZOOM_MAX}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 touch-manipulation"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Viewer ── */}
      <div ref={containerRef} className="flex-1 relative overflow-auto bg-zinc-950">

        {/* Spinner */}
        {!loaded && !error && viewerType !== 'unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <Loader size={28} className="text-zinc-500 animate-spin" />
          </div>
        )}

        {/* ── PDF ── */}
        {viewerType === 'pdf' && (
          <iframe
            key={doc.id}
            src={viewUrl}
            title={doc.display_name}
            className="w-full border-0 absolute inset-0 h-full"
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        )}

        {/* ── Image — pinch/scroll/button zoom ── */}
        {viewerType === 'image' && (
          <>
            {/* Transparent overlay blocks right-click & drag */}
            <div
              className="absolute inset-0 z-10"
              onContextMenu={blockContext}
              onDragStart={e => e.preventDefault()}
            />
            <div
              className="min-h-full min-w-full flex items-center justify-center p-4"
              style={{ cursor: zoom > 1 ? 'move' : 'default' }}
            >
              <img
                key={doc.id}
                src={viewUrl}
                alt={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                draggable={false}
                className="select-none pointer-events-none block"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  opacity: loaded ? 1 : 0,
                  transition: 'opacity 0.3s, transform 0.1s',
                }}
              />
            </div>
          </>
        )}

        {/* ── Video ── */}
        {viewerType === 'video' && (
          <div className="min-h-full flex items-center justify-center bg-black p-3">
            <video
              key={doc.id}
              src={viewUrl}
              controls
              controlsList="nodownload"
              playsInline
              onLoadedData={() => setLoaded(true)}
              onError={() => { setError(true); setLoaded(true); }}
              className="max-w-full max-h-[85vh] rounded-lg w-full"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
          </div>
        )}

        {/* ── Office (Excel / Word / PPT) ── */}
        {viewerType === 'office' && (
          <iframe
            key={doc.id}
            src={officeUrl}
            title={doc.display_name}
            className="w-full border-0 absolute inset-0 h-full"
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        )}

        {/* ── Unsupported ── */}
        {viewerType === 'unsupported' && (
          <div className="min-h-full flex flex-col items-center justify-center text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <p className="text-white font-medium">{doc.display_name}</p>
            <p className="text-zinc-500 text-sm">Formato {ext?.toUpperCase()} no soportado.</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-950 z-30">
            <AlertCircle size={36} className="text-red-500" />
            <p className="text-zinc-400 text-sm">No se pudo cargar el documento.</p>
            <button onClick={() => { setError(false); setLoaded(false); }} className="text-xs text-zinc-500 underline">
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Mobile pinch hint — shown briefly for images */}
      {canZoom && loaded && !error && zoom === 1 && (
        <div
          className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-zinc-300 text-xs px-4 py-2 rounded-full pointer-events-none animate-pulse"
        >
          Pellizca para hacer zoom
        </div>
      )}
    </div>
  );
}
