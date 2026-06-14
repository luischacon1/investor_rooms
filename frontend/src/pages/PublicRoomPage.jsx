import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import DocumentViewer from '../components/DocumentViewer';
import { preloadDocs } from '../lib/docPreloader';

const FILE_ICONS = {
  pdf: '📄', ppt: '📊', pptx: '📊', doc: '📝', docx: '📝',
  xls: '📈', xlsx: '📈', png: '🖼', jpg: '🖼', jpeg: '🖼',
  gif: '🖼', svg: '🖼', mp4: '🎬', zip: '📦',
};

function FileIcon({ type }) {
  return <span className="text-xl">{FILE_ICONS[type?.toLowerCase()] ?? '📎'}</span>;
}

export default function PublicRoomPage() {
  const { slug } = useParams();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [visitorToken, setVisitorToken] = useState(null);
  const [visitorEmail, setVisitorEmail] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const storageKey = `ir_visitor_${slug}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { token, email: savedEmail } = JSON.parse(saved);
        setVisitorToken(token);
        setVisitorEmail(savedEmail);
      } catch { localStorage.removeItem(storageKey); }
    }
    api.get(`/api/public/room/${slug}`)
      .then(r => {
        setRoom(r.data);
        // If already authenticated, preload immediately
        const saved = localStorage.getItem(`ir_visitor_${slug}`);
        if (saved) {
          try {
            const { token } = JSON.parse(saved);
            if (token) preloadDocs(r.data.documents, token);
          } catch {}
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Room not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleEnter(e) {
    e.preventDefault();
    setEmailError('');
    setSubmitting(true);
    try {
      const { data } = await api.post(`/api/public/room/${slug}/enter`, { email });
      localStorage.setItem(storageKey, JSON.stringify({ token: data.token, email: data.email }));
      setVisitorToken(data.token);
      setVisitorEmail(data.email);
      // Start preloading docs immediately after auth
      if (room?.documents) preloadDocs(room.documents, data.token);
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-600 text-sm">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-zinc-400 text-lg mb-2">Room unavailable</div>
        <div className="text-zinc-600 text-sm">{error}</div>
      </div>
    </div>
  );

  const isUnlocked = !!visitorToken;

  return (
    <>
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Banner */}
        {room.banner_url ? (
          <div className="h-52 md:h-72 overflow-hidden relative bg-zinc-900">
            <img
              src={room.banner_url} alt=""
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/80" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-zinc-900 to-zinc-950" />
        )}

        <div className="max-w-2xl mx-auto px-4 -mt-10 relative">
          {/* Logo + title */}
          <div className="flex items-end gap-4 mb-8">
            {room.logo_url && (
              <img src={room.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover bg-zinc-800 border-2 border-zinc-900 shadow-xl shrink-0" onError={e => { e.target.style.display = 'none'; }} />
            )}
            <div className="pb-1">
              <h1 className="text-2xl font-bold text-white">{room.name}</h1>
            </div>
          </div>

          {!isUnlocked ? (
            /* Email gate */
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="mb-6">
                <div className="text-3xl mb-3">🔒</div>
                <h2 className="text-lg font-semibold text-white mb-2">Private investor room</h2>
                <p className="text-zinc-500 text-sm">Enter your email to access the documents in this room.</p>
              </div>
              <form onSubmit={handleEnter} className="max-w-sm mx-auto space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors text-center"
                />
                {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-white text-zinc-900 font-semibold text-sm rounded-xl py-3 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Accessing…' : 'Access room →'}
                </button>
              </form>
            </div>
          ) : (
            /* Document list */
            <div>
              <p className="text-xs text-zinc-600 mb-5">Logged in as <span className="text-zinc-400">{visitorEmail}</span></p>
              <div className="space-y-2">
                {room.documents.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDoc(doc)}
                    className="w-full flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-left hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
                  >
                    <FileIcon type={doc.file_type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate group-hover:text-zinc-100">{doc.display_name}</div>
                      <div className="text-xs text-zinc-600 uppercase mt-0.5">{doc.file_type}</div>
                    </div>
                    <span className="text-xs text-zinc-600 group-hover:text-zinc-400 shrink-0">Ver →</span>
                  </button>
                ))}
              </div>
              {room.documents.length === 0 && (
                <p className="text-zinc-600 text-sm text-center py-10">No documents yet.</p>
              )}
            </div>
          )}
          <div className="mt-12 pb-10 text-center text-zinc-800 text-xs">Powered by InvestorRoom</div>
        </div>
      </div>

      {/* Document viewer modal */}
      {activeDoc && visitorToken && (
        <DocumentViewer
          doc={activeDoc}
          visitorToken={visitorToken}
          onClose={() => setActiveDoc(null)}
        />
      )}
    </>
  );
}
