import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../lib/api';
import { ArrowLeft, Upload, Copy, Check, GripVertical, Trash2, Pencil, X, Save, ExternalLink } from 'lucide-react';

const FILE_ICONS = {
  pdf: '📄', ppt: '📊', pptx: '📊', doc: '📝', docx: '📝',
  xls: '📈', xlsx: '📈', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼',
  svg: '🖼', mp4: '🎬', zip: '📦',
};

function FileIcon({ type }) {
  return <span className="text-base">{FILE_ICONS[type?.toLowerCase()] ?? '📎'}</span>;
}

function SortableDoc({ doc, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.display_name);
  const inputRef = useRef();

  function startEdit() { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }
  async function save() {
    if (name.trim() && name !== doc.display_name) await onUpdate(doc.id, name.trim());
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 group">
      <button {...attributes} {...listeners} className="text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={16} />
      </button>
      <FileIcon type={doc.file_type} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full bg-zinc-800 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        ) : (
          <span className="text-sm text-white truncate block">{doc.display_name}</span>
        )}
        <span className="text-xs text-zinc-600 uppercase">{doc.file_type}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <button onClick={save} className="p-1.5 text-zinc-400 hover:text-emerald-400 transition-colors"><Save size={13} /></button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-zinc-400 hover:text-white transition-colors"><X size={13} /></button>
          </>
        ) : (
          <button onClick={startEdit} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><Pencil size={13} /></button>
        )}
        <button onClick={() => onDelete(doc.id)} className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export default function RoomEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef();
  const fileInputRef = useRef();
  const BASE = window.location.origin;

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    api.get(`/api/rooms/${id}`).then(r => {
      setRoom(r.data);
      setDocs(r.data.documents);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('display_name', file.name.replace(/\.[^/.]+$/, ''));
      const { data } = await api.post(`/api/rooms/${id}/documents`, fd);
      setDocs(d => [...d, data]);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = docs.findIndex(d => d.id === active.id);
    const newIdx = docs.findIndex(d => d.id === over.id);
    const newDocs = arrayMove(docs, oldIdx, newIdx).map((d, i) => ({ ...d, order: i }));
    setDocs(newDocs);
    await api.post('/api/documents/reorder', { items: newDocs.map(d => ({ id: d.id, order: d.order })) });
  }

  async function updateDoc(docId, display_name) {
    const { data } = await api.put(`/api/documents/${docId}`, { display_name });
    setDocs(d => d.map(x => x.id === docId ? { ...x, ...data } : x));
  }

  async function deleteDoc(docId) {
    if (!confirm('Delete this document?')) return;
    await api.delete(`/api/documents/${docId}`);
    setDocs(d => d.filter(x => x.id !== docId));
  }

  async function toggleActive() {
    const { data } = await api.put(`/api/rooms/${id}`, { is_active: !room.is_active });
    setRoom(r => ({ ...r, ...data }));
  }

  function startEditName() {
    setNameValue(room.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  async function saveRoomName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== room.name) {
      const { data } = await api.put(`/api/rooms/${id}`, { name: trimmed });
      setRoom(r => ({ ...r, ...data }));
    }
    setEditingName(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${BASE}/room/${room.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-600 text-sm">Loading…</div>;
  if (!room) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-400 text-sm">Room not found</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {room.logo_url && <img src={room.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover bg-zinc-800 shrink-0" />}
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveRoomName}
              onKeyDown={e => { if (e.key === 'Enter') saveRoomName(); if (e.key === 'Escape') setEditingName(false); }}
              className="font-semibold text-white bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-zinc-500 w-64"
            />
          ) : (
            <button onClick={startEditName} className="flex items-center gap-2 group">
              <h1 className="font-semibold text-white">{room.name}</h1>
              <Pencil size={13} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${room.is_active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {room.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleActive} className="text-xs border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
            {room.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={copyLink} className="flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300 hover:border-zinc-700 transition-colors">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={`/room/${room.slug}`} target="_blank" rel="noopener" className="p-2 text-zinc-500 hover:text-white transition-colors">
            <ExternalLink size={15} />
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Logo + Banner editors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wide mb-2">Logo</label>
            <label className="relative block cursor-pointer group">
              <div className="h-24 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors">
                {room.logo_url
                  ? <img src={room.logo_url} alt="Logo" className="w-full h-full object-contain p-2" onError={e => e.target.style.display='none'} />
                  : <Upload size={18} className="text-zinc-600" />}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-xs text-white">Cambiar</span>
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files[0]; if (!file) return;
                const fd = new FormData(); fd.append('logo', file);
                const { data } = await api.put(`/api/rooms/${id}`, fd);
                setRoom(r => ({ ...r, logo_url: data.logo_url }));
              }} />
            </label>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wide mb-2">Banner</label>
            <label className="relative block cursor-pointer group">
              <div className="h-24 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors">
                {room.banner_url
                  ? <img src={room.banner_url} alt="Banner" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  : <Upload size={18} className="text-zinc-600" />}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-xs text-white">Cambiar</span>
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files[0]; if (!file) return;
                const fd = new FormData(); fd.append('banner', file);
                const { data } = await api.put(`/api/rooms/${id}`, fd);
                setRoom(r => ({ ...r, banner_url: data.banner_url }));
              }} />
            </label>
          </div>
        </div>

        {/* Shareable link */}
        <div>
          <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Shareable link</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-sm text-zinc-400 font-mono flex-1 truncate">{BASE}/room/{room.slug}</span>
            <button onClick={copyLink} className="shrink-0 text-zinc-500 hover:text-white transition-colors">
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Documents ({docs.length})</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300 hover:border-zinc-700 transition-colors disabled:opacity-50"
            >
              <Upload size={13} />
              {uploading ? 'Uploading…' : 'Upload files'}
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg,.mp4,.zip" onChange={handleUpload} className="hidden" />
          </div>

          {docs.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 rounded-xl p-10 text-center text-zinc-600 text-sm cursor-pointer hover:border-zinc-700 hover:text-zinc-500 transition-colors"
            >
              <Upload size={24} className="mx-auto mb-3 opacity-50" />
              Click to upload your first document
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={docs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <SortableDoc key={doc.id} doc={doc} onUpdate={updateDoc} onDelete={deleteDoc} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Visit stats */}
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wide mb-4">Recent visitors</label>
          {room.visits?.length === 0 ? (
            <p className="text-sm text-zinc-600">No visitors yet.</p>
          ) : (
            <div className="space-y-2">
              {room.visits?.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <span className="text-sm text-zinc-300">{v.visitor_email}</span>
                  <span className="text-xs text-zinc-600">{new Date(v.visited_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
