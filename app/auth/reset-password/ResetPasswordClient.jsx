'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Env (with fallbacks so it still works if Vercel envs are missing)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ResetPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'ready' | 'invalid' | 'done'
  const [error, setError] = useState(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  // Read params from URL
  const token_hash = params?.get('token_hash') || params?.get('token');
  const type = params?.get('type');
  const emailParam = params?.get('email') || undefined;

  useEffect(() => {
    // Must have required params
    if (!token_hash || type !== 'recovery') {
      setStatus('invalid');
      return;
    }

    const verify = async () => {
      try {
        // Build payload safely (email is optional)
        const payload = { type: 'recovery', token_hash };
        if (emailParam) payload.email = emailParam;

        // Helpful logs if something goes wrong in prod
        // (Open DevTools console on the failing page to see these)
        console.log('[reset-password] verifying payload:', payload);

        const { error } = await supabase.auth.verifyOtp(payload);

        if (error) {
          console.error('[reset-password] verifyOtp error:', error);
          setError(error.message);
          setStatus('invalid');
        } else {
          setStatus('ready');
        }
      } catch (e) {
        console.error('[reset-password] unexpected error:', e);
        setError('Unexpected error verifying reset link.');
        setStatus('invalid');
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token_hash, type, emailParam]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    if (pw1.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) {
        setError(error.message);
        return;
      }
      setStatus('done');
      setTimeout(() => router.push('/'), 1200);
    } catch (e) {
      console.error('[reset-password] updateUser error:', e);
      setError('Could not update password.');
    }
  }

  // ---------- UI ----------
  if (status === 'verifying') {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full rounded-xl border p-6">Verifying link…</div>
      </main>
    );
  }

  if (status === 'invalid') {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full rounded-xl border p-6">
          <h1 className="text-xl font-semibold mb-2">Invalid reset link</h1>
          <p className="text-sm text-gray-500 mb-4">
            The password reset link is missing, expired, or already used.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Password updated</h1>
          <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
        </div>
      </main>
    );
  }

  // status === 'ready'
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full rounded-xl border p-6">
        <h1 className="text-xl font-semibold mb-4">Reset your password</h1>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm mb-1">New password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Confirm password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="bg-black text-white rounded px-4 py-2 mt-1">
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
