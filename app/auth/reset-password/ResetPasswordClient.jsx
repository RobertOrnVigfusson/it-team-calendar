'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY'
);

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const [stage, setStage] = useState('verifying'); // verifying | ready | invalid | done
  const [err, setErr] = useState(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  useEffect(() => {
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (!token_hash || type !== 'recovery') {
      setStage('invalid');
      return;
    }

    let stop = false;
    supabase.auth.verifyOtp({ type: 'recovery', token_hash }).then(({ error }) => {
      if (stop) return;
      if (error) {
        setErr(error.message);
        setStage('invalid');
      } else {
        setStage('ready');
      }
    });
    return () => (stop = true);
  }, [params]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (pw1.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw1 !== pw2) return setErr("Passwords don't match.");

    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) return setErr(error.message);
    setStage('done');
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>

        {stage === 'verifying' && <p>Verifying reset link…</p>}
        {stage === 'invalid' && (
          <>
            <p className="text-red-500 font-medium">Invalid reset link</p>
            {err && <p className="text-sm text-gray-500">{err}</p>}
            <p className="text-sm text-gray-500">Request a new password reset.</p>
          </>
        )}
        {stage === 'ready' && (
          <form onSubmit={onSubmit} className="grid gap-3">
            <input
              type="password"
              className="border rounded px-3 py-2"
              placeholder="New password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              required
            />
            <input
              type="password"
              className="border rounded px-3 py-2"
              placeholder="Confirm password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
            />
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button className="bg-black text-white rounded px-4 py-2">Set password</button>
          </form>
        )}
        {stage === 'done' && <p>Password updated ✅ You can sign in now.</p>}
      </div>
    </div>
  );
}
