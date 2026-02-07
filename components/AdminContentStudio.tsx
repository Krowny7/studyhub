"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { QuizSetCreator } from "@/components/QuizSetCreator";
import { ExerciseSetCreator } from "@/components/ExerciseSetCreator";
import { CreateAction } from "@/components/CreateAction";

export type AdminContentRow = {
  kind: "quiz" | "exercise";
  id: string;
  title: string;
  visibility: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_official: boolean;
  official_published: boolean;
  difficulty: number;
  published_at: string | null;
  owner_id: string | null;
};

type KindFilter = "all" | "quiz" | "exercise";
type OfficialFilter = "all" | "official" | "basic";
type PublishedFilter = "all" | "published" | "draft";
type SortKey = "updated" | "created" | "published";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id: string | null) {
  if (!id) return "—";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function AdminContentStudio({ initialRows }: { initialRows: AdminContentRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { locale } = useI18n();
  const isFR = locale === "fr";

  const [rows, setRows] = useState<AdminContentRow[]>(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [official, setOfficial] = useState<OfficialFilter>("all");
  const [published, setPublished] = useState<PublishedFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  // Auto-clear small toasts
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const owners = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean))) as string[];
    return ids;
  }, [rows]);

  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owners.length) return;
      // fetch usernames in one go
      const res = await supabase.from("profiles").select("id,username").in("id", owners);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (res.data ?? []).forEach((p: any) => {
        map[String(p.id)] = p.username || shortId(p.id);
      });
      setOwnerMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [owners, supabase]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let out = rows;

    if (kind !== "all") out = out.filter((r) => r.kind === kind);
    if (official !== "all") out = out.filter((r) => (official === "official" ? r.is_official : !r.is_official));
    if (published !== "all") {
      out = out.filter((r) => (published === "published" ? r.official_published : r.is_official && !r.official_published));
    }
    if (qq) out = out.filter((r) => (r.title || "").toLowerCase().includes(qq));

    const getTime = (iso: string | null) => {
      const t = new Date(iso ?? 0).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    const sorted = [...out].sort((a, b) => {
      if (sort === "created") return getTime(b.created_at) - getTime(a.created_at);
      if (sort === "published") return getTime(b.published_at) - getTime(a.published_at);
      return getTime(b.updated_at ?? b.created_at) - getTime(a.updated_at ?? a.created_at);
    });

    return sorted;
  }, [rows, q, kind, official, published, sort]);

  async function mutateRow(row: AdminContentRow, next: Partial<AdminContentRow>) {
    const table = row.kind === "quiz" ? "quiz_sets" : "exercise_sets";
    const shareTable = row.kind === "quiz" ? "quiz_set_shares" : "exercise_set_shares";
    const nowIso = new Date().toISOString();

    const patch: any = {};
    if (typeof next.is_official === "boolean") {
      patch.is_official = next.is_official;
      // Promotion to official forces public visibility.
      if (next.is_official) patch.visibility = "public";
      // Demotion turns it into basic content.
      if (!next.is_official) {
        patch.official_published = false;
        patch.published_at = null;
        patch.difficulty = 1;
      }
    }
    if (typeof next.official_published === "boolean") {
      patch.official_published = row.is_official ? next.official_published : false;
      patch.published_at = row.is_official && next.official_published ? nowIso : null;
    }
    if (typeof next.difficulty === "number") {
      patch.difficulty = row.is_official ? next.difficulty : 1;
    }

    // Optimistic update
    setRows((prev) => prev.map((r) => (r.kind === row.kind && r.id === row.id ? { ...r, ...next } : r)));

    setBusyId(`${row.kind}:${row.id}`);
    try {
      const upd = await supabase.from(table).update(patch).eq("id", row.id);
      if (upd.error) throw upd.error;

      // Reference content should not have group shares.
      if (patch.is_official === true) {
        const del = await supabase.from(shareTable).delete().eq("set_id", row.id);
        if (del.error) console.warn(del.error);
      }

      setToast("✅");
    } catch (e: any) {
      // rollback by refetching the two tables (simple + reliable)
      const [quizRes, exRes] = await Promise.all([
        supabase
          .from("quiz_sets")
          .select("id,title,visibility,created_at,updated_at,is_official,official_published,difficulty,published_at,owner_id")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(500),
        supabase
          .from("exercise_sets")
          .select("id,title,visibility,created_at,updated_at,is_official,official_published,difficulty,published_at,owner_id")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(500)
      ]);
      const mapRow = (kind: "quiz" | "exercise", r: any): AdminContentRow => ({
        kind,
        id: String(r.id),
        title: String(r.title ?? ""),
        visibility: r.visibility ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
        is_official: Boolean(r.is_official),
        official_published: Boolean(r.official_published),
        difficulty: Number(r.difficulty ?? 1) || 1,
        published_at: r.published_at ?? null,
        owner_id: r.owner_id ?? null
      });
      const merged = [
        ...((quizRes.data ?? []) as any[]).map((r) => mapRow("quiz", r)),
        ...((exRes.data ?? []) as any[]).map((r) => mapRow("exercise", r))
      ].sort((a, b) => {
        const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return tb - ta;
      });
      setRows(merged);
      setToast(`❌ ${e?.message ?? (isFR ? "Erreur" : "Error")}`);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const all = rows.length;
    const official = rows.filter((r) => r.is_official).length;
    const published = rows.filter((r) => r.is_official && r.official_published).length;
    return { all, official, published };
  }, [rows]);

  return (
    <div className="grid gap-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{isFR ? "Création rapide" : "Quick create"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFR
                ? "Crée un set basique ou directement référencé (admin)."
                : "Create a basic set or directly an official (admin) set."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <CreateAction title={isFR ? "Créer un QCM" : "Create quiz"} buttonLabel={isFR ? "QCM" : "Quiz"}>
              <QuizSetCreator activeGroupId={null} isAdmin={true} />
            </CreateAction>
            <CreateAction title={isFR ? "Créer des exercices" : "Create exercises"} buttonLabel={isFR ? "Exercices" : "Exercises"}>
              <ExerciseSetCreator activeGroupId={null} isAdmin={true} />
            </CreateAction>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="badge badge-private">{counts.all} total</span>
          <span className="badge badge-public">{counts.official} {isFR ? "référencés" : "official"}</span>
          <span className="badge badge-shared">{counts.published} {isFR ? "publiés" : "published"}</span>
          {toast ? <span className="badge badge-shared">{toast}</span> : null}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{isFR ? "Contenus" : "Content"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFR
                ? "Promouvoir / rétrograder, publier, ajuster la difficulté."
                : "Promote/demote, publish, adjust difficulty."}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isFR ? "Rechercher…" : "Search…"}
            className="input sm:w-[260px]"
          />

          <select className="input sm:w-44" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="all">{isFR ? "Tous" : "All"}</option>
            <option value="quiz">{isFR ? "QCM" : "Quizzes"}</option>
            <option value="exercise">{isFR ? "Exercices" : "Exercises"}</option>
          </select>

          <select className="input sm:w-44" value={official} onChange={(e) => setOfficial(e.target.value as any)}>
            <option value="all">{isFR ? "Tous" : "All"}</option>
            <option value="official">{isFR ? "Référencés" : "Official"}</option>
            <option value="basic">{isFR ? "Basiques" : "Basic"}</option>
          </select>

          <select className="input sm:w-44" value={published} onChange={(e) => setPublished(e.target.value as any)}>
            <option value="all">{isFR ? "Tous" : "All"}</option>
            <option value="published">{isFR ? "Publiés" : "Published"}</option>
            <option value="draft">{isFR ? "Brouillons" : "Draft"}</option>
          </select>

          <select className="input sm:w-44" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="updated">{isFR ? "Tri : modifié" : "Sort: updated"}</option>
            <option value="created">{isFR ? "Tri : créé" : "Sort: created"}</option>
            <option value="published">{isFR ? "Tri : publié" : "Sort: published"}</option>
          </select>

          <button
            type="button"
            className="btn btn-ghost sm:ml-auto"
            onClick={() => {
              setQ("");
              setKind("all");
              setOfficial("all");
              setPublished("all");
              setSort("updated");
            }}
          >
            {isFR ? "Réinitialiser" : "Reset"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
            <thead className="text-xs opacity-70">
              <tr>
                <th className="px-3 text-left">{isFR ? "Type" : "Type"}</th>
                <th className="px-3 text-left">{isFR ? "Titre" : "Title"}</th>
                <th className="px-3 text-left">{isFR ? "Référence" : "Official"}</th>
                <th className="px-3 text-left">{isFR ? "Publication" : "Publish"}</th>
                <th className="px-3 text-left">{isFR ? "Difficulté" : "Difficulty"}</th>
                <th className="px-3 text-left">{isFR ? "Owner" : "Owner"}</th>
                <th className="px-3 text-left">{isFR ? "Modifié" : "Updated"}</th>
                <th className="px-3 text-left">{isFR ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const key = `${row.kind}:${row.id}`;
                const busy = busyId === key;
                const href = row.kind === "quiz" ? `/qcm/${row.id}` : `/exercises/${row.id}`;
                const ownerLabel = row.owner_id ? ownerMap[row.owner_id] || shortId(row.owner_id) : "—";
                return (
                  <tr key={key} className="rounded-xl border border-white/10 bg-white/[0.03]">
                    <td className="px-3 py-3">
                      <span className="badge badge-private">{row.kind === "quiz" ? "QCM" : isFR ? "Exo" : "Ex"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <Link href={href} className="font-semibold hover:underline">
                          {row.title || (isFR ? "Sans titre" : "Untitled")}
                        </Link>
                        <div className="mt-1 text-xs opacity-70">
                          {row.visibility ? `vis: ${row.visibility}` : ""} • {shortId(row.id)}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={`chip ${row.is_official ? "chip-active" : ""}`}
                        disabled={busy}
                        onClick={() => mutateRow(row, { is_official: !row.is_official })}
                        title={isFR ? "Basique ↔ Référencé" : "Basic ↔ Official"}
                      >
                        {row.is_official ? (isFR ? "Référencé" : "Official") : isFR ? "Basique" : "Basic"}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {row.is_official ? (
                        <button
                          type="button"
                          className={`chip ${row.official_published ? "chip-active" : ""}`}
                          disabled={busy}
                          onClick={() => mutateRow(row, { official_published: !row.official_published })}
                          title={fmtDate(row.published_at)}
                        >
                          {row.official_published ? (isFR ? "Publié" : "Published") : isFR ? "Brouillon" : "Draft"}
                        </button>
                      ) : (
                        <span className="text-xs opacity-60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.is_official ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="input h-9 w-40"
                            disabled={busy}
                            value={row.difficulty}
                            onChange={(e) => mutateRow(row, { difficulty: Number(e.target.value) })}
                          >
                            <option value={1}>1 — Easy</option>
                            <option value={2}>2 — Medium</option>
                            <option value={3}>3 — Hard</option>
                          </select>
                        </div>
                      ) : (
                        <span className="text-xs opacity-60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs opacity-80">{ownerLabel}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs opacity-80">{fmtDate(row.updated_at ?? row.created_at)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn btn-secondary" href={href} target="_blank">
                          {isFR ? "Ouvrir" : "Open"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filtered.length ? (
            <div className="mt-4 text-sm text-white/70">{isFR ? "Aucun résultat." : "No results."}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
