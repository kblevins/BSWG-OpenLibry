import { getLoginUserByEmail } from "@/entities/loginuser";
import { prisma } from "@/entities/db";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
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
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});
