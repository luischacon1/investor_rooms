import { useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const PREVIEWABLE = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const overlayRef = useRef();
  const ext = doc?.file_type?.toLowerCase();
  const canPreview = PREVIEWABLE.includes(ext);
  const viewUrl = `${API}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Block right-click on the entire modal
  function blockContext(e) { e.preventDefault(); }

  return (
    <div
      ref={overlayRef}
      onContextMenu={blockContext}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
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
      <div className="flex-1 overflow-hidden relative">
        {canPreview ? (
          <>
            {/* Invisible overlay to block right-click / drag on images */}
            {ext !== 'pdf' && (
              <div
                className="absolute inset-0 z-10"
                onContextMenu={blockContext}
                onDragStart={e => e.preventDefault()}
                style={{ userSelect: 'none' }}
              />
            )}

            {ext === 'pdf' ? (
              <iframe
                src={`${viewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full border-0"
                title={doc.display_name}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
                <img
                  src={viewUrl}
                  alt={doc.display_name}
                  className="max-w-full max-h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </div>
            )}
          </>
        ) : (
          /* Non-previewable file types (PPT, DOCX, etc.) */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <div>
              <p className="text-white font-medium mb-1">{doc.display_name}</p>
              <p className="text-zinc-500 text-sm">
                Este tipo de archivo ({ext?.toUpperCase()}) no se puede previsualizar directamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
