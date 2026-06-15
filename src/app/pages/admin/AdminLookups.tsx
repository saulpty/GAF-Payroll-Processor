import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import {
  Zap, Plus, Trash2, ArrowRight, Info, Pencil, Check, X,
  List, ChevronDown, SlidersHorizontal, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import loadEventTypesAction from '@/actions/loadEventTypes';
import loadPayImpactsAction from '@/actions/loadPayImpacts';
import loadDocumentationOptionsAction from '@/actions/loadDocumentationOptions';
import loadEventTypeRulesAction from '@/actions/loadEventTypeRules';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import upsertEventTypeAction from '@/actions/upsertEventType';
import upsertPayImpactAction from '@/actions/upsertPayImpact';
import upsertDocumentationOptionAction from '@/actions/upsertDocumentationOption';
import deleteEventTypeAction from '@/actions/deleteEventType';
import deletePayImpactAction from '@/actions/deletePayImpact';
import deleteDocumentationOptionAction from '@/actions/deleteDocumentationOption';
import upsertEventTypeRuleAction from '@/actions/upsertEventTypeRule';
import deleteEventTypeRuleAction from '@/actions/deleteEventTypeRule';
import upsertClassificationConfigAction from '@/actions/upsertClassificationConfig';

type LookupRow = { id: number; name: string };
type RuleRow = {
  id: number;
  event_type: string;
  default_pay_impact: string;
  default_doc_option: string;
  notes: string;
};

const EMPTY_RULE: Omit<RuleRow, 'id'> = {
  event_type: '',
  default_pay_impact: '',
  default_doc_option: '',
  notes: '',
};

// ── Classification Config types & components ─────────────────────────────────

type ConfigRow = {
  id: number;
  key: string;
  value: string;
  label: string;
  description: string;
  value_type: string;
  category: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  tardiness:      'Tardiness Rules',
  grace:          'Grace Rules',
  absence:        'Absence Rules',
  early_leave:    'Early Leave Rules',
  monday_boards:  'Monday.com Board IDs',
  monday_columns: 'Monday.com Column IDs',
};

const CATEGORY_ORDER = ['tardiness', 'grace', 'absence', 'early_leave', 'monday_boards', 'monday_columns'];

function ConfigValueEditor({
  row, impactOpts, onSave,
}: {
  row: ConfigRow;
  impactOpts: string[];
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.value);
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(row.value); setEditing(true); };
  const cancel = () => { setDraft(row.value); setEditing(false); };
  const save = async () => {
    setSaving(true);
    await onSave(row.key, draft);
    setSaving(false);
    setEditing(false);
  };

  const displayValue = () => {
    if (row.value_type === 'boolean') return row.value === 'true'
      ? <span className="text-green-700 font-semibold">Yes</span>
      : <span className="text-red-600 font-semibold">No</span>;
    if (!row.value) return <span className="text-slate-400 italic">— blank —</span>;
    return <span className="font-mono">{row.value}</span>;
  };

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50/50 group">
      <td className="px-3 py-2.5 w-64 align-top">
        <div className="text-xs font-medium text-slate-700">{row.label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{row.description}</div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {row.value_type === 'boolean' ? (
              <select className="border rounded px-2 py-1 text-xs bg-white w-24" value={draft} onChange={e => setDraft(e.target.value)}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : row.value_type === 'impact' ? (
              <select className="border rounded px-2 py-1 text-xs bg-white" value={draft} onChange={e => setDraft(e.target.value)}>
                <option value="">— blank (operator decides) —</option>
                {impactOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={row.value_type === 'number' ? 'number' : 'text'}
                className="border rounded px-2 py-1 text-xs bg-white w-52 font-mono"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                autoFocus
              />
            )}
            <button onClick={save} disabled={saving}
              className="w-6 h-6 rounded bg-green-600 hover:bg-green-700 text-white flex items-center justify-center disabled:opacity-50 transition-colors">
              {saving ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={cancel} className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs">{displayValue()}</span>
            <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <code className="text-[10px] text-muted-foreground">{row.key}</code>
      </td>
    </tr>
  );
}

function ClassificationConfigPanel({
  rows, impactOpts, onSave,
}: {
  rows: ConfigRow[];
  impactOpts: string[];
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(['tardiness', 'grace'])
  );
  const toggle = (cat: string) => setOpenCategories(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ConfigRow[]>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [rows]);

  const orderedCats = CATEGORY_ORDER.filter(c => grouped.has(c));

  if (rows.length === 0) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
      <AlertCircle className="w-4 h-4" />
      Config table not found — migration may still be pending.
    </div>
  );

  return (
    <div className="space-y-3">
      {orderedCats.map(cat => (
        <div key={cat} className="border rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => toggle(cat)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{CATEGORY_LABELS[cat] ?? cat}</span>
              <Badge variant="outline" className="text-[10px] font-normal">{grouped.get(cat)!.length}</Badge>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openCategories.has(cat) ? 'rotate-180' : ''}`} />
          </button>
          {openCategories.has(cat) && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-white">
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-slate-400 font-semibold w-64">Setting</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Current Value</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-slate-400 font-semibold w-52">Config Key</th>
                </tr>
              </thead>
              <tbody>
                {grouped.get(cat)!.map(r => (
                  <ConfigValueEditor key={r.key} row={r} impactOpts={impactOpts} onSave={onSave} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
// ── Inline-editable rule row ──────────────────────────────────────────────────
function RuleRow({
  rule, impactOpts, docOpts, onSave, onDelete,
}: {
  rule: RuleRow;
  impactOpts: string[];
  docOpts: string[];
  onSave: (updated: RuleRow) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RuleRow>(rule);
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(rule); setEditing(true); };
  const cancel = () => { setDraft(rule); setEditing(false); };
  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-blue-50 border-b">
        <td className="px-3 py-2 border-r">
          <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-blue-200 inline-block">{rule.event_type}</span>
        </td>
        <td className="px-2 py-1.5 border-r">
          <select className="w-full border rounded px-2 py-1 text-xs bg-white"
            value={draft.default_pay_impact}
            onChange={e => setDraft(d => ({ ...d, default_pay_impact: e.target.value }))}>
            <option value="">— none —</option>
            {impactOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </td>
        <td className="px-2 py-1.5 border-r">
          <select className="w-full border rounded px-2 py-1 text-xs bg-white"
            value={draft.default_doc_option}
            onChange={e => setDraft(d => ({ ...d, default_doc_option: e.target.value }))}>
            <option value="">— none —</option>
            {docOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </td>
        <td className="px-2 py-1.5 border-r">
          <input className="w-full border rounded px-2 py-1 text-xs bg-white"
            placeholder="Optional notes…"
            value={draft.notes || ''}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
        </td>
        <td className="px-2 py-2 text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <button onClick={save} disabled={saving}
              className="w-6 h-6 rounded bg-green-600 hover:bg-green-700 flex items-center justify-center text-white transition-colors">
              {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={cancel}
              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
              <X className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const hasImpact = !!rule.default_pay_impact;
  const hasDoc    = !!rule.default_doc_option;

  return (
    <tr className="border-b hover:bg-slate-50 group transition-colors">
      <td className="px-3 py-2.5 border-r">
        <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-700">{rule.event_type}</span>
      </td>
      <td className="px-3 py-2.5 border-r">
        {hasImpact
          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{rule.default_pay_impact}</span>
          : <span className="text-xs text-slate-300 italic">not set</span>}
      </td>
      <td className="px-3 py-2.5 border-r">
        {hasDoc
          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">{rule.default_doc_option}</span>
          : <span className="text-xs text-slate-300 italic">not set</span>}
      </td>
      <td className="px-3 py-2.5 border-r text-xs text-slate-500 max-w-48 truncate" title={rule.notes}>{rule.notes || <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center gap-1.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit}
            className="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(rule.id)}
            className="w-6 h-6 rounded bg-slate-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Add-rule form ────────────────────────────────────────────────────────────
function AddRuleRow({
  eventOpts, impactOpts, docOpts, coveredEvents, onAdd,
}: {
  eventOpts: string[];
  impactOpts: string[];
  docOpts: string[];
  coveredEvents: Set<string>;
  onAdd: (r: Omit<RuleRow, 'id'>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Omit<RuleRow, 'id'>>({ ...EMPTY_RULE });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const uncovered = eventOpts.filter(e => !coveredEvents.has(e));

  const handleAdd = async () => {
    if (!draft.event_type) return;
    setSaving(true);
    await onAdd(draft);
    setDraft({ ...EMPTY_RULE });
    setSaving(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="px-4 py-3 border-t bg-slate-50">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          <Plus className="w-4 h-4" />Add new rule
          {uncovered.length > 0 && <span className="text-xs text-slate-400 font-normal">({uncovered.length} event type{uncovered.length > 1 ? 's' : ''} without a rule)</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t bg-blue-50/60 px-4 py-4">
      <p className="text-xs font-semibold text-blue-800 mb-3 flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> New Rule
      </p>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Event Type *</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            value={draft.event_type}
            onChange={e => setDraft(d => ({ ...d, event_type: e.target.value }))}>
            <option value="">— select —</option>
            {uncovered.length > 0 && <optgroup label="No rule yet">
              {uncovered.map(e => <option key={e} value={e}>{e}</option>)}
            </optgroup>}
            {coveredEvents.size > 0 && <optgroup label="Already has a rule">
              {eventOpts.filter(e => coveredEvents.has(e)).map(e => <option key={e} value={e}>{e}</option>)}
            </optgroup>}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Default Pay Impact</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            value={draft.default_pay_impact}
            onChange={e => setDraft(d => ({ ...d, default_pay_impact: e.target.value }))}>
            <option value="">— none —</option>
            {impactOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Default Doc Option</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            value={draft.default_doc_option}
            onChange={e => setDraft(d => ({ ...d, default_doc_option: e.target.value }))}>
            <option value="">— none —</option>
            {docOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            placeholder="Optional…"
            value={draft.notes}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={!draft.event_type || saving}>
          {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
          Add Rule
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setDraft({ ...EMPTY_RULE }); setOpen(false); }}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Values manager (compact accordion) ──────────────────────────────────────
function ValuesPanel({ eventTypes, payImpacts, docOptions, reloadET, reloadPI, reloadDO }: {
  eventTypes: LookupRow[]; payImpacts: LookupRow[]; docOptions: LookupRow[];
  reloadET: () => Promise<void>; reloadPI: () => Promise<void>; reloadDO: () => Promise<void>;
}) {
  const [upsertET] = useMutateAction(upsertEventTypeAction);
  const [upsertPI] = useMutateAction(upsertPayImpactAction);
  const [upsertDO] = useMutateAction(upsertDocumentationOptionAction);
  const [delET] = useMutateAction(deleteEventTypeAction);
  const [delPI] = useMutateAction(deletePayImpactAction);
  const [delDO] = useMutateAction(deleteDocumentationOptionAction);
  const [newVals, setNewVals] = useState<Record<string, string>>({});

  type ListDef = {
    key: string; title: string; rows: LookupRow[];
    reload: () => Promise<void>;
    add: (name: string) => Promise<void>;
    del: (id: number) => Promise<void>;
  };

  const lists: ListDef[] = [
    {
      key: 'event_types', title: 'Event Types', rows: eventTypes, reload: reloadET,
      add: name => upsertET({ name }),
      del: id => delET({ id }),
    },
    {
      key: 'pay_impacts', title: 'Pay Impacts', rows: payImpacts, reload: reloadPI,
      add: name => upsertPI({ name }),
      del: id => delPI({ id }),
    },
    {
      key: 'documentation_options', title: 'Documentation Options', rows: docOptions, reload: reloadDO,
      add: name => upsertDO({ name }),
      del: id => delDO({ id }),
    },
  ];

  const handleAdd = async (list: ListDef) => {
    const val = (newVals[list.key] || '').trim();
    if (!val) return;
    await list.add(val);
    setNewVals(prev => ({ ...prev, [list.key]: '' }));
    await list.reload();
  };

  const handleDel = async (list: ListDef, id: number) => {
    if (!window.confirm('Delete this value?')) return;
    await list.del(id);
    await list.reload();
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {lists.map(list => (
        <div key={list.key} className="border rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 font-medium text-xs uppercase tracking-wide text-slate-500 border-b flex items-center justify-between">
            {list.title}
            <Badge variant="outline" className="text-[10px] font-normal">{list.rows.length}</Badge>
          </div>
          <div className="p-2 border-b flex gap-1.5">
            <input className="border rounded px-2 py-1 text-xs flex-1 bg-white" placeholder="Add value…"
              value={newVals[list.key] || ''}
              onChange={e => setNewVals(prev => ({ ...prev, [list.key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd(list)} />
            <button onClick={() => handleAdd(list)} disabled={!(newVals[list.key] || '').trim()}
              className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-40 transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {list.rows.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 hover:bg-slate-50 group">
                <span className="text-xs text-slate-700">{r.name}</span>
                <button onClick={() => handleDel(list, r.id)}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {list.rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Empty</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminRules() {
  const [eventTypes, , , reloadET] = useLoadAction(loadEventTypesAction, [] as LookupRow[]);
  const [payImpacts, , , reloadPI] = useLoadAction(loadPayImpactsAction, [] as LookupRow[]);
  const [docOptions, , , reloadDO] = useLoadAction(loadDocumentationOptionsAction, [] as LookupRow[]);
  const [rules, , , reloadRules] = useLoadAction(loadEventTypeRulesAction, [] as RuleRow[]);
  const [configRows, , , reloadConfig] = useLoadAction(loadClassificationConfigAction, [] as ConfigRow[]);
  const [upsertRule] = useMutateAction(upsertEventTypeRuleAction);
  const [deleteRule] = useMutateAction(deleteEventTypeRuleAction);
  const [upsertConfig] = useMutateAction(upsertClassificationConfigAction);
  const [showValues, setShowValues] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const ruleRows = rules as RuleRow[];
  const eventOpts = (eventTypes as LookupRow[]).map(e => e.name);
  const impactOpts = (payImpacts as LookupRow[]).map(p => p.name);
  const docOpts = (docOptions as LookupRow[]).map(d => d.name);
  const coveredEvents = useMemo(() => new Set(ruleRows.map(r => r.event_type)), [ruleRows]);
  const uncoveredCount = eventOpts.filter(e => !coveredEvents.has(e)).length;

  const handleSave = async (updated: RuleRow) => {
    await upsertRule({
      event_type: updated.event_type,
      default_pay_impact: updated.default_pay_impact,
      default_doc_option: updated.default_doc_option || null,
      notes: updated.notes || '',
    });
    await reloadRules();
  };

  const handleAdd = async (draft: Omit<RuleRow, 'id'>) => {
    await upsertRule({
      event_type: draft.event_type,
      default_pay_impact: draft.default_pay_impact,
      default_doc_option: draft.default_doc_option || null,
      notes: draft.notes || '',
    });
    await reloadRules();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this rule?')) return;
    await deleteRule({ id });
    await reloadRules();
  };

  const handleConfigSave = async (key: string, value: string) => {
    const row = (configRows as ConfigRow[]).find(r => r.key === key);
    if (!row) return;
    await upsertConfig({
      key,
      value,
      label: row.label,
      description: row.description,
      value_type: row.value_type,
      category: row.category,
    });
    await reloadConfig();
  };

  return (
    <div className="p-6 max-w-5xl">

      {/* Classification Config accordion */}
      <div className="border rounded-xl overflow-hidden shadow-sm mb-8">
        <button
          onClick={() => setShowConfig(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors border-b text-left"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-slate-700">Auto-Classification Settings</span>
            <Badge variant="outline" className="text-[10px] font-normal text-violet-700 border-violet-300">
              {(configRows as ConfigRow[]).length} settings
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">— thresholds, auto-resolve rules, Monday board & column IDs</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>
        {showConfig && (
          <div className="p-4">
            <ClassificationConfigPanel
              rows={configRows as ConfigRow[]}
              impactOpts={impactOpts}
              onSave={handleConfigSave}
            />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold">Rules</h2>
            <Badge variant="secondary" className="text-xs">{ruleRows.length}</Badge>
            {uncoveredCount > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                {uncoveredCount} event type{uncoveredCount > 1 ? 's' : ''} without a rule
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            When an Event Type is chosen in Action Required or Payroll Master, these rules auto-fill the Pay Impact and Documentation fields.
          </p>
        </div>
      </div>

      {/* Rules table */}
      <div className="border rounded-xl overflow-hidden shadow-sm mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-r w-56">
                Event Type
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-r">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />Default Pay Impact
                </span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-r">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />Default Doc Option
                </span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-r">Notes</th>
              <th className="px-3 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {ruleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No rules yet — add one below.
                </td>
              </tr>
            )}
            {ruleRows.map(r => (
              <RuleRow
                key={r.id}
                rule={r}
                impactOpts={impactOpts}
                docOpts={docOpts}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
        <AddRuleRow
          eventOpts={eventOpts}
          impactOpts={impactOpts}
          docOpts={docOpts}
          coveredEvents={coveredEvents}
          onAdd={handleAdd}
        />
      </div>

      {/* Explanation callout */}
      <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mb-6">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
        <span>
          Rules apply globally. When an employee entry has an Event Type selected and the Pay Impact or Documentation fields are empty,
          the rule auto-fills them. You can always override manually in the editor.
        </span>
      </div>

      {/* Values accordion */}
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowValues(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b text-left"
        >
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Manage Dropdown Values</span>
            <span className="text-xs text-muted-foreground">— edit the available Event Types, Pay Impacts, and Doc Options</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showValues ? 'rotate-180' : ''}`} />
        </button>
        {showValues && (
          <div className="p-4">
            <ValuesPanel
              eventTypes={eventTypes as LookupRow[]}
              payImpacts={payImpacts as LookupRow[]}
              docOptions={docOptions as LookupRow[]}
              reloadET={reloadET}
              reloadPI={reloadPI}
              reloadDO={reloadDO}
            />
          </div>
        )}
      </div>
    </div>
  );
}
