import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader, AlertCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
const ZOOM_MIN  = 0.25;
const ZOOM_MAX  = 5;

export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const containerRef = useRef();
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);
  const [zoom, setZoom]     = useState(1);

  const ext        = doc?.file_type?.toLowerCase();
  const viewerType = getViewerType(ext);
  const canZoom    = viewerType === 'image';

  const origin   = window.location.origin;
  const viewUrl  = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (!canZoom) return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
      if (e.key === '-')                   setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
      if (e.key === '0')                   setZoom(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc.id, onClose, canZoom]);

  // Scroll-to-zoom for images on desktop
  const onWheel = useCallback((e) => {
    if (!canZoom) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(Math.max(z + delta, ZOOM_MIN), ZOOM_MAX));
  }, [canZoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canZoom) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel, canZoom]);

  function blockContext(e) { e.preventDefault(); }
  function zoomIn()    { setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX)); }
  function zoomOut()   { setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN)); }
  function zoomReset() { setZoom(1); }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div
      onContextMenu={blockContext}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <span className="text-sm font-medium text-white truncate flex-1">{doc.display_name}</span>

        {/* Zoom controls — shown for images */}
        {canZoom && (
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-1 py-0.5">
            <button onClick={zoomOut}  disabled={zoom <= ZOOM_MIN} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
              <ZoomOut size={15} />
            </button>
            <button onClick={zoomReset} className="text-xs text-zinc-400 hover:text-white w-12 text-center transition-colors">
              {zoomPct}%
            </button>
            <button onClick={zoomIn}   disabled={zoom >= ZOOM_MAX} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
              <ZoomIn size={15} />
            </button>
          </div>
        )}

        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
          <X size={18} />
        </button>
      </div>

      {/* Viewer area */}
      <div ref={containerRef} className="flex-1 overflow-auto relative bg-zinc-950">

        {/* Spinner */}
        {!loaded && !error && viewerType !== 'unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <Loader size={28} className="text-zinc-500 animate-spin" />
          </div>
        )}

        {/* PDF — full area iframe */}
        {viewerType === 'pdf' && (
          <iframe
            key={doc.id}
            src={viewUrl}
            className="w-full border-0"
            style={{ height: '100%', minHeight: '100%', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            title={doc.display_name}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
        )}

        {/* Image — zoomable, scrollable */}
        {viewerType === 'image' && (
          <>
            <div className="absolute inset-0 z-10" onContextMenu={blockContext} onDragStart={e => e.preventDefault()} />
            <div className="min-h-full flex items-center justify-center p-6">
              <img
                key={doc.id}
                src={viewUrl}
                alt={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                draggable={false}
                className="select-none pointer-events-none"
                style={{
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  opacity: loaded ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              />
            </div>
          </>
        )}

        {/* Video */}
        {viewerType === 'video' && (
          <div className="min-h-full flex items-center justify-center bg-black p-4">
            <video
              key={doc.id}
              src={viewUrl}
              controls
              controlsList="nodownload nofullscreen"
              disablePictureInPicture
              onLoadedData={() => setLoaded(true)}
              onError={() => { setError(true); setLoaded(true); }}
              className="max-w-full max-h-screen rounded"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
          </div>
        )}

        {/* Office via Microsoft Online */}
        {viewerType === 'office' && (
          <iframe
            key={doc.id}
            src={officeUrl}
            className="w-full border-0"
            style={{ height: '100%', minHeight: '100%', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            title={doc.display_name}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
        )}

        {/* Unsupported */}
        {viewerType === 'unsupported' && (
          <div className="min-h-full flex flex-col items-center justify-center text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <div>
              <p className="text-white font-medium mb-1">{doc.display_name}</p>
              <p className="text-zinc-500 text-sm">Formato {ext?.toUpperCase()} no soportado para previsualización.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-950">
            <AlertCircle size={36} className="text-red-500" />
            <p className="text-zinc-400 text-sm">No se pudo cargar el documento. Inténtalo de nuevo.</p>
          </div>
        )}
      </div>

      {/* Mobile zoom hint for images */}
      {canZoom && loaded && zoom === 1 && (
        <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-zinc-400 text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Usa los botones + / − para hacer zoom
        </div>
      )}
    </div>
  );
}
