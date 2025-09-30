'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Use envs in prod; fallback for local if needed
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();

  const tokenHash = params.get('token_hash') || '';
  const type = params.get('type') || '';

  const [stage, setStage] = useState<'verifying' | 'ready' | 'invalid' | 'done'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  // Verify the recovery token in this browser
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!tokenHash || type !== 'recovery') {
        if (mounted) setStage('invalid');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,          // only token_hash is required for recovery
      });

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setStage('invalid');
      } else {
        setStage('ready');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tokenHash, type]);

  async function onSubmit(e: React.FormEvent) {
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

    setStage('done');
    setTimeout(() => router.push('/'), 1500);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border p-5 bg-black/10">
        {stage === 'verifying' && <p>Verifying link…</p>}

        {stage === 'invalid' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Invalid reset link</h2>
            <p className="text-sm mb-2">
              The password reset link is missing, expired, already used, or malformed.
              Please request a new reset email and try again.
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </>
        )}

        {stage === 'ready' && (
          <>
            <h2 className="text-xl font-semibold mb-4">Set a new password</h2>
            <form onSubmit={onSubmit} className="grid gap-3">
              <div>
                <label className="text-sm block mb-1">New password</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Confirm password</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-white text-black border rounded px-4 py-2"
                >
                  Update password
                </button>
              </div>
            </form>
          </>
        )}

        {stage === 'done' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Password updated</h2>
            <p className="text-sm">Redirecting you to sign in…</p>
          </>
        )}
      </div>
    </div>
  );
}
