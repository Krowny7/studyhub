"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { RichContent } from "@/components/RichContent";

type Card = { id: string; front: string; back: string };

type Rating = "review" | "mastered";

function shuffleArray<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripImageLines(text: string) {
  return (text ?? "")
    .split("\n")
    .filter((l) => !l.trim().match(/^\[\[img:(.+)\]\]$/i))
    .join("\n")
    .trim();
}

function CardPanel({
  title,
  subtitle,
  text,
  onFlip,
  flipped
}: {
  title: string;
  subtitle: string;
  text: string;
  onFlip: () => void;
  flipped: boolean;
}) {
  const plain = stripImageLines(text);
  const shouldCenter = plain.length <= 140 && !plain.includes("\n");

  return (
    <button
      type="button"
      onClick={onFlip}
      aria-pressed={flipped}
      className={[
        "w-full rounded-2xl border border-white/10 bg-neutral-900/40 text-left",
        "p-6",
        "flex h-full flex-col",
        "overflow-auto overflow-x-hidden",
        "transition-colors hover:bg-neutral-900/60",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide opacity-70">{title}</div>
        <div className="text-xs opacity-60 break-words [overflow-wrap:anywhere]">{subtitle}</div>
      </div>

      <div className={["mt-5 flex-1 min-w-0", shouldCenter ? "flex items-center justify-center" : ""].join(" ")}
      >
        <div
          className={[
            "w-full min-w-0",
            "text-lg leading-relaxed",
            shouldCenter ? "text-center max-w-[70ch]" : "text-left"
          ].join(" ")}
        >
          <RichContent text={text} />
        </div>
      </div>

      <div className="mt-5 text-xs opacity-60">{subtitle}</div>
    </button>
  );
}

function RateButton({
  label,
  hint,
  onClick,
  variant,
  disabled
}: {
  label: string;
  hint: string;
  onClick: () => void;
  variant: "warning" | "ok";
  disabled?: boolean;
}) {
  const cls =
    variant === "warning"
      ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
      : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15";

  return (
    <button
      type="button"
      className={[
        "w-full rounded-lg border px-3 py-2 text-sm",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        cls,
        disabled ? "opacity-50 cursor-not-allowed" : ""
      ].join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-60">{hint}</span>
      </div>
    </button>
  );
}

export function FlashcardReview({ cards }: { cards: Card[] }) {
  const { t } = useI18n();

  const [deck, setDeck] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [reverse, setReverse] = useState(false);

  // Session-only evaluation
  const [toReviewIds, setToReviewIds] = useState<Set<string>>(new Set());
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  const total = deck.length;
  const done = total === 0 || i >= total;
  const current = !done ? deck[i] : null;

  const progressText = useMemo(() => (total ? `${Math.min(i + 1, total)}/${total}` : "0/0"), [i, total]);
  const progressPct = useMemo(() => {
    if (!total) return 0;
    const num = Math.min(i + 1, total);
    return Math.round((num / total) * 100);
  }, [i, total]);

  const restartAll = (opts?: { shuffle?: boolean; reverse?: boolean }) => {
    const nextShuffle = opts?.shuffle ?? shuffle;
    const nextReverse = opts?.reverse ?? reverse;
    setShuffle(nextShuffle);
    setReverse(nextReverse);

    const base = [...(cards ?? [])];
    const nextDeck = nextShuffle ? shuffleArray(base) : base;
    setDeck(nextDeck);
    setI(0);
    setFlipped(false);
    setToReviewIds(new Set());
    setMasteredIds(new Set());
  };

  const restartReviewOnly = () => {
    const ids = Array.from(toReviewIds);
    const next = (cards ?? []).filter((c) => ids.includes(c.id));
    const nextDeck = shuffle ? shuffleArray(next) : next;
    setDeck(nextDeck);
    setI(0);
    setFlipped(false);
    setToReviewIds(new Set());
    setMasteredIds(new Set());
  };

  useEffect(() => {
    const base = [...(cards ?? [])];
    setDeck(shuffle ? shuffleArray(base) : base);
    setI(0);
    setFlipped(false);
    setToReviewIds(new Set());
    setMasteredIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const goPrev = () => {
    setI((v) => Math.max(0, v - 1));
    setFlipped(false);
  };

  const goNext = () => {
    setI((v) => Math.min(total, v + 1));
    setFlipped(false);
  };

  const rate = (r: Rating) => {
    if (!current) return;

    const id = current.id;
    setToReviewIds((prev) => {
      const next = new Set(prev);
      if (r === "review") next.add(id);
      else next.delete(id);
      return next;
    });
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (r === "mastered") next.add(id);
      else next.delete(id);
      return next;
    });

    setI((v) => Math.min(total, v + 1));
    setFlipped(false);
  };

  // Keyboard shortcuts (works in normal + fullscreen, but ignores inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (el as any)?.isContentEditable) return;

      if (fullscreen && e.key === "Escape") {
        setFullscreen(false);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((v) => !v);
        return;
      }

      if (e.key.toLowerCase() === "f") {
        setFullscreen(true);
        return;
      }
      if (e.key.toLowerCase() === "r") {
        setReverse((v) => !v);
        setFlipped(false);
        return;
      }
      if (e.key.toLowerCase() === "s") {
        restartAll({ shuffle: !shuffle });
        return;
      }

      if (!flipped) return;
      if (e.key === "1") rate("review");
      if (e.key === "2") rate("mastered");
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, flipped, i, total, shuffle, reverse]);

  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-neutral-950/30 p-4">
        <h3 className="font-semibold">{t("flashcards.review")}</h3>
        <div className="mt-2 text-sm opacity-70">{t("flashcards.none")}</div>
      </div>
    );
  }

  const header = (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">{t("flashcards.review")}</h3>
        <div className="mt-1 text-xs opacity-70 break-words [overflow-wrap:anywhere]">{t("flashcards.reviewHint")}</div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm opacity-70">{progressText}</span>

        <button
          type="button"
          className={[
            "rounded-lg border px-3 py-2 text-sm",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            shuffle ? "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15" : "border-white/10 bg-neutral-900/60 hover:bg-white/5"
          ].join(" ")}
          onClick={() => restartAll({ shuffle: !shuffle })}
        >
          {shuffle ? t("flashcards.shuffleOn") : t("flashcards.shuffleOff")}
        </button>

        <button
          type="button"
          className={[
            "rounded-lg border px-3 py-2 text-sm",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            reverse ? "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15" : "border-white/10 bg-neutral-900/60 hover:bg-white/5"
          ].join(" ")}
          onClick={() => setReverse((v) => !v)}
        >
          {t("flashcards.reverse")}
        </button>

        <button
          type="button"
          className="rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          onClick={() => restartAll()}
        >
          {t("flashcards.restart")}
        </button>

        <button
          type="button"
          className="rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          onClick={() => setFullscreen(true)}
        >
          {t("flashcards.fullscreen")}
        </button>
      </div>
    </div>
  );

  const progressBar = (
    <div className="mt-3">
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div className="h-1.5 rounded-full bg-white/40" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );

  const reviewCount = toReviewIds.size;
  const masteredCount = masteredIds.size;

  const content = done ? (
    <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900/40 p-6">
      <div className="text-lg font-semibold">{t("flashcards.sessionComplete")}</div>
      <div className="mt-2 text-sm opacity-80">{t("flashcards.sessionCompleteHint")}</div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2">
          <span>{t("flashcards.toReview")}</span>
          <span className="opacity-80">{reviewCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2">
          <span>{t("flashcards.mastered")}</span>
          <span className="opacity-80">{masteredCount}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {reviewCount > 0 ? (
          <button
            type="button"
            className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm hover:bg-amber-500/15 sm:w-auto"
            onClick={() => restartReviewOnly()}
          >
            {t("flashcards.reviewOnly")} ({reviewCount})
          </button>
        ) : (
          <div className="text-sm text-emerald-300">{t("flashcards.allMastered")}</div>
        )}

        <button
          type="button"
          className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 sm:w-auto"
          onClick={() => restartAll()}
        >
          {t("flashcards.restartAll")}
        </button>
      </div>
    </div>
  ) : (
    <>
      <div className="mt-4">
        <CardPanel
          title={flipped ? t("flashcards.back") : t("flashcards.front")}
          subtitle={t("flashcards.tapToFlip")}
          text={
            flipped
              ? reverse
                ? current!.front
                : current!.back
              : reverse
                ? current!.back
                : current!.front
          }
          flipped={flipped}
          onFlip={() => setFlipped((v) => !v)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50 sm:w-auto transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          disabled={i === 0}
          onClick={goPrev}
          type="button"
        >
          {t("flashcards.prev")}
        </button>

        <button
          className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50 sm:w-auto transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          disabled={i >= total - 1}
          onClick={goNext}
          type="button"
        >
          {t("flashcards.next")}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/30 p-4">
        <div className="text-sm font-semibold">{t("flashcards.rateTitle")}</div>
        <div className="mt-1 text-xs opacity-70">{t("flashcards.rateHint2")}</div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <RateButton
            label={t("flashcards.again")}
            hint="1"
            variant="warning"
            disabled={!flipped}
            onClick={() => rate("review")}
          />
          <RateButton
            label={t("flashcards.mastered")}
            hint="2"
            variant="ok"
            disabled={!flipped}
            onClick={() => rate("mastered")}
          />
        </div>

        <div className="mt-3 text-xs opacity-60">{t("flashcards.shortcuts2")}</div>
      </div>
    </>
  );

  const shell = (
    <>
      {header}
      {progressBar}
      {content}
    </>
  );

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-neutral-950/30 p-4">{shell}</div>

      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-4 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t("flashcards.review")}</div>
                <div className="text-xs opacity-70 break-words [overflow-wrap:anywhere]">
                  {progressText} • {t("flashcards.reviewHint")}
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 sm:w-auto transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                onClick={() => setFullscreen(false)}
              >
                {t("common.close")}
              </button>
            </div>

            <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
              {done ? (
                <div className="mx-auto w-full max-w-3xl">{content}</div>
              ) : (
                <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
                  <div className="flex-1">
                    <CardPanel
                      title={flipped ? t("flashcards.back") : t("flashcards.front")}
                      subtitle={t("flashcards.tapToFlip")}
                      text={
                        flipped
                          ? reverse
                            ? current!.front
                            : current!.back
                          : reverse
                            ? current!.back
                            : current!.front
                      }
                      flipped={flipped}
                      onFlip={() => setFlipped((v) => !v)}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <RateButton
                      label={t("flashcards.again")}
                      hint="1"
                      variant="warning"
                      disabled={!flipped}
                      onClick={() => rate("review")}
                    />
                    <RateButton
                      label={t("flashcards.mastered")}
                      hint="2"
                      variant="ok"
                      disabled={!flipped}
                      onClick={() => rate("mastered")}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50 sm:w-auto transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      disabled={i === 0}
                      onClick={goPrev}
                      type="button"
                    >
                      {t("flashcards.prev")}
                    </button>

                    <button
                      className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50 sm:w-auto transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      disabled={i >= total - 1}
                      onClick={goNext}
                      type="button"
                    >
                      {t("flashcards.next")}
                    </button>
                  </div>

                  <div className="mt-3 text-xs opacity-60">{t("flashcards.shortcuts2")}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
