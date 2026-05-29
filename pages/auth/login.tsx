import { signIn } from "next-auth/react";
import Head from "next/head";

import { t } from "@/lib/i18n";
import loginsplash from "./loginsplashscreen.jpg";

export default function Login() {
  return (
    <>
      <Head>
        <title>{t("login.pageTitle")}</title>
      </Head>

      <div className="min-h-screen flex">
        {/* Left: Background image — hidden on mobile */}
        <div
          className="hidden sm:block sm:w-5/12 md:w-7/12 relative"
          style={{
            backgroundImage: `url(${loginsplash.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        </div>

        {/* Right: Sign-in panel */}
        <div className="flex-1 flex items-center justify-center bg-white px-6 py-12 shadow-xl">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold text-gray-900">
                {t("login.heading")}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {t("login.subtitle")}
              </p>
            </div>

            {/* Google sign-in button */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              {/* Google "G" logo */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              {t("login.signInWithGoogle")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
