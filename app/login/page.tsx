"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const params = useSearchParams();
  const error = params.get("error"); // p.ex. CredentialsSignin

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
    setLoading(false);
  }

  return (
    <main className="relative min-h-screen text-white overflow-hidden">
      {/* fond vidéo (mêmes fichiers que l’accueil) */}
      <div className="absolute inset-0 -z-10">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          poster="/bg/console.jpg"
        >
          <source src="/bg/background.webm" type="video/webm" />
          <source src="/bg/background.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-[#0e1116]/75 to-[#111418]/88" />

      {/* brand */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <BrandTitle />
      </div>

      {/* carte */}
      <section className="grid place-items-center px-4 py-16">
        <Glass className="w-full max-w-md">
          <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[#F0122D]/25 blur-3xl" />
          <h1 className="text-2xl font-semibold mb-6">Connexion</h1>

          {error && (
            <div className="mb-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Identifiants invalides. Réessaie.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">Email</span>
              <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 focus-within:ring-2 focus-within:ring-[#F0122D]">
                <Mail className="h-4 w-4 opacity-80" />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className="w-full bg-transparent outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@domaine.com"
                  required
                />
              </div>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-200">Mot de passe</span>
              <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 focus-within:ring-2 focus-within:ring-[#F0122D]">
                <Lock className="h-4 w-4 opacity-80" />
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  className="w-full bg-transparent outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="rounded-md p-1 hover:bg-white/10"
                  aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#F0122D] py-2 font-medium shadow hover:opacity-95 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </Glass>
      </section>
    </main>
  );
}

/* ---------- helpers visuels ---------- */
function BrandTitle() {
  return (
    <div className="relative group flex items-center gap-3">
      <span className="h-3 w-3 rounded-full bg-[#F0122D] shadow-[0_0_20px_#F0122D] animate-pulse" aria-hidden />
      <span className="text-[22px] md:text-[28px] font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-rose-200 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">
        StudyHub
      </span>
      <span
        aria-hidden
        className="absolute -bottom-1 left-6 h-[3px] w-24 rounded-full bg-gradient-to-r from-[#F0122D] to-transparent opacity-70 transition-all duration-300 group-hover:w-32"
      />
    </div>
  );
}

function Glass({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.002 }}
      className={`relative rounded-2xl border border-white/10 bg-black/35 p-6 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_40px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-3 rounded-xl bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:22px_22px]" />
      <div className="pointer-events-none absolute inset-3 rounded-xl opacity-5 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.4)_0,rgba(255,255,255,0.4)_1px,transparent_1px,transparent_3px)]" />
      <div className="relative z-10">{children}</div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </motion.div>
  );
}
