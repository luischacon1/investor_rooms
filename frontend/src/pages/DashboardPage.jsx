import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { Plus, LogOut, Users, FileText, ExternalLink, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';

export default function DashboardPage() {
  const { founder, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', logo: null, banner: null });
  const [copied, setCopied] = useState(null);
  const BASE = window.location.origin;

  useEffect(() => {
    api.get('/api/rooms').then(r => setRooms(r.data)).finally(() => setLoading(false));
  }, []);

  async function createRoom(e) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData();
    fd.append('name', form.name);
    if (form.logo) fd.append('logo', form.logo);
    if (form.banner) fd.append('banner', form.banner);
    try {
      const { data } = await api.post('/api/rooms', fd);
      setRooms(r => [data, ...r]);
      setShowCreate(false);
      setForm({ name: '', logo: null, banner: null });
      navigate(`/dashboard/rooms/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(room) {
    const { data } = await api.put(`/api/rooms/${room.id}`, { is_active: !room.is_active });
    setRooms(r => r.map(x => x.id === room.id ? { ...x, ...data } : x));
  }

  function copyLink(slug) {
    navigator.clipboard.writeText(`${BASE}/room/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-white">InvestorRoom</span>
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 text-sm">{founder?.email}</span>
          <button onClick={logout} className="text-zinc-500 hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold">Rooms</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-white text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <Plus size={16} />
            New room
          </button>
        </div>

        {loading ? (
          <div className="text-zinc-600 text-sm">Loading…</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-lg mb-2">No rooms yet</p>
            <p className="text-sm">Create your first investor room to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <div key={room.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
                {room.logo_url && (
                  <img src={room.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-white truncate">{room.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${room.is_active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Users size={12} />{room._count?.visits ?? 0} visitors</span>
                    <span className="flex items-center gap-1"><FileText size={12} />{room._count?.docOpens ?? 0} doc opens</span>
                    <span className="font-mono truncate max-w-48">/room/{room.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => copyLink(room.slug)} title="Copy link" className="p-2 text-zinc-500 hover:text-white transition-colors">
                    {copied === room.slug ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                  <a href={`/room/${room.slug}`} target="_blank" rel="noopener" className="p-2 text-zinc-500 hover:text-white transition-colors">
                    <ExternalLink size={15} />
                  </a>
                  <button onClick={() => toggleActive(room)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                    {room.is_active ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-5">Create room</h2>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Room name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600"
                  placeholder="Series A Round"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Logo (optional)</label>
                <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, logo: e.target.files[0] }))}
                  className="text-sm text-zinc-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300 file:text-xs cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Banner (optional)</label>
                <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, banner: e.target.files[0] }))}
                  className="text-sm text-zinc-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300 file:text-xs cursor-pointer" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-2 text-sm font-medium bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
