"use client";

import { useMemo } from "react";

export type XpDay = { day: string; xp: number };

/**
 * Lightweight bar chart (no external libs).
 * Expects `day` as YYYY-MM-DD.
 */
export function XpBarChart({ data, title }: { data: XpDay[]; title?: string }) {
  const maxXp = useMemo(() => Math.max(0, ...data.map((d) => d.xp || 0)), [data]);
  const safeMax = maxXp || 1;

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{title ?? "XP (90 jours)"}</div>
        <div className="text-xs opacity-70">max/jour: {maxXp}</div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(90,minmax(0,1fr))] items-end gap-[2px]">
        {data.map((d) => {
          const h = Math.max(2, Math.round((d.xp / safeMax) * 60));
          return (
            <div key={d.day} className="group relative">
              <div
                className="w-full rounded-sm bg-white/70 opacity-70 group-hover:opacity-100"
                style={{ height: `${h}px` }}
                title={`${d.day} : ${d.xp} XP`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] opacity-70">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}
