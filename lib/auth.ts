// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // TODO: remplace par ta logique (Supabase, DB, etc.)
        if (!credentials?.email || !credentials?.password) return null;

        // Exemple minimal: accepte n'importe quoi (à remplacer)
        return { id: "1", name: "User", email: credentials.email };
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" }
};
