"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="avatar" aria-hidden="true" />;
  }

  if (!session?.user) {
    return (
      <button className="auth-button" onClick={() => signIn("google")}>
        Sign in with Google
      </button>
    );
  }

  const label = session.user.name ?? session.user.email ?? "Account";
  const initials = label
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <button
      className="avatar"
      title={`Signed in as ${label} \u2014 sign out`}
      aria-label={`Signed in as ${label}. Sign out`}
      onClick={() => signOut()}
    >
      {initials}
    </button>
  );
}
