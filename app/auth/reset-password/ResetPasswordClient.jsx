'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Use envs in prod; if you test locally without .env.local, you can leave the fallbacks.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ResetPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState<'verifying' | 'ready' | 'invalid' | 'done'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  // Read URL params sent by Supabase
  const token_hash = params.get('token_hash') || params.get('token'); // token_hash is the one Supabase uses
  const type = params.get('type'); // should be "recovery"
  const emailParam = params.get('email');

  useEffect(() => {
    // Must have token + correct type
    if (!token_hash || type !== 'recovery') {
      setStatus('invalid');
      return;
    }

    // Verify the recovery link so this browser is authenticated
    const verify = async () => {
      const { error } = await supabase.auth.verifyOtp({
        email: emailParam ?? undefined,
        token_hash,
        type: 'recovery',
      });

      if (error) {
        setError(error.message);
        setStatus('invalid');
      } else {
        setStatus('ready');
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

    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      setError(error.message);
      return;
    }

    setStatus('done');
    // Optional: redirect after a short delay
    setTimeout(() => router.push('/'), 1500);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>

        {status === 'verifying' && <p>Verifying reset link…</p>}
        {status === 'invalid' && (
          <div className="text-red-500">
            <p className="mb-2">Invalid or expired password reset link.</p>
            {error ? <p className="text-sm opacity-80">{error}</p> : null}
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={onSubmit} className="grid gap-3">
            <div>
              <label className="block text-sm mb-1">New password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Confirm new password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="mt-2 flex justify-end">
              <button type="submit" className="bg-black text-white rounded px-4 py-2">
                Set password
              </button>
            </div>
          </form>
        )}

        {status === 'done' && <p>Password updated! Redirecting…</p>}
      </div>
    </div>
  );
}
