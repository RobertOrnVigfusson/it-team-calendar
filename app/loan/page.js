'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

/** ----------------------------------------------------------------
 *  Supabase client with env fallbacks.
 *  In production, Vercel envs will be used.
 *  Locally, .env.local is used — if not present, these fallbacks kick in.
 *  ---------------------------------------------------------------- */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Equipment types (cards will render in this order) */
const TYPES = ['Mouse', 'Keyboard', 'Combo', 'Headset'];

/** Simple brand colors per type for accents */
const TYPE_COLORS = {
  Mouse: 'from-sky-500/20 to-sky-500/5',
  Keyboard: 'from-violet-500/20 to-violet-500/5',
  Combo: 'from-emerald-500/20 to-emerald-500/5',
  Headset: 'from-amber-500/20 to-amber-500/5',
};

export default function Page() {
  const [session, setSession] = useState(null);

  /** server data */
  const [items, setItems] = useState([]);       // from v_items
  const [models, setModels] = useState([]);     // from v_models
  const [loans, setLoans] = useState([]);       // history list (basic)

  const [loading, setLoading] = useState(true);

  /** add-inventory state (per type) */
  const [addQty, setAddQty] = useState(() =>
    Object.fromEntries(TYPES.map((t) => [t, 1]))
  );
  const [addModelId, setAddModelId] = useState(() =>
    Object.fromEntries(TYPES.map((t) => [t, '']))
  ); // stores a model string from models list (not an id)
  const [addModelName, setAddModelName] = useState(() =>
    Object.fromEntries(TYPES.map((t) => [t, '']))
  );

  /** show/hide unit list for each type */
  const [openType, setOpenType] = useState(() =>
    Object.fromEntries(TYPES.map((t) => [t, false]))
  );

  /** assign state */
  const [assignName, setAssignName] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignType, setAssignType] = useState('Mouse');
  const [assignUnitId, setAssignUnitId] = useState('');

  /** history filter/search */
  const [histFilterType, setHistFilterType] = useState('All');
  const [histQuery, setHistQuery] = useState('');

  /** Auth boot */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Load data helpers */
  async function loadAll() {
    const [{ data: vi }, { data: vm }, { data: ls }] = await Promise.all([
      supabase.from('v_items').select('*').order('type').order('tag'),
      supabase.from('v_models').select('*').order('type').order('model'),
      supabase.from('loans').select('*').order('started_at', { ascending: false }).limit(250),
    ]);

    setItems(vi || []);
    setModels(vm || []);
    setLoans(ls || []);
  }

  /** Initial + realtime */
  useEffect(() => {
    if (!session) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      await loadAll();
      if (mounted) setLoading(false);
    })();

    const channel = supabase
      .channel('loan-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, loadAll)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [session]);

  /** Derived maps */
  const itemsByType = useMemo(() => {
    const m = Object.fromEntries(TYPES.map((t) => [t, []]));
    for (const it of items) (m[it.type] ||= []).push(it);
    return m;
  }, [items]);

  const modelsByType = useMemo(() => {
    const m = Object.fromEntries(TYPES.map((t) => [t, []]));
    for (const md of models) (m[md.type] ||= []).push(md); // md.model, md.total, md.active, md.available
    return m;
  }, [models]);

  const countsByType = useMemo(() => {
    const m = Object.fromEntries(TYPES.map((t) => [t, { total: 0, out: 0, available: 0 }]));
    for (const it of items) {
      const c = m[it.type] || (m[it.type] = { total: 0, out: 0, available: 0 });
      c.total += 1;
      if (it.is_active) c.out += 1;
      else c.available += 1;
    }
    return m;
  }, [items]);

  const availableUnitsByType = useMemo(() => {
    const m = Object.fromEntries(TYPES.map((t) => [t, []]));
    for (const it of items) if (!it.is_active) (m[it.type] ||= []).push(it);
    // sort by model then tag
    for (const t of TYPES) {
      m[t].sort((a, b) => (a.model || '').localeCompare(b.model || '') || a.tag - b.tag);
    }
    return m;
  }, [items]);

  /** Add inventory */
  async function handleAddUnits(type) {
    const qty = Number(addQty[type] || 1);
    if (!qty || qty < 1) return;

    // chosen model name
    const chosenModel = (addModelId[type] || '').trim();
    const newModel = (addModelName[type] || '').trim();
    const model = newModel || chosenModel || 'Generic';

    // get current max tag for type
    const { data: max } = await supabase
      .from('items')
      .select('tag')
      .eq('type', type)
      .order('tag', { ascending: false })
      .limit(1)
      .maybeSingle();

    const start = (max?.tag || 0) + 1;
    const rows = Array.from({ length: qty }, (_, i) => ({
      type,
      tag: start + i,
      model,
    }));

    const { error } = await supabase.from('items').insert(rows);
    if (error) return alert(error.message);

    setAddQty((p) => ({ ...p, [type]: 1 }));
    // keep model selections
  }

  /** Return item from item row */
  async function handleReturn(itemId, loanId) {
    if (!loanId) return;
    if (!window.confirm('Mark this unit as returned?')) return;
    const { error } = await supabase
      .from('loans')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', loanId);
    if (error) alert(error.message);
  }

  /** Assign at bottom */
  const unitChoices = useMemo(() => availableUnitsByType[assignType] || [], [
    availableUnitsByType,
    assignType,
  ]);

  async function handleAssignSelected() {
    if (!assignName.trim()) return alert('Please enter employee name');
    if (!assignUnitId) return alert('Please choose a unit');

    const { error } = await supabase.from('loans').insert({
      item_id: assignUnitId,
      employee_name: assignName.trim(),
      employee_email: assignEmail.trim() || null,
    });
    if (error) return alert(error.message);

    setAssignUnitId('');
    // name can stay for faster multiple assigns
  }

  /** History derived */
  const historyRows = useMemo(() => {
    const search = histQuery.trim().toLowerCase();
    return (loans || [])
      .map((l) => {
        const it = items.find((x) => x.id === l.item_id);
        return {
          ...l,
          type: it?.type || '—',
          tag: it?.tag ?? '—',
          model: it?.model || '—',
        };
      })
      .filter((r) => (histFilterType === 'All' ? true : r.type === histFilterType))
      .filter((r) =>
        !search
          ? true
          : (`${r.employee_name || ''} ${r.employee_email || ''} ${r.model || ''} #${r.tag}`)
              .toLowerCase()
              .includes(search)
      );
  }, [loans, items, histFilterType, histQuery]);

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-semibold mb-4 text-center">IT Loan Tracker</h1>
          <div className="rounded-xl p-6 border">
            <Auth supabaseClient={supabase} providers={[]} appearance={{ theme: ThemeSupa }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">IT Loan Tracker</h1>
        <button className="border rounded px-3 py-1" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {TYPES.map((type) => {
          const c = countsByType[type] || { total: 0, out: 0, available: 0 };
          const typeItems = itemsByType[type] || [];
          const typeModels = modelsByType[type] || [];
          const open = openType[type];

          return (
            <div
              key={type}
              className={`rounded-xl border bg-gradient-to-b ${TYPE_COLORS[type]} p-4`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="uppercase tracking-wide text-sm opacity-80">{type}</div>
                  <div className="mt-1 text-4xl font-bold">{c.available}</div>
                  <div className="text-sm opacity-80">available</div>
                  <div className="text-xs opacity-60 mt-1">
                    {c.out} out &nbsp;•&nbsp; {c.total} total
                  </div>
                </div>

                <div className="text-xs bg-black/30 px-2 py-1 rounded-md">
                  {c.total} total
                </div>
              </div>

              {/* Add inventory (single-line grid) */}
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Add inventory</div>

                <div className="grid grid-cols-12 gap-2 items-stretch">
                  <input
                    type="number"
                    min={1}
                    value={addQty[type]}
                    onChange={(e) =>
                      setAddQty((p) => ({ ...p, [type]: Number(e.target.value || 1) }))
                    }
                    className="col-span-2 h-10 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-slate-100"
                  />

                  <select
                    value={addModelId[type]}
                    onChange={(e) =>
                      setAddModelId((p) => ({ ...p, [type]: e.target.value || '' }))
                    }
                    className="col-span-5 h-10 rounded-md border border-slate-600 px-3 dark-select"
                  >
                    <option value="">Choose existing model…</option>
                    {typeModels.map((m) => (
                      <option key={`${type}-${m.model}`} value={m.model}>
                        {m.model}
                      </option>
                    ))}
                  </select>

                  <input
                    value={addModelName[type]}
                    onChange={(e) =>
                      setAddModelName((p) => ({ ...p, [type]: e.target.value }))
                    }
                    placeholder="Or type new model name (optional)…"
                    className="col-span-4 h-10 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-slate-100"
                  />

                  <button
                    onClick={() => handleAddUnits(type)}
                    className="col-span-1 h-10 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    Add
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  Adds the next tag numbers for this type/model.
                </p>
              </div>

              {/* Model chips */}
              {typeModels.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Models</div>
                  <div className="flex flex-wrap gap-2">
                    {typeModels.map((m) => (
                      <div
                        key={`${type}-${m.model}-chip`}
                        className="px-3 py-2 rounded-lg border bg-black/20"
                      >
                        <div className="font-medium">{m.model}</div>
                        <div className="text-xs opacity-70">
                          {m.available} available • {m.out} out • {m.total} total
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Units list toggle */}
              <div className="mt-4">
                <button
                  onClick={() =>
                    setOpenType((p) => ({ ...p, [type]: !p[type] }))
                  }
                  className="text-sm underline opacity-80"
                >
                  {open ? 'Hide items' : 'View items'}
                </button>
              </div>

              {/* Units table */}
              {open && (
                <div className="mt-3 rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/20">
                      <tr>
                        <th className="p-2 text-left">Model</th>
                        <th className="p-2 text-left">Tag</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Employee</th>
                        <th className="p-2 text-left">Since</th>
                        <th className="p-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeItems.length === 0 ? (
                        <tr>
                          <td className="p-3" colSpan={6}>
                            No units
                          </td>
                        </tr>
                      ) : (
                        typeItems.map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="p-2">{it.model || 'Generic'}</td>
                            <td className="p-2">#{it.tag}</td>
                            <td className="p-2">
                              {it.is_active ? (
                                <span className="text-red-400">Active</span>
                              ) : (
                                <span className="text-emerald-400">Available</span>
                              )}
                            </td>
                            <td className="p-2">
                              {it.is_active ? (
                                <>
                                  <div className="font-medium">{it.employee_name}</div>
                                  <div className="text-xs opacity-70">
                                    {it.employee_email || '—'}
                                  </div>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-2">
                              {it.is_active && it.started_at
                                ? new Date(it.started_at).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="p-2">
                              {it.is_active ? (
                                <button
                                  onClick={() => handleReturn(it.id, it.active_loan_id)}
                                  className="px-3 py-1 rounded border"
                                >
                                  Return
                                </button>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign section */}
      <div className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-medium mb-3">Assign equipment</div>
        <div className="grid md:grid-cols-5 gap-3">
          <input
            className="h-10 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-slate-100"
            placeholder="Employee name"
            value={assignName}
            onChange={(e) => setAssignName(e.target.value)}
          />
          <input
            type="email"
            className="h-10 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-slate-100"
            placeholder="Employee email (optional)"
            value={assignEmail}
            onChange={(e) => setAssignEmail(e.target.value)}
          />
          <select
            value={assignType}
            onChange={(e) => {
              setAssignType(e.target.value);
              setAssignUnitId('');
            }}
            className="h-10 rounded-md border border-slate-600 px-3 dark-select"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border border-slate-600 px-3 dark-select"
            value={assignUnitId}
            onChange={(e) => setAssignUnitId(e.target.value || '')}
          >
            <option value="">
              {availableUnitsByType[assignType]?.length || 0} available /{' '}
              {countsByType[assignType]?.total || 0} total — Choose unit…
            </option>
            {unitChoices.map((u) => (
              <option key={u.id} value={u.id}>
                #{u.tag} — {u.model || 'Generic'}
              </option>
            ))}
          </select>

          <button
            onClick={handleAssignSelected}
            className="h-10 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            Assign selected unit
          </button>
        </div>
      </div>

      {/* History */}
      <div className="mt-6 rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">History</div>
          <div className="flex gap-2">
            <select
              value={histFilterType}
              onChange={(e) => setHistFilterType(e.target.value)}
              className="h-9 rounded-md border border-slate-600 px-3 dark-select"
            >
              <option>All</option>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              placeholder="Search by employee / model / tag…"
              className="h-9 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-slate-100"
              value={histQuery}
              onChange={(e) => setHistQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/20">
              <tr>
                <th className="p-2 text-left">Employee</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Tag</th>
                <th className="p-2 text-left">Since</th>
                <th className="p-2 text-left">Returned</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td className="p-3" colSpan={7}>
                    No history
                  </td>
                </tr>
              ) : (
                historyRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{r.employee_name}</div>
                      <div className="text-xs opacity-70">{r.employee_email || '—'}</div>
                    </td>
                    <td className="p-2">{r.type}</td>
                    <td className="p-2">{r.model}</td>
                    <td className="p-2">#{r.tag}</td>
                    <td className="p-2">
                      {r.started_at ? new Date(r.started_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-2">
                      {r.returned_at ? new Date(r.returned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-2">
                      {!r.returned_at ? (
                        <button
                          onClick={() => handleReturn(r.item_id, r.id)}
                          className="px-3 py-1 rounded border"
                        >
                          Return
                        </button>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <p className="mt-3 text-sm opacity-75">Loading…</p>}
    </div>
  );
}


