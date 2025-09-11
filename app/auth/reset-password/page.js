'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Use env vars in prod; fallback only for local testing
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iztqeczxegnqlopiitys.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dHFlY3p4ZWducWxvcGlpdHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYyNzMsImV4cCI6MjA3MDgzMjI3M30.k4VEC3WvlN9fg-YtgR7Ehj41rCScTLEXbfq4wV9e7uY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'ready' | 'invalid' | 'done'
  const [email, setEmail] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const token_hash = params.get('token_hash');
    const type = params.get('type'); // should be "recovery"
    const emailParam = params.get('email');

    if (!token_hash || !type || !emailParam) {
      setStatus('invalid');
      return;
    }

    setEmail(emailParam);

    supabase.auth
      .verifyOtp({ email: emailParam, token_hash, type })
      .then(({ error }) => {
        if (error) {
          setError(error.message);
          setStatus('invalid');
        } else {
          setStatus('ready');
        }
      });
  }, [params]);

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
    setTimeout(() => router.push('/'), 1500);
  }

  if (status === 'verifying') {
    return (
      <div className="grid place-items-center min-h-screen p-6">
        <p>Verifying link…</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="grid place-items-center min-h-screen p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl mb-2">Invalid or expired link</h1>
          <p className="text-sm text-gray-500">Please request a new password reset.</p>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="grid place-items-center min-h-screen p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl mb-2">Password changed</h1>
          <p className="text-sm text-gray-500">Redirecting…</p>
        </div>
      </div>
    );
  }

  // status === 'ready'
  return (
    <div className="grid place-items-center min-h-screen p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md border rounded-xl p-6">
        <h1 className="text-xl font-semibold mb-2">Set a new password</h1>
        <p className="text-sm text-gray-500 mb-4">
          for <strong>{email}</strong>
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <label className="block text-sm mb-1">New password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-3"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Confirm password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-4"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />

        <button type="submit" className="bg-black text-white rounded px-4 py-2 w-full">
          Update password
        </button>
      </form>
    </div>
  );
}

