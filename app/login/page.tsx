"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="currentColor"
        opacity="0.2"
        d="M24 44c11.05 0 20-8.95 20-20S35.05 4 24 4 4 12.95 4 24s8.95 20 20 20Z"
      />
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.2 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.06 0 5.842 1.154 7.962 3.038l5.657-5.657C34.915 6.053 29.69 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691 12.88 19.51C14.567 15.33 18.656 12 24 12c3.06 0 5.842 1.154 7.962 3.038l5.657-5.657C34.915 6.053 29.69 4 24 4c-7.682 0-14.39 4.33-17.694 10.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.58 0 10.692-2.144 14.543-5.643l-6.713-5.68C29.86 34.246 27.04 35.2 24 35.2c-5.17 0-9.602-3.317-11.273-7.92l-6.53 5.03C9.46 39.556 16.19 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.8 2.537-2.42 4.69-4.673 6.12l.003-.002 6.713 5.68C36.87 40.23 44 35 44 24c0-1.341-.138-2.651-.389-3.917Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const { locale } = useI18n();

  const isFr = locale === "fr";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });

      if (error) throw error;
      // Redirection handled by Supabase OAuth.
    } catch (e: any) {
      setError(e?.message ?? (isFr ? "Erreur de connexion." : "Login error."));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT: Value prop */}
      <section className="card order-2 p-8 lg:order-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-blue-400/80" />
          {isFr ? "Espace d’étude centralisé" : "Centralized study hub"}
        </div>

        <h1 className="mt-5 text-3xl font-semibold leading-tight">
          {isFr ? (
            <>
              CFA Hub — <span className="opacity-80">PDF, flashcards et QCM au même endroit.</span>
            </>
          ) : (
            <>
              CFA Hub — <span className="opacity-80">PDFs, flashcards & quizzes in one place.</span>
            </>
          )}
        </h1>

        <p className="mt-3 text-sm text-white/80">
          {isFr
            ? "Organise tes ressources, révise vite, et partage avec tes groupes (classement ELO inclus)."
            : "Organize resources, revise fast, and share with your groups (ELO ranking included)."}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="card-soft p-4">
            <div className="text-sm font-semibold">{isFr ? "Bibliothèque" : "Library"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFr ? "Ajoute des liens PDF, classe par dossiers." : "Add PDF links, organize with folders."}
            </div>
          </div>

          <div className="card-soft p-4">
            <div className="text-sm font-semibold">{isFr ? "Flashcards" : "Flashcards"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFr
                ? "Import/export Quizlet et mode révision plein écran."
                : "Quizlet import/export and fullscreen review."}
            </div>
          </div>

          <div className="card-soft p-4">
            <div className="text-sm font-semibold">{isFr ? "QCM" : "Quizzes"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFr ? "Mode examen + correction et explications." : "Exam mode + feedback and explanations."}
            </div>
          </div>

          <div className="card-soft p-4">
            <div className="text-sm font-semibold">{isFr ? "Groupes" : "Groups"}</div>
            <div className="mt-1 text-xs opacity-70">
              {isFr
                ? "Partage multi-groupes (privé / groupes / public)."
                : "Multi-group sharing (private / groups / public)."}
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-white/60">
          {isFr
            ? "Astuce : commence par ajouter tes PDFs, puis crée un set de flashcards ou un QCM."
            : "Tip: start by adding your PDFs, then create a flashcard set or a quiz."}
        </div>
      </section>

      {/* RIGHT: Sign in */}
      <section className="card order-1 p-8 lg:order-2">
        <h2 className="text-lg font-semibold">{isFr ? "Connexion" : "Sign in"}</h2>
        <p className="mt-2 text-sm text-white/80">
          {isFr ? "Connecte-toi pour accéder à ton espace." : "Sign in to access your workspace."}
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="btn mt-5 w-full bg-white text-black hover:bg-white/90"
        >
          <GoogleIcon />
          {busy ? (isFr ? "Redirection…" : "Redirecting…") : isFr ? "Continuer avec Google" : "Continue with Google"}
        </button>

        {error ? <div className="mt-3 text-sm text-red-100">❌ {error}</div> : null}

        <div className="mt-6 card-soft p-4">
          <div className="text-sm font-semibold">{isFr ? "Ce que tu verras en premier" : "What you’ll see first"}</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-white/80">
            <li>{isFr ? "Dashboard avec tes stats" : "Dashboard with your stats"}</li>
            <li>{isFr ? "Accès rapide à PDF / Flashcards / QCM" : "Quick access to PDFs / Flashcards / Quizzes"}</li>
            <li>{isFr ? "Partage via groupes (Réglages)" : "Group sharing (Settings)"}</li>
          </ol>
        </div>

        <div className="mt-4 text-xs text-white/60">
          {isFr
            ? "En continuant, tu autorises l’authentification via Google. Aucune donnée n’est partagée publiquement par défaut."
            : "By continuing, you authorize Google authentication. Nothing is public by default."}
        </div>
      </section>
    </div>
  );
}
