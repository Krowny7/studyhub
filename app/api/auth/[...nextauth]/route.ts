// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

type EnvUser = { id: string; email: string; password: string; name: string };

function loadUsers(): EnvUser[] {
  const raw = process.env.NEXTAUTH_USERS ?? "";
  return raw
    .split("|")
    .map((pair) => {
      const [email, password] = pair.split(":");
      const e = email?.trim();
      const p = password?.trim();
      if (!e || !p) return null;
      const name = e.split("@")[0];
      return { id: e, email: e, password: p, name };
    })
    .filter((u): u is EnvUser => !!u);
}

const USERS = loadUsers();

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const user = USERS.find(
          (u) => u.email.toLowerCase() === email && u.password === password
        );

        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
