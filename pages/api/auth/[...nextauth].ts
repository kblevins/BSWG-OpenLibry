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
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});
