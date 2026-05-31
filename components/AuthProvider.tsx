"use client";

import { ReactNode } from "react";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";

const noop = () => {};

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    // Prevent AuthKit's default window.location.reload() on session expiration.
    // We handle auth state gracefully via Supabase and middleware checks.
    <AuthKitProvider onSessionExpired={noop}>
      {children}
    </AuthKitProvider>
  );
}
