import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

// Make sure Next doesn't try to pre-render this page at build time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}


