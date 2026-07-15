'use client';

import { useState } from 'react';

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; user can select manually */
    }
  };
  return { copied, copy };
}

/** Inline copyable value (e.g. a link or code). */
export function CopyInline({ value, mono }: { value: string; mono?: boolean }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      dir="ltr"
      onClick={() => copy(value)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left text-cyan-300 transition-colors hover:border-white/25 ${
        mono ? 'font-mono' : ''
      }`}
    >
      <span className="truncate text-xs">{value}</span>
      <span className="shrink-0 text-xs text-slate-400">{copied ? 'کپی شد ✅' : 'کپی'}</span>
    </button>
  );
}

/** A titled block for a longer payload (e.g. a VPN config). */
export function CopyBox({ title, payload }: { title?: string; payload: string }) {
  const { copied, copy } = useCopy();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        {title && <span className="text-xs font-semibold text-slate-300">{title}</span>}
        <button type="button" className="btn-ghost text-xs" onClick={() => copy(payload)}>
          {copied ? 'کپی شد ✅' : 'کپی'}
        </button>
      </div>
      <code
        dir="ltr"
        className="block max-h-40 overflow-auto rounded-lg bg-black/50 px-3 py-2 text-left font-mono text-xs leading-6 text-cyan-300"
        style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
      >
        {payload}
      </code>
    </div>
  );
}
