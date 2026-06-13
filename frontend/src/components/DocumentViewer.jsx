import { useEffect, useRef, useState } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const PDF_TYPES   = ['pdf'];
const VIDEO_TYPES = ['mp4', 'webm', 'mov'];
const OFFICE_TYPES = ['xlsx', 'xls', 'ppt', 'pptx', 'doc', 'docx'];

function getViewerType(ext) {
  if (PDF_TYPES.includes(ext))    return 'pdf';
  if (IMAGE_TYPES.includes(ext))  return 'image';
  if (VIDEO_TYPES.includes(ext))  return 'video';
  if (OFFICE_TYPES.includes(ext)) return 'office';
  return 'unsupported';
}

export default function DocumentViewer({ doc, visitorToken, onClose }) {
  const overlayRef = useRef();
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);

  const ext        = doc?.file_type?.toLowerCase();
  const viewerType = getViewerType(ext);

  // URL that streams the file through our protected backend endpoint
  const origin  = window.location.origin;
  const viewUrl = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;

  // Microsoft Office Online viewer (needs an absolute public URL)
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;

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
        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
          <X size={18} />
        </button>
      </div>

      {/* Viewer area */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">

        {/* Spinner */}
        {!loaded && !error && viewerType !== 'unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <Loader size={28} className="text-zinc-500 animate-spin" />
          </div>
        )}

        {/* PDF */}
        {viewerType === 'pdf' && (
          <iframe
            key={doc.id}
            src={viewUrl}
            className="w-full h-full border-0"
            title={doc.display_name}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        )}

        {/* Image */}
        {viewerType === 'image' && (
          <>
            <div className="absolute inset-0 z-10" onContextMenu={blockContext} onDragStart={e => e.preventDefault()} />
            <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
              <img
                key={doc.id}
                src={viewUrl}
                alt={doc.display_name}
                onLoad={() => setLoaded(true)}
                onError={() => { setError(true); setLoaded(true); }}
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                draggable={false}
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
              />
            </div>
          </>
        )}

        {/* Video */}
        {viewerType === 'video' && (
          <div className="w-full h-full flex items-center justify-center bg-black p-4">
            <video
              key={doc.id}
              src={viewUrl}
              controls
              controlsList="nodownload nofullscreen"
              disablePictureInPicture
              onLoadedData={() => setLoaded(true)}
              onError={() => { setError(true); setLoaded(true); }}
              className="max-w-full max-h-full rounded"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
          </div>
        )}

        {/* Office (Excel, Word, PowerPoint) via Microsoft Office Online */}
        {viewerType === 'office' && (
          <iframe
            key={doc.id}
            src={officeUrl}
            className="w-full h-full border-0"
            title={doc.display_name}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        )}

        {/* Unsupported */}
        {viewerType === 'unsupported' && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
            <AlertCircle size={40} className="text-zinc-600" />
            <div>
              <p className="text-white font-medium mb-1">{doc.display_name}</p>
              <p className="text-zinc-500 text-sm">Formato {ext?.toUpperCase()} no soportado para previsualización.</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-zinc-950">
            <AlertCircle size={36} className="text-red-500" />
            <p className="text-zinc-400 text-sm">No se pudo cargar el documento. Inténtalo de nuevo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
