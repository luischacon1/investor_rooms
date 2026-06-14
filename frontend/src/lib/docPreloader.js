import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// url -> Promise<PDFDocumentProxy>
const pdfCache = new Map();

export function preloadDocs(documents, visitorToken) {
  const origin = window.location.origin;
  for (const doc of documents) {
    const ext = doc.file_type?.toLowerCase();
    const url = `${origin}/api/public/document/${doc.id}/view?token=${encodeURIComponent(visitorToken)}`;
    // Only preload lightweight images — PDFs/video/office are too heavy and freeze the tab
    if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) {
      const img = new Image();
      img.src = url;
    }
  }
}

export function getCachedPDF(url) {
  return pdfCache.get(url) ?? null;
}

export { pdfjsLib };
