import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardImporterExporter } from "@/components/FlashcardImporterExporter";
import { FlashcardReview } from "@/components/FlashcardReview";
import { FlashcardQuickAdd } from "@/components/FlashcardQuickAdd";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FlashcardSetPage({ params }: PageProps) {
  const { id } = await params;

  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const [{ data: set, error: setErr }, { data: cardsRaw }] = await Promise.all([
    supabase.from("flashcard_sets").select("id,title,visibility").eq("id", id).maybeSingle(),
    supabase
      .from("flashcards")
      .select("id,front,back,position")
      .eq("set_id", id)
      .order("position", { ascending: true }),
  ]);

  if (setErr || !set) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-semibold break-words">{t(locale, "flashcards.notFound")}</h1>
        <p className="mt-2 text-sm opacity-80 break-words">{t(locale, "flashcards.notFoundDesc")}</p>
      </div>
    );
  }

  let cards = (cardsRaw ?? []) as any[];

  // Best-effort localization (EN) for set title and cards.
  let displayTitle = String((set as any).title ?? "(set)");
  if (locale === "en") {
    const { data: setTr } = await supabase
      .from("content_translations")
      .select("payload")
      .eq("content_type", "flashcard_set")
      .eq("content_id", (set as any).id)
      .eq("lang", "en")
      .maybeSingle();

    const ids = cards.map((c) => String(c.id));
    const chunkSize = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

    const cardTr: any[] = [];
    for (const chunk of chunks) {
      const { data } = await supabase
        .from("content_translations")
        .select("content_id,payload")
        .eq("content_type", "flashcard")
        .eq("lang", "en")
        .in("content_id", chunk);
      if (data?.length) cardTr.push(...(data as any[]));
    }

    const p = (setTr as any)?.payload as any;
    if (p?.title) displayTitle = String(p.title);

    const byId = new Map<string, any>();
    (cardTr ?? []).forEach((r: any) => byId.set(String(r.content_id), (r as any).payload));

    cards = cards.map((c: any) => {
      const tr = byId.get(String(c.id));
      if (!tr) return c;
      return {
        ...c,
        front: tr?.front ? String(tr.front) : c.front,
        back: tr?.back ? String(tr.back) : c.back
      };
    });
  }

  const count = cards.length;

  return (
    <div className="mx-auto w-full max-w-5xl grid gap-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/flashcards" className="btn btn-secondary">
          ← {t(locale, "nav.flashcards")}
        </Link>
      </div>

      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{displayTitle}</h1>
        <p className="mt-2 text-sm opacity-80 break-words">
          {String((set as any).visibility).toUpperCase()} • {count} {t(locale, "flashcards.cards")}
        </p>
      </div>

      <FlashcardReview cards={(cards ?? []) as any} />

      {/* Editing tools are useful but should not block the main "review" flow. */}
      <details className="card p-5 min-w-0 max-w-full">
        <summary className="cursor-pointer select-none text-base font-semibold">
          {t(locale, "common.settings")}
          <span className="ml-2 text-xs opacity-70">(ajout, import/export, liste)</span>
        </summary>

        <div className="mt-4 grid gap-4">
          <FlashcardQuickAdd setId={id} nextPosition={count + 1} />
          <FlashcardImporterExporter setId={id} />

          <div className="card-soft p-4 min-w-0 max-w-full">
            <h3 className="text-base font-semibold">{t(locale, "flashcards.cards")}</h3>
            <div className="mt-3 grid gap-2">
              {(cards ?? []).map((c: any) => (
                <div key={c.id} className="card-soft p-3">
                  <div className="text-xs opacity-70">#{c.position}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm font-medium break-words [overflow-wrap:anywhere]">
                    {c.front}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm opacity-80 break-words [overflow-wrap:anywhere]">
                    {c.back}
                  </div>
                </div>
              ))}
              {(cards ?? []).length === 0 && <div className="text-sm opacity-70">{t(locale, "flashcards.none")}</div>}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}