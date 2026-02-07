import { levelInfoFromXp } from "@/lib/leveling";

export function LevelBar({ xpTotal }: { xpTotal: number }) {
  const info = levelInfoFromXp(xpTotal);
  const pct = Math.round(info.progressPct * 100);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Niveau {info.level}</div>
        <div className="text-xs opacity-70">
          {info.xpIntoLevel}/{info.xpForNextLevel} XP
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
      </div>

      <div className="text-[11px] opacity-70">{info.xpToNextLevel} XP avant le prochain niveau</div>
    </div>
  );
}
