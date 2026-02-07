import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupSettings } from "@/components/GroupSettings";
import { ProfileSettings } from "@/components/ProfileSettings";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import Link from "next/link";

export default async function SettingsPage() {
  const locale = await getLocale();
  const isFr = String(locale || "fr").toLowerCase().startsWith("fr");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: groups }, { data: isAdminData }] = await Promise.all([
    supabase.from("profiles").select("active_group_id").eq("id", user.id).maybeSingle(),
    supabase.from("group_memberships").select("group_id, study_groups(id,name,invite_code)").eq("user_id", user.id),
    supabase.rpc("is_app_admin")
  ]);

  const isAdmin = Boolean(isAdminData);

  return (
    <div className="grid gap-4">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "settings.title")}</h1>
        <p className="mt-2 text-sm text-white/80">{t(locale, "settings.subtitle")}</p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
          {isFr
            ? "Astuce : choisis un groupe actif — il sera pré-sélectionné quand tu partages un contenu."
            : "Tip: pick an active group — it will be preselected when you share content."}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ProfileSettings />

          {isAdmin ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">{isFr ? "Admin" : "Admin"}</div>
              <div className="mt-1 text-sm text-white/80">
                {isFr
                  ? "Accède au studio pour gérer les contenus référencés (QCM & Exercices)."
                  : "Access the studio to manage official reference content (Quizzes & Exercises)."}
              </div>
              <div className="mt-3">
                <Link href="/admin/content" className="btn btn-secondary">
                  {isFr ? "Ouvrir l’Admin Studio" : "Open Admin Studio"}
                </Link>
              </div>
            </div>
          ) : null}
        </div>
        <div className="lg:col-span-7">
          <GroupSettings
            activeGroupId={((profile as any)?.active_group_id ?? null) as any}
            groups={(groups ?? []) as any}
          />
        </div>
      </div>
    </div>
  );
}
