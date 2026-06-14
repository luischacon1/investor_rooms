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

    if (['pdf'].includes(ext)) {
      // Start PDF.js loading in background — result cached for instant open
      if (!pdfCache.has(url)) {
        const task = pdfjsLib.getDocument({ url, withCredentials: false });
        pdfCache.set(url, task.promise);
      }
    } else if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) {
      // Prime browser cache for images
      const img = new Image();
      img.src = url;
    }
    // Videos/Office: too heavy to preload
  }
}

export function getCachedPDF(url) {
  return pdfCache.get(url) ?? null;
}

export { pdfjsLib };
