import { NextRequest, NextResponse } from "next/server";
import { getUserIDAndPro } from "@/lib/auth/get-user-id";
import { createAdminClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/types/billing";

/**
 * Resolve the caller's org membership. Use this for any /api/team/* route
 * that requires the user to be on a team plan. Returns a ready-to-return
 * NextResponse for the guard failures.
 *
 * Caller decides whether to require admin role — for admin-only routes,
 * prefer requireAdminOrg below.
 */
export async function requireTeamOrg(
  req: NextRequest,
): Promise<
  | { ok: true; organizationId: string; userId: string; membership: TeamMember }
  | { ok: false; response: NextResponse }
> {
  const { userId, subscription } = await getUserIDAndPro(req);

  if (subscription !== "team") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Team subscription required" },
        { status: 403 },
      ),
    };
  }

  const supabase = await createAdminClient();

  // Find the team membership for this user
  const { data: membership } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No organization found" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    organizationId: membership.team_id,
    userId,
    membership,
  };
}

/**
 * Like requireTeamOrg but also rejects non-admins. Use this for routes
 * that mutate org-scoped state (invites, seats, team extra usage).
 *
 * On 403 the message names admin-only specifically — callers may override
 * with their own error copy before returning if they want different wording.
 */
export async function requireAdminOrg(
  req: NextRequest,
): Promise<
  | { ok: true; organizationId: string; userId: string; membership: TeamMember }
  | { ok: false; response: NextResponse }
> {
  const result = await requireTeamOrg(req);
  if (!result.ok) return result;

  if (
    result.membership.role !== "admin" &&
    result.membership.role !== "owner"
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin role required" },
        { status: 403 },
      ),
    };
  }

  return result;
}
