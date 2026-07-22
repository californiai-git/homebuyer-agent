import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"];
    /** Short-lived Google OAuth access token, used server-side to call the Drive API. */
    accessToken?: string;
    /** Set when the access token could not be refreshed; the client should prompt re-sign-in. */
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
