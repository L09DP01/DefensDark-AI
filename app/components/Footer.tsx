"use client";

import React from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

const Footer: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading || user) {
    return null;
  }

  return (
    <div className="relative flex min-h-8 w-full items-center justify-center p-4 text-center text-xs md:px-[60px] flex-shrink-0">
      {/* Gradient separator line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-[rgba(0,140,255,0.2)] to-transparent" />
      <span className="text-sm leading-none text-muted-foreground/70">
        By messaging DefensDark AI, you agree to our{" "}
        <a
          href="/terms-of-service"
          target="_blank"
          className="text-[rgba(0,180,255,0.8)] hover:text-[rgba(0,200,255,1)] underline decoration-[rgba(0,140,255,0.3)] underline-offset-2 transition-colors"
          rel="noreferrer"
        >
          Terms
        </a>{" "}
        and have read our{" "}
        <a
          href="/privacy-policy"
          target="_blank"
          className="text-[rgba(0,180,255,0.8)] hover:text-[rgba(0,200,255,1)] underline decoration-[rgba(0,140,255,0.3)] underline-offset-2 transition-colors"
          rel="noreferrer"
        >
          Privacy Policy
        </a>
        .
      </span>
    </div>
  );
};

export default Footer;
