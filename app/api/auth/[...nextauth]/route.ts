import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder-secret",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please provide both email and password.");
        }

        const cleanEmail = credentials.email.toLowerCase().trim();
        const cleanPassword = credentials.password.trim();

        try {
          // Check in users table
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, cleanEmail));

          if (existingUser) {
            if (existingUser.password && existingUser.password !== cleanPassword) {
              throw new Error("Invalid password for this account.");
            }
            return {
              id: String(existingUser.id),
              name: existingUser.name || cleanEmail.split("@")[0],
              email: existingUser.email,
              role: existingUser.role || "employee",
            };
          }

          // 2. Automatically register user on first manual email/password entry
          const [newUser] = await db
            .insert(users)
            .values({
              name: cleanEmail.split("@")[0],
              email: cleanEmail,
              password: cleanPassword,
              role: "employee",
            })
            .returning();

          if (newUser) {
            return {
              id: String(newUser.id),
              name: newUser.name || cleanEmail.split("@")[0],
              email: newUser.email,
              role: newUser.role || "employee",
            };
          }
        } catch (err: any) {
          console.error("Credentials authorize error:", err);
          if (err.message && !err.message.includes("database") && !err.message.includes("relation") && !err.message.includes("column")) {
            throw err;
          }
          // Fallback in case of DB offline in dev
          return {
            id: "user-" + Date.now(),
            name: cleanEmail.split("@")[0],
            email: cleanEmail,
            role: "employee",
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    newUser: "/workspace",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || "employee";
      }
      if (token.email) {
        try {
          const [dbUser] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.email, token.email.toLowerCase().trim()));
          if (dbUser?.role) {
            token.role = dbUser.role;
          }
        } catch {
          // ignore db error
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role || "employee";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "default-development-secret-change-in-env",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
