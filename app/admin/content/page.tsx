import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { AdminContentStudio, type AdminContentRow } from "@/components/AdminContentStudio";

type QuizRow = {
  id: string;
  title: string;
  visibility: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_official?: boolean | null;
  official_published?: boolean | null;
  difficulty?: number | string | null;
  published_at?: string | null;
  owner_id?: string | null;
};

type ExerciseRow = {
  id: string;
  title: string;
  visibility: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_official?: boolean | null;
  official_published?: boolean | null;
  difficulty?: number | string | null;
  published_at?: string | null;
  owner_id?: string | null;
};

export default async function AdminContentPage() {
  const locale = await getLocale();
  const isFR = locale === "fr";
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [{ data: isAdminData }, quizRes, exRes] = await Promise.all([
    supabase.rpc("is_app_admin"),
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

  const isAdmin = Boolean(isAdminData);
  if (!isAdmin) redirect("/dashboard");

  const quizRows = ((quizRes.data ?? []) as unknown as QuizRow[]).map(
    (r): AdminContentRow => ({
      kind: "quiz",
      id: r.id,
      title: r.title,
      visibility: r.visibility,
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_official: Boolean(r.is_official),
      official_published: Boolean(r.official_published),
      difficulty: Number(r.difficulty ?? 1) || 1,
      published_at: (r as any).published_at ?? null,
      owner_id: r.owner_id ?? null
    })
  );

  const exRows = ((exRes.data ?? []) as unknown as ExerciseRow[]).map(
    (r): AdminContentRow => ({
      kind: "exercise",
      id: r.id,
      title: r.title,
      visibility: r.visibility,
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_official: Boolean(r.is_official),
      official_published: Boolean(r.official_published),
      difficulty: Number(r.difficulty ?? 1) || 1,
      published_at: (r as any).published_at ?? null,
      owner_id: r.owner_id ?? null
    })
  );

  const rows = [...quizRows, ...exRows].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  return (
    <div className="grid gap-4">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold opacity-80">{isFR ? "Admin Studio" : "Admin Studio"}</div>
            <div className="mt-3 max-w-[72ch] text-base text-white/80">
              {isFR
                ? "Gère les QCM & Exercices référencés : promotion, publication, difficulté, et création rapide."
                : "Manage reference Quizzes & Exercises: promote/demote, publish, difficulty, and quick creation."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/qcm" className="btn btn-secondary">
              {t(locale, "nav.qcm")}
            </Link>
            <Link href="/exercises" className="btn btn-secondary">
              {t(locale, "nav.exercises")}
            </Link>
          </div>
        </div>
      </div>

      <AdminContentStudio initialRows={rows} />
    </div>
  );
}
