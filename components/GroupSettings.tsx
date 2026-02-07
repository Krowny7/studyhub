"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

type GroupRow = {
  group_id: string;
  study_groups?: {
    id: string;
    name: string;
    invite_code?: string | null;
  } | null;
};

function groupIdOf(row: GroupRow): string {
  return (row as any)?.study_groups?.id ?? (row as any)?.group_id;
}

function groupNameOf(row: GroupRow): string {
  return (row as any)?.study_groups?.name ?? "(group)";
}

function groupInviteOf(row: GroupRow): string {
  return String((row as any)?.study_groups?.invite_code ?? "");
}

export function GroupSettings({ activeGroupId, groups }: { activeGroupId: string | null; groups: any[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");

  // global ui states
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // per-row action states
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // auth/user
  const [userId, setUserId] = useState<string | null>(null);

  // owner map (best-effort; if column doesn't exist or RLS blocks, we just won't show owner-only labeling)
  const [ownerByGroupId, setOwnerByGroupId] = useState<Record<string, string | null>>({});

  const rows: GroupRow[] = (groups ?? []) as any;

  const ids = useMemo(() => rows.map(groupIdOf).filter(Boolean), [rows]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUserId(auth.user?.id ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    // Best-effort: try to discover group owners (if schema supports owner_id)
    (async () => {
      if (!ids.length) return;
      try {
        const res = await supabase.from("study_groups").select("id,owner_id").in("id", ids);
        if (res.error) return;
        const map: Record<string, string | null> = {};
        (res.data ?? []).forEach((g: any) => {
          map[g.id] = g.owner_id ?? null;
        });
        setOwnerByGroupId(map);
      } catch {
        // ignore
      }
    })();
  }, [supabase, ids.join("|")]);

  function isOwner(groupId: string) {
    if (!userId) return false;
    const ownerId = ownerByGroupId[groupId];
    return typeof ownerId === "string" && ownerId === userId;
  }

  // We intentionally allow a "delete" attempt when ownership is unknown.
  // RLS will protect on the backend; UX-wise this lets owners still delete
  // even if we can't reliably read owner_id.
  function canAttemptDelete(groupId: string) {
    const ownerId = ownerByGroupId[groupId];
    if (!userId) return true;
    if (typeof ownerId === "string") return ownerId === userId;
    return true; // unknown / null
  }

  async function setActive(groupId: string) {
    setRowBusyId(groupId);
    setMsg(null);
    try {
      const res = await supabase.from("profiles").update({ active_group_id: groupId }).select().single();
      if (res.error) throw res.error;
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setRowBusyId(null);
    }
  }

  async function startRename(groupId: string, currentName: string) {
    setMsg(null);
    setEditingId(groupId);
    setEditName(currentName);
  }

  async function saveRename(groupId: string) {
    const next = editName.trim();
    if (!next) return;

    setRowBusyId(groupId);
    setMsg(null);
    try {
      const res = await supabase.from("study_groups").update({ name: next }).eq("id", groupId);
      if (res.error) throw res.error;
      setEditingId(null);
      setEditName("");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setRowBusyId(null);
    }
  }

  async function leaveGroup(groupId: string) {
    if (!userId) throw new Error("Not logged in");

    // If leaving the active group, clear it first (avoids dangling selection)
    if (activeGroupId && activeGroupId === groupId) {
      const up = await supabase.from("profiles").update({ active_group_id: null }).eq("id", userId);
      if (up.error) throw up.error;
    }

    const del = await supabase.from("group_memberships").delete().eq("group_id", groupId).eq("user_id", userId);
    if (del.error) throw del.error;
  }

  async function deleteGroup(groupId: string) {
    // Best-effort: deleting a group may be restricted by RLS / FK constraints.
    // If it fails, we show a clean error (and do NOT auto-delete other things).
    const del = await supabase.from("study_groups").delete().eq("id", groupId);
    if (del.error) throw del.error;
  }

  async function remove(groupId: string, action: "leave" | "delete") {
    setRowBusyId(groupId);
    setMsg(null);
    try {
      if (action === "delete") {
        const ok = window.confirm(t("settings.confirmDeleteGroup"));
        if (!ok) return;
        await deleteGroup(groupId);
      } else {
        const ok = window.confirm(t("settings.confirmLeaveGroup"));
        if (!ok) return;
        await leaveGroup(groupId);
      }

      window.location.reload();
    } catch (e: any) {
      // If delete fails (non-owner / FK constraints), suggest leaving.
      const base = e?.message ?? t("common.error");
      if (action === "delete") {
        setMsg(`❌ ${base}. ${t("settings.leave")} : ${t("settings.confirmLeaveGroup")}`);
      } else {
        setMsg(`❌ ${base}`);
      }
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold">{t("settings.groupsTitle")}</h2>

      <div className="mt-4 grid gap-2">
        {rows.length === 0 && <div className="text-sm opacity-70">{t("settings.noneGroups")}</div>}

        {rows.map((g) => {
          const id = groupIdOf(g);
          const sgName = groupNameOf(g);
          const inviteCode = groupInviteOf(g);
          const isActive = id === activeGroupId;
          const owner = isOwner(id);
          const showDelete = canAttemptDelete(id);
          const disabled = rowBusyId === id || busy;

          return (
            <div key={id} className="card-soft flex flex-col justify-between gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {editingId === id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t("settings.groupNamePlaceholder")}
                      disabled={disabled}
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => saveRename(id)}
                        disabled={disabled || !editName.trim()}
                        type="button"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                        }}
                        disabled={disabled}
                        type="button"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="truncate text-sm font-medium">{sgName}</div>
                    {inviteCode ? (
                      <div className="text-xs opacity-70">
                        {t("settings.inviteCode")}: <code className="opacity-90">{inviteCode}</code>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {isActive && <span className="badge badge-public">{t("settings.active")}</span>}

                {!isActive && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActive(id)}
                    disabled={disabled}
                    type="button"
                  >
                    {t("settings.setActive")}
                  </button>
                )}

                {editingId !== id && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => startRename(id, sgName)}
                    disabled={disabled}
                    type="button"
                    title={t("settings.rename")}
                  >
                    {t("settings.rename")}
                  </button>
                )}

                <button
                  className="btn btn-ghost"
                  onClick={() => remove(id, "leave")}
                  disabled={disabled}
                  type="button"
                  title={t("settings.leave")}
                >
                  {t("settings.leave")}
                </button>

                {showDelete ? (
                  <button
                    className="btn btn-danger"
                    onClick={() => remove(id, "delete")}
                    disabled={disabled || (!owner && typeof ownerByGroupId[id] === "string")}
                    type="button"
                    title={t("settings.delete")}
                  >
                    {t("settings.delete")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card-soft p-4">
          <h3 className="font-semibold">{t("settings.createGroup")}</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.groupNamePlaceholder")}
              disabled={busy}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  const res = await supabase.rpc("create_group", { group_name: name.trim() });
                  if (res.error) throw res.error;
                  setName("");
                  window.location.reload();
                } catch (e: any) {
                  setMsg(`❌ ${e?.message ?? t("common.error")}`);
                } finally {
                  setBusy(false);
                }
              }}
              type="button"
            >
              {busy ? t("common.saving") : t("settings.create")}
            </button>
          </div>
        </div>

        <div className="card-soft p-4">
          <h3 className="font-semibold">{t("settings.joinGroup")}</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder={t("settings.joinPlaceholder")}
              disabled={busy}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !invite.trim()}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  const res = await supabase.rpc("join_group", { invite: invite.trim() });
                  if (res.error) throw res.error;
                  setInvite("");
                  window.location.reload();
                } catch (e: any) {
                  setMsg(`❌ ${e?.message ?? t("common.error")}`);
                } finally {
                  setBusy(false);
                }
              }}
              type="button"
            >
              {busy ? t("common.saving") : t("settings.join")}
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  );
}
