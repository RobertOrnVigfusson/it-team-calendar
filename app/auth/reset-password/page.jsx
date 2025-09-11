// app/auth/reset-password/page.jsx
import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center p-6">
          <div className="max-w-md w-full rounded-xl border p-6">Loading…</div>
        </main>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}



