import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const PDF_TYPES = ['pdf'];
const PREVIEWABLE = [...PDF_TYPES, ...IMAGE_TYPES];

export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const overlayRef = useRef();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const ext = doc?.file_type?.toLowerCase();
  const isImage = IMAGE_TYPES.includes(ext);
  const isPdf = PDF_TYPES.includes(ext);
  const canPreview = PREVIEWABLE.includes(ext);

  const viewUrl = `${API}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;

  useEffect(() => {
    setLoaded(false);
    setError(false);
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc.id, onClose]);

  function blockContext(e) { e.preventDefault(); }

  return (
    <div
      ref={overlayRef}
      onContextMenu={blockContext}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <span className="text-sm font-medium text-white truncate max-w-md">{doc.display_name}</span>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
        >
          <X size={18} />
        </button>
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {/* Loading spinner */}
        {!loaded && !error && canPreview && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader size={28} className="text-zinc-500 animate-spin" />
          </div>
        )}

        {canPreview ? (
          <>
            {isPdf && (
              <iframe
                key={doc.id}
                src={viewUrl}
                className="w-full h-full border-0"
                title={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
              />
            )}

            {isImage && (
              <>
                {/* Overlay blocks right-click and drag */}
                <div
                  className="absolute inset-0 z-10"
                  onContextMenu={blockContext}
                  onDragStart={e => e.preventDefault()}
                />
                <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
                  <img
                    key={doc.id}
                    src={viewUrl}
                    alt={doc.display_name}
                    onLoad={() => setLoaded(true)}
                    onError={() => { setError(true); setLoaded(true); }}
                    className="max-w-full max-h-full object-contain select-none pointer-events-none"
                    draggable={false}
                    style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <AlertCircle size={36} className="text-red-500" />
                <p className="text-zinc-400 text-sm">No se pudo cargar el documento.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <div>
              <p className="text-white font-medium mb-1">{doc.display_name}</p>
              <p className="text-zinc-500 text-sm">
                Los archivos {ext?.toUpperCase()} no se pueden previsualizar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
