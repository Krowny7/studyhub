// app/login/LoginForm.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Lock, Mail } from "lucide-react";

type Props = {
  callbackUrl?: string;
  error?: string;
};

export default function LoginForm({ callbackUrl = "/", error }: Props) {
  const [email, setEmail] = useState("demo@studyhub.test");
  const [password, setPassword] = useState("pass1234");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);

    const res = await signIn("credentials", {
      redirect: true,
      email,
      password,
      callbackUrl,
    });

    // Si redirect: true, NextAuth redirige tout seul. En cas d’erreur NextAuth
    // nous renverra vers /login?error=CredentialsSignin, déjà affiché ci-dessous.
    setLoading(false);
  }

  const displayError =
    localError ||
    (error === "CredentialsSignin" ? "Identifiants incorrects." : error ? "Une erreur est survenue." : null);

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/35 backdrop-blur-md p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_40px_rgba(0,0,0,0.45)]">
      <h2 className="text-xl font-semibold mb-6">Connexion</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-200">Email</label>
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 focus-within:ring-2 focus-within:ring-[#F0122D]">
            <Mail className="h-4 w-4 opacity-80" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-sm"
              placeholder="votre@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-200">Mot de passe</label>
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 focus-within:ring-2 focus-within:ring-[#F0122D]">
            <Lock className="h-4 w-4 opacity-80" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-sm"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        {displayError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
            {displayError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#F0122D] px-5 py-2.5 text-sm font-medium shadow hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F0122D] focus:ring-offset-black disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
