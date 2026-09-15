import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Search, X, Pencil, Eye, Trash2, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadAppUsersAction from '@/actions/loadAppUsers';
import upsertAppUserAction from '@/actions/upsertAppUser';
import deleteAppUserAction from '@/actions/deleteAppUser';
import { useViewer } from '@/app/context/ViewerContext';
import { roleLabel, techTeamList, normalizeEmail } from '@/app/lib/access';
import UserForm from '@/app/pages/admin/access/UserForm';
import type { UserRow } from '@/app/pages/admin/access/UserForm';

export default function UsersTab() {
  const navigate = useNavigate();
  const { realEmail, setViewAs } = useViewer();

  const [rows, loading, error, reload] = useLoadAction(loadAppUsersAction, [] as UserRow[]);
  const [upsertUser, saving] = useMutateAction(upsertAppUserAction);
  const [deleteUser]         = useMutateAction(deleteAppUserAction);

  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Partial<UserRow> | null>(null);
  const [removeErr, setRemoveErr] = useState('');
  const [copyLabel, setCopyLabel] = useState('');
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const users = rows as UserRow[];
  const filtered = users.filter(u =>
    !search.trim() ||
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const superCount   = users.filter(u => u.role === 'super_user').length;
  const managerCount = users.filter(u => u.role === 'manager').length;
  const activeCount  = users.filter(u => u.active).length;

  const handleAdd  = () => { setEditing(null); setShowForm(true); setRemoveErr(''); };
  const handleEdit = (row: UserRow) => { setEditing(row); setShowForm(true); setRemoveErr(''); };
  const handleCancel = () => { setShowForm(false); setEditing(null); };

  const handleSave = async (data: Parameters<typeof upsertUser>[0]) => {
    await upsertUser(data);
    setShowForm(false);
    setEditing(null);
    await reload();
  };

  const handleDelete = async (row: UserRow) => {
    if (!window.confirm(`Remove ${row.display_name || row.email} from the access list?`)) return;
    await deleteUser({ id: row.id });
    await reload();
    const stillThere = (rows as UserRow[]).find(r => String(r.id) === String(row.id));
    if (stillThere) setRemoveErr('Could not remove — the last active super user cannot be removed.');
    else setRemoveErr('');
  };

  const handleCopy = async () => {
    const text = techTeamList(users);
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel(`Copied ${activeCount}`);
      setFallbackText(null);
      setTimeout(() => setCopyLabel(''), 2000);
    } catch {
      setFallbackText(text);
    }
  };

  const rolePill = (row: UserRow) => {
    const label = roleLabel(row);
    if (row.role === 'super_user')    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-white">{label}</span>;
    if (row.all_employees)            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">{label}</span>;
    return                                   <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">{label}</span>;
  };

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full border rounded-md pl-8 pr-8 py-2 text-sm bg-white"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {users.length} users · {superCount} super user{superCount !== 1 ? 's' : ''} · {managerCount} manager{managerCount !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1.5" />Add user
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="w-4 h-4 mr-1.5" />
          {copyLabel || 'Copy list for tech team'}
        </Button>
      </div>

      {/* Clipboard fallback */}
      {fallbackText !== null && (
        <div className="mb-4 p-3 bg-slate-50 border rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Copy it from here</span>
            <button onClick={() => setFallbackText(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <textarea
            ref={textareaRef}
            readOnly
            rows={6}
            className="w-full border rounded px-2 py-1.5 text-xs font-mono bg-white resize-none"
            value={fallbackText}
            onFocus={e => e.target.select()}
          />
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <UserForm
          editing={editing}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {/* Remove error */}
      {removeErr && <p className="text-red-500 text-sm mb-3">{removeErr}</p>}

      {/* Table */}
      <div className="rounded-lg border overflow-auto shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 700 }}>
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Name</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Email</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Role</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Groups</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Active</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r">Notes</th>
              <th className="px-3 py-2.5 border-b w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-red-500 text-sm">
                  Failed to load users.
                  <Button size="sm" variant="outline" className="ml-3" onClick={reload}>Retry</Button>
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No users match your search.</td>
              </tr>
            )}
            {!loading && !error && filtered.map(row => {
              const isMe = normalizeEmail(row.email) === realEmail;
              return (
                <tr key={String(row.id)} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 border-r font-medium">
                    {row.display_name || <span className="italic text-slate-400">—</span>}
                    {isMe && <span className="ml-1.5 text-[10px] text-slate-400 bg-slate-100 rounded px-1 py-0.5">you</span>}
                  </td>
                  <td className="px-3 py-2 border-r font-mono text-[11px] text-slate-500">{row.email}</td>
                  <td className="px-3 py-2 border-r">{rolePill(row)}</td>
                  <td className="px-3 py-2 border-r text-slate-500">
                    {row.role === 'super_user' ? '—' : row.group_count}
                  </td>
                  <td className="px-3 py-2 border-r">
                    {row.active
                      ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800">Active</span>
                      : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500">Inactive</span>}
                  </td>
                  <td className="px-3 py-2 border-r text-slate-500">{row.notes || ''}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Edit" onClick={() => handleEdit(row)} className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!isMe && row.active && (
                        <button title="See the app as this person" onClick={() => { setViewAs(row.email); navigate('/attendance'); }} className="p-1 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-700">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isMe && (
                        <button title="Remove" onClick={() => handleDelete(row)} className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
