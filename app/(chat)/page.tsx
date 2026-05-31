"use client";

import React from "react";
import Image from "next/image";
import { Authenticated, Unauthenticated } from "@/lib/supabase/hooks";
import { ChatInput } from "../components/ChatInput";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Chat } from "../components/chat";
import PricingDialog from "../components/PricingDialog";
import TeamPricingDialog from "../components/TeamPricingDialog";
import { TeamWelcomeDialog } from "../components/TeamDialogs";
import MigratePentestgptDialog from "../components/MigratePentestgptDialog";
import { ExtraUsagePurchaseToast } from "../components/extra-usage";
import { usePricingDialog } from "../hooks/usePricingDialog";
import { useGlobalState } from "../contexts/GlobalState";
import { usePentestgptMigration } from "../hooks/usePentestgptMigration";
import { navigateToAuth } from "../hooks/useTauri";
import { useTypingAnimation } from "../hooks/useTypingAnimation";
import { upsertDraft } from "@/lib/utils/client-storage";
import { Shield, Search, FileText, Bug, Code, Lock } from "lucide-react";

const LOGIN_TYPING_PREFIX = "Ask DefensDark AI to ";
const LOGIN_TYPING_TAILS = [
  "find vulnerabilities in...",
  "audit the security of...",
  "test the defenses of...",
  "review the code of...",
  "write a pentest report for...",
  "hunt for bugs in...",
];

const FEATURE_BADGES = [
  { icon: FileText, label: "Pentest Reports" },
  { icon: Search, label: "Vulnerability Scanning" },
  { icon: Code, label: "Code Audit" },
  { icon: Bug, label: "Bug Hunting" },
  { icon: Lock, label: "Security Analysis" },
  { icon: Shield, label: "Threat Detection" },
];

// Simple unauthenticated content that redirects to signup on message send
const UnauthenticatedContent = () => {
  const { input } = useGlobalState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      upsertDraft("new", input);
    }
    navigateToAuth("/signup", { preferSignInForReturningUser: true });
  };

  const animatedTail = useTypingAnimation({
    phrases: LOGIN_TYPING_TAILS,
    enabled: true,
  });
  const animatedPlaceholder = `${LOGIN_TYPING_PREFIX}${animatedTail}`;

  const handleStop = () => {
    // No-op for unauthenticated users
  };

  React.useEffect(() => {
    const checkHash = () => {
      if (
        window.location.hash === "#pricing" ||
        window.location.hash === "#team-pricing-seat-selection"
      ) {
        navigateToAuth("/signup?intent=pricing", {
          preferSignInForReturningUser: true,
        });
      }
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden relative">
      {/* Background radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0, 100, 255, 0.08) 0%, rgba(0, 60, 180, 0.03) 40%, transparent 70%)",
        }}
      />

      <div className="flex-shrink-0 relative z-10">
        <Header />
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        {/* Centered content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-[10vh] pb-[14vh] min-h-0">
          {/* Title */}
          <div className="mb-3 flex flex-col items-center px-4 text-center animate-fade-in-up delay-200">
            <h1 className="text-4xl font-bold text-foreground mb-2.5 md:text-5xl lg:text-6xl tracking-tight">
              What will you{" "}
              <span
                className="bg-gradient-to-r from-[#0088ff] via-[#00c8ff] to-[#0088ff] bg-clip-text text-transparent bg-[length:200%_auto] animate-text-shimmer"
                style={{ animationDuration: "3s" }}
              >
                hack
              </span>{" "}
              today?
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed md:text-lg max-w-xl">
              AI-powered vulnerability detection, penetration testing, and
              security analysis.
            </p>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-2xl animate-fade-in-up delay-400">
            {FEATURE_BADGES.map((badge, i) => (
              <span
                key={badge.label}
                className="feature-badge animate-badge-slide inline-flex items-center gap-1.5"
                style={{ animationDelay: `${400 + i * 80}ms` }}
              >
                <badge.icon className="w-3.5 h-3.5" />
                {badge.label}
              </span>
            ))}
          </div>

          {/* Input */}
          <div className="w-full max-w-3xl animate-fade-in-up delay-700">
            <ChatInput
              onSubmit={handleSubmit}
              onStop={handleStop}
              onSendNow={() => {}}
              status="ready"
              isCentered={true}
              isNewChat={true}
              clearDraftOnSubmit={false}
              placeholder={animatedPlaceholder}
              autoFocus={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0">
          <Footer />
        </div>
      </div>
    </div>
  );
};

// Authenticated content that shows chat (UUID generated internally)
const AuthenticatedContent = () => {
  return <Chat autoResume={false} />;
};

// Main page component with Convex authentication
export default function Page() {
  const {
    subscription,
    teamPricingDialogOpen,
    setTeamPricingDialogOpen,
    teamWelcomeDialogOpen,
    setTeamWelcomeDialogOpen,
    migrateFromPentestgptDialogOpen,
    setMigrateFromPentestgptDialogOpen,
  } = useGlobalState();
  const { showPricing, handleClosePricing } = usePricingDialog(subscription);

  const { isMigrating, migrate } = usePentestgptMigration();
  const searchParams =
    typeof window !== "undefined" ? window.location.search : "";
  const { initialSeats, initialPlan } = React.useMemo(() => {
    if (typeof window === "undefined") {
      return { initialSeats: 5, initialPlan: "monthly" as const };
    }
    const urlParams = new URLSearchParams(searchParams);
    const urlSeats = urlParams.get("numSeats");
    const urlPlan = urlParams.get("selectedPlan");

    let seats = 5;
    if (urlSeats) {
      const parsed = parseInt(urlSeats, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        seats = parsed;
      }
    }

    const plan = (urlPlan === "yearly" ? "yearly" : "monthly") as
      | "monthly"
      | "yearly";

    return { initialSeats: seats, initialPlan: plan };
  }, [searchParams]);

  return (
    <>
      <Authenticated>
        <AuthenticatedContent />
        <ExtraUsagePurchaseToast />
        <PricingDialog isOpen={showPricing} onClose={handleClosePricing} />
        <TeamPricingDialog
          isOpen={teamPricingDialogOpen}
          onClose={() => setTeamPricingDialogOpen(false)}
          initialSeats={initialSeats}
          initialPlan={initialPlan}
        />
        <TeamWelcomeDialog
          open={teamWelcomeDialogOpen}
          onOpenChange={setTeamWelcomeDialogOpen}
        />
        <MigratePentestgptDialog
          open={migrateFromPentestgptDialogOpen}
          onOpenChange={setMigrateFromPentestgptDialogOpen}
          isMigrating={isMigrating}
          onConfirm={migrate}
        />
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedContent />
      </Unauthenticated>
    </>
  );
}
