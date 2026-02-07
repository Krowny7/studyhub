"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="card p-6">
        <div className="text-lg font-semibold">Something went wrong</div>
        <div className="mt-2 text-sm text-white/70">
          The app encountered an error while rendering this page. You can retry, or open Diagnostics if this keeps happening.
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={() => reset()}>Retry</button>
          <a className="btn" href="/admin/diagnostics">Open diagnostics</a>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-white/80">Technical details</summary>
          <pre className="mt-3 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
{error.message}
{error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}
