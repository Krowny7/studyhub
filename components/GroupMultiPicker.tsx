"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

export type GroupOption = { id: string; name: string };

function dedupeGroups(input: GroupOption[]): GroupOption[] {
  // Keep first occurrence (we order desc by created_at, so first is the most recent)
  const seen = new Set<string>();
  const out: GroupOption[] = [];
  for (const g of input) {
    if (!g?.id) continue;
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export function GroupMultiPicker({
  value,
  onChange,
  defaultSelectGroupId
}: {
  value: string[];
  onChange: (next: string[]) => void;
  defaultSelectGroupId?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const allSelected = groups.length > 0 && value.length === groups.length;

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Get groups the user belongs to
      const { data, error } = await supabase
        .from("group_memberships")
        .select("group_id, study_groups ( id, name )")
        .order("created_at", { ascending: false });

      if (error) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const raw: GroupOption[] = (data ?? [])
        .map((row: any) => ({
          id: row.study_groups?.id ?? row.group_id,
          name: row.study_groups?.name ?? "(group)"
        }))
        .filter((x: any) => Boolean(x.id));

      const unique = dedupeGroups(raw);

      setGroups(unique);
      setLoading(false);

      // If nothing selected yet, optionally auto-select the active group.
      if (value.length === 0 && defaultSelectGroupId) {
        const exists = unique.some((gg) => gg.id === defaultSelectGroupId);
        if (exists) onChange([defaultSelectGroupId]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{t("sharing.groups")}</div>
        <label className="flex items-center gap-2 text-xs opacity-80">
          <input
            type="checkbox"
            className="accent-blue-400"
            checked={allSelected}
            disabled={loading || groups.length === 0}
            onChange={(e) => {
              if (e.target.checked) onChange(groups.map((gg) => gg.id));
              else onChange([]);
            }}
          />
          {t("sharing.allMyGroups")}
        </label>
      </div>

      {loading ? (
        <div className="mt-2 text-xs opacity-70">{t("common.loading")}</div>
      ) : groups.length === 0 ? (
        <div className="mt-2 text-xs opacity-70">{t("sharing.noGroups")}</div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {groups.map((g) => {
            const checked = value.includes(g.id);
            return (
              <label
                key={g.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm transition hover:bg-white/[0.05]"
              >
                <input
                  type="checkbox"
                  className="accent-blue-400"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...new Set([...value, g.id])]);
                    else onChange(value.filter((x) => x !== g.id));
                  }}
                />
                <span className="truncate">{g.name}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-2 text-xs opacity-70">{t("sharing.groupsHint")}</div>
    </div>
  );
}