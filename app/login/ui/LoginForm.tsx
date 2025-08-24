// app/login/ui/LoginForm.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error"); // ex: "CredentialsSignin" si mauvais identifiants

  const [email, setEmail] = useState("demo@studyhub.test");
  const [password, setPassword] = useState("demo");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
  }

  return (
    <main className="relative min-h-screen grid place-items-center px-6">
      {/* Fond discret (retire si tu ne veux pas) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black/80" />

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md p-6 shadow-xl text-white"
      >
        <h1 className="text-xl font-semibold mb-6">Connexion</h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm">
            Échec de connexion — vérifie tes identifiants.
          </div>
        )}

        <label className="block text-sm text-gray-200 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="mb-4 w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="vous@exemple.com"
          required
        />

        <label className="block text-sm text-gray-200 mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          className="mb-6 w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="••••••••"
          required
        />

        <button
          type="submit"
          className="w-full rounded-md bg-rose-600 px-4 py-2 font-medium hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-black"
        >
          Se connecter
        </button>
      </form>
    </main>
  );
}
