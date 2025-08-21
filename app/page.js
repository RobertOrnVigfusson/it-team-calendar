'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// ---------- PASTE YOUR VALUES ----------
const SUPABASE_URL = 'https://iztqeczxegnqlopiitys.supabase.co';   // <— replace if needed
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY'; // <— replace if needed
// --------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY
);

// Categories (additions: Doctor, Dentist, Barber)
const CATEGORIES = [
  'Work Trip',
  'Holiday',
  'Meeting',
  'Maintenance',
  'On-call',
  'Doctor',
  'Dentist',
  'Barber',
];

// Optional category -> color mapping (no defaults for Doctor/Dentist/Barber)
const CAT_COLORS = {
  'Work Trip': '#2563eb',
  Holiday: '#22c55e',
  Meeting: '#f59e0b',
  Maintenance: '#ef4444',
  'On-call': '#a855f7',
};

// 20 preset colors to choose from
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#737373', '#64748b', '#0f172a',
];

// Show category in parentheses for every event
const formatEventTitle = (r) => `${r.title} (${(r.category || '').toUpperCase()})`;

export default function Page() {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal + edit state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating
  const [form, setForm] = useState({
    title: '',
    category: 'Meeting',
    color: '', // '' means "use category color (if available)"
    startDate: '',
    endDate: '',
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load + realtime
  useEffect(() => {
    if (!session) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('id,title,description,category,start_time,end_time,color,created_by')
        .order('start_time', { ascending: true });
      if (!mounted) return;
      if (error) console.error(error);
      setRows(data || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel('events-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (p) => {
        setRows((prev) => {
          if (p.eventType === 'INSERT') return [...prev, p.new];
          if (p.eventType === 'UPDATE') return prev.map((r) => (r.id === p.new.id ? p.new : r));
          if (p.eventType === 'DELETE') return prev.filter((r) => r.id !== p.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session]);

  // Build calendar events (no hard fallback color; only apply when available)
  const events = useMemo(
    () =>
      rows.map((r) => {
        const eventColor = r.color || CAT_COLORS[r.category]; // may be undefined (allowed)
        const colorStyle = eventColor
          ? { backgroundColor: eventColor, borderColor: eventColor }
          : {};
        return {
          id: r.id,
          title: formatEventTitle(r),
          start: r.start_time,
          end: r.end_time,
          allDay: true,
          ...colorStyle,
          extendedProps: {
            category: r.category,
            color: r.color,
            created_by: r.created_by,
            rawTitle: r.title, // used when editing
          },
        };
      }),
    [rows]
  );

  // ---- Create flow (day click / range select) ----
  function handleDateClick(arg) {
    const d = new Date(arg.date);
    const iso = d.toISOString().slice(0, 10);
    openCreate({ startDate: iso, endDate: iso });
  }

  function handleSelect(sel) {
    const startIso = new Date(sel.start).toISOString().slice(0, 10);
    const end = new Date(sel.end || sel.start);
    end.setDate(end.getDate() - 1); // inclusive for UI
    const endIso = end.toISOString().slice(0, 10);
    openCreate({ startDate: startIso, endDate: endIso });
  }

  function openCreate(init) {
    setEditingId(null);
    setForm({
      title: '',
      category: 'Meeting',
      color: '',
      startDate: init.startDate,
      endDate: init.endDate,
    });
    setIsOpen(true);
  }

  // ---- Edit flow (click event) ----
  function handleEventClick(info) {
    const ev = info.event;
    const raw = ev.extendedProps;

    // convert exclusive end to inclusive date for form
    const endExclusive = new Date(ev.end || ev.start);
    endExclusive.setDate(endExclusive.getDate() - 1);
    const inclusiveEnd = endExclusive.toISOString().slice(0, 10);

    setEditingId(ev.id);
    setForm({
      title: raw.rawTitle || ev.title.replace(/\s+\([A-Z -]+\)$/, ''), // fallback strip
      category: raw.category || 'Meeting',
      color: raw.color || '',
      startDate: new Date(ev.start).toISOString().slice(0, 10),
      endDate: inclusiveEnd,
    });
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  // ---- Save (create or update) ----
  async function handleSave(e) {
    e?.preventDefault?.();
    if (!form.title.trim()) return alert('Please enter a title');
    if (!form.startDate || !form.endDate) return alert('Please choose dates');

    // store all-day range with exclusive end (endDate + 1)
    const start = new Date(form.startDate + 'T00:00:00');
    const endInc = new Date(form.endDate + 'T00:00:00');
    endInc.setDate(endInc.getDate() + 1);

    // use chosen color OR a category color if that category has one; otherwise null
    const colorToSave = form.color || CAT_COLORS[form.category] || null;

    if (editingId) {
      const { error } = await supabase
        .from('events')
        .update({
          title: form.title,
          category: form.category,
          color: colorToSave,
          start_time: start.toISOString(),
          end_time: endInc.toISOString(),
          description: null,
        })
        .eq('id', editingId);
      if (error) return alert(error.message);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('events').insert({
        title: form.title,
        category: form.category,
        color: colorToSave,
        start_time: start.toISOString(),
        end_time: endInc.toISOString(),
        description: null,
        created_by: userData?.user?.id ?? null,
      });
      if (error) return alert(error.message);
    }

    setIsOpen(false);
    setEditingId(null);
  }

  // ---- Delete (only in edit mode) ----
  async function handleDelete() {
    if (!editingId) return;
    if (!window.confirm('Delete this event? (Only the creator can delete)')) return;
    const { error } = await supabase.from('events').delete().eq('id', editingId);
    if (error) return alert(error.message);
    setIsOpen(false);
    setEditingId(null);
  }

  // ------------- UI -------------
  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-semibold mb-4 text-center">IT Team Calendar</h1>
          <div className="rounded-xl p-6 border">
            <Auth supabaseClient={supabase} providers={[]} appearance={{ theme: ThemeSupa }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold">IT Team Calendar</h1>
        <button className="border rounded px-3 py-1" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <div className="rounded-xl border p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="80vh"
          selectable
          selectMirror
          longPressDelay={150}
          dateClick={handleDateClick}
          select={handleSelect}
          events={events}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
        />
      </div>

      {loading && <p className="mt-3 text-sm text-gray-500">Loading events…</p>}

      {/* Popup form for Create + Edit */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-xl bg-white text-black p-5">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Edit calendar item' : 'New calendar item'}
            </h2>

            <form onSubmit={handleSave} className="grid gap-3">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Your Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Category</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Events display as: <em>Title (CATEGORY)</em>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Start date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">End date (inclusive)</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Color palette */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm">Color</label>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setForm((f) => ({ ...f, color: '' }))}
                    title="Use category color"
                  >
                    Use category color
                  </button>
                </div>

                <div className="grid grid-cols-10 gap-2">
                  {PALETTE.map((hex) => {
                    const selected = form.color === hex;
                    return (
                      <button
                        type="button"
                        key={hex}
                        onClick={() => setForm((f) => ({ ...f, color: hex }))}
                        title={hex}
                        className={`h-7 w-7 rounded-full border ${
                          selected ? 'ring-2 ring-black ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  If no color is selected, the category color will be used <em>if available</em>.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                {editingId ? (
                  <button type="button" className="text-red-600 underline" onClick={handleDelete}>
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button type="button" className="border rounded px-4 py-2" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="bg-black text-white rounded px-4 py-2">
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
