"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLocale } from "@/lib/useLocale";
import { t } from "@/lib/i18n/core";

type UserRow = { id: string; username: string | null; avatar_url?: string | null };

export function PvpInviteButton({ quizSetId }: { quizSetId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UserRow[]>([]);
  const [pick, setPick] = useState<UserRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setMsg(null);
      setPick(null);
      if (!open) return;
      if (!q.trim()) {
        setResults([]);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;

      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .ilike("username", `%${q.trim()}%`)
        .limit(10);

      if (!alive) return;
      if (error) {
        setResults([]);
        return;
      }

      const rows = (data ?? [])
        .map((r: any) => ({
          id: String(r.id),
          username: (r.username as string | null) ?? null,
          avatar_url: (r.avatar_url as string | null) ?? null
        }))
        .filter((r) => r.id !== me);

      setResults(rows);
    }

    const handle = setTimeout(run, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [open, q, supabase]);

  async function sendInvite() {
    if (!pick) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc("pvp_create_challenge", {
        p_quiz_set_id: quizSetId,
        p_opponent_id: pick.id
      });
      if (error) throw error;
      const challengeId = String(data);
      setOpen(false);
      router.push(`/challenges/${challengeId}`);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setOpen(true);
          setQ("");
          setPick(null);
          setResults([]);
          setMsg(null);
        }}
      >
        {t(locale, "pvp.challenge")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{t(locale, "pvp.challengeUser")}</div>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                ✕
              </button>
            </div>

            <div className="mt-3 text-xs opacity-70">
              {locale === "fr"
                ? "Tu joues sur ce QCM officiel. Le classement Elo n’évolue que via ces duels."
                : "You will play on this official quiz. Elo changes only through duels."}
            </div>

            <input
              className="mt-4 box-border w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              placeholder={t(locale, "pvp.searchUser")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="mt-3 grid gap-2">
              {results.length === 0 ? (
                <div className="text-sm opacity-70">
                  {q.trim() ? (locale === "fr" ? "Aucun résultat." : "No results.") : (locale === "fr" ? "Tape un pseudo…" : "Type a username…")}
                </div>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm hover:bg-white/5 ${
                      pick?.id === u.id ? "bg-white/5" : "bg-transparent"
                    }`}
                    onClick={() => setPick(u)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                            {String(u.username ?? u.id).trim().slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.username ?? u.id.slice(0, 8)}</div>
                        <div className="text-xs opacity-60 truncate">{u.id}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {msg ? <div className="mt-3 text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
                {t(locale, "common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={sendInvite} disabled={busy || !pick}>
                {busy ? t(locale, "common.saving") : t(locale, "pvp.sendInvite")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
