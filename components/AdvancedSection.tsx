"use client";

import { ReactNode } from "react";

export function AdvancedSection({
  label,
  children,
  className = ""
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group card-soft ${className}`.trim()}>
      <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-3 transition hover:bg-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-sm opacity-60 transition group-open:rotate-180">▼</div>
        </div>
      </summary>
      <div className="border-t border-white/10 p-4">{children}</div>
    </details>
  );
}
