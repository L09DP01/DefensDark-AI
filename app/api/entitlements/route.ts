import { NextRequest } from "next/server";
import { json } from "@/lib/api/response";
import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/types";

function planTierToEntitlements(tier: SubscriptionTier): string[] {
  switch (tier) {
    case "ultra":
      return ["ultra-plan"];
    case "pro-plus":
      return ["pro-plus-plan"];
    case "pro":
      return ["pro-plan"];
    case "team":
      return ["team-plan"];
    default:
      return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return json({ error: "No session found" }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. Fetch user's personal subscriptions
    const { data: userSubs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", session.user.id);

    // 2. Fetch user's team memberships to get team subscriptions
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", session.user.id);

    let teamSubs: any[] = [];
    if (teamMembers && teamMembers.length > 0) {
      const teamIds = teamMembers.map((tm) => tm.team_id);
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .in("team_id", teamIds);
      if (data) teamSubs = data;
    }

    const allSubs = [...(userSubs || []), ...teamSubs];

    // 3. Filter active subscriptions considering the 3-day grace period
    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() - 3);

    const activeSubs = allSubs.filter((sub) => {
      // If manually canceled and expired, usually we drop it. But let's follow the grace period strictly.
      if (sub.status === "canceled") return false;
      if (sub.expires_at) {
        const expiresAt = new Date(sub.expires_at);
        if (expiresAt < graceDate) return false;
      }
      return true;
    });

    // 4. Determine the highest tier
    let bestTier: SubscriptionTier = "free";
    const tierPriority: Record<SubscriptionTier, number> = {
      ultra: 4,
      team: 3,
      "pro-plus": 2,
      pro: 1,
      free: 0,
    };

    for (const sub of activeSubs) {
      if (tierPriority[sub.tier as SubscriptionTier] > tierPriority[bestTier]) {
        bestTier = sub.tier as SubscriptionTier;
      }
    }

    const allEntitlements = planTierToEntitlements(bestTier);

    return json({
      entitlements: allEntitlements,
      subscription: bestTier,
    });
  } catch (error) {
    console.error("Failed to fetch entitlements:", error);
    return json({ error: "Failed to fetch entitlements" }, { status: 500 });
  }
}
