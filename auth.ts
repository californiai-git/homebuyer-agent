import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

/**
 * Google Drive scope used to store the user's sensitive homebuying documents.
 *
 * `drive.file` is intentionally used instead of the broader `drive` scope:
 * it only ever grants access to files and folders that this app itself
 * creates in the signed-in user's Drive, which is exactly the access this
 * app needs. It also avoids Google's costly "restricted scope" security
 * assessment that the broader `drive` scope requires for OAuth verification.
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "MissingRefreshToken" };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken
      })
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
    };

    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error ?? `Refresh failed with status ${response.status}`);
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined
    };
  } catch (error) {
    console.error("Failed to refresh Google access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for self-hosted / Docker deployments that sit behind a reverse
  // proxy, per this project's "deployable on infra controlled by the
  // operator" goal. Vercel is trusted automatically.
  trustHost: true,
  // Google is the only sign-in method: this app intentionally supports
  // "Sign in with Google" only, so every account is a real Google identity
  // and the same OAuth token can be used to access the user's own Drive.
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_SCOPE}`,
          // Ask for a refresh token every time so Drive access keeps working
          // across sessions without silently losing offline access.
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account }) {
      return account?.provider === "google";
    },
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0
        };
      }

      const expiresAt = typeof token.accessTokenExpires === "number" ? token.accessTokenExpires : 0;
      // Refresh a minute early to avoid races with in-flight Drive requests.
      if (Date.now() < expiresAt - 60_000) {
        return token;
      }

      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: typeof token.sub === "string" ? token.sub : ""
        },
        accessToken: typeof token.accessToken === "string" ? token.accessToken : undefined,
        error: typeof token.error === "string" ? token.error : undefined
      };
    }
  }
});
