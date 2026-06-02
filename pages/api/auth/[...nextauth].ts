import { getLoginUserByEmail } from "@/entities/loginuser";
import { prisma } from "@/entities/db";
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: process.env.LOGIN_SESSION_TIMEOUT
      ? parseInt(process.env.LOGIN_SESSION_TIMEOUT)
      : 3600,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await getLoginUserByEmail(prisma, user.email);
      return allowed !== null;
    },
    async jwt({ token, user: googleUser }) {
      if (googleUser?.email) {
        const dbUser = await getLoginUserByEmail(prisma, googleUser.email);
        token.role = dbUser?.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
};

export default NextAuth(authOptions);
