import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../stripe";
import { getTeamMemberConsumed, addOrgRemovedUsage } from "@/lib/rate-limit";
import { requireTeamOrg } from "../team-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const GET = async (req: NextRequest) => {
  try {
    const guard = await requireTeamOrg(req);
    if (!guard.ok) return guard.response;
    const { userId, organizationId, membership } = guard;
    const isAdmin = membership.role === "admin" || membership.role === "owner";

    const supabase = await createAdminClient();

    // Get organization details and members
    const { data: organization } = await supabase
      .from("teams")
      .select("*")
      .eq("id", organizationId)
      .single();
    const { data: allMembers } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", organizationId);

    // Get user details for each member
    const membersWithDetails = await Promise.all(
      (allMembers || []).map(async (member) => {
        const {
          data: { user },
        } = await supabase.auth.admin.getUserById(member.user_id);
        return {
          id: member.id,
          userId: member.user_id,
          email: user?.email || "",
          firstName: user?.user_metadata?.first_name || "",
          lastName: user?.user_metadata?.last_name || "",
          role: member.role || "member",
          createdAt: member.created_at,
          isCurrentUser: member.user_id === userId,
        };
      }),
    );

    const currentSeats = allMembers?.length || 0;
    let totalSeats = currentSeats; // Default to current if no Stripe info
    let billingPeriod: "monthly" | "yearly" | null = null;

    // Get seat limit from Stripe subscription if available
    const { data: teamSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("team_id", organizationId)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    if (teamSub?.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: teamSub.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const stripeSubscription = subscriptions.data[0];
          totalSeats =
            stripeSubscription.items.data[0]?.quantity || currentSeats;

          // Determine billing period from the price
          const priceId = stripeSubscription.items.data[0]?.price.id;
          if (priceId) {
            const price = await stripe.prices.retrieve(priceId);
            if (price.recurring?.interval === "year") {
              billingPeriod = "yearly";
            } else if (price.recurring?.interval === "month") {
              billingPeriod = "monthly";
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch Stripe subscription:", error);
      }
    }

    // Pending invitations (not supported in simple MVP, returning empty)
    const invitationsWithDetails: any[] = [];
    const pendingInvitationsCount = invitationsWithDetails.length;
    const availableSeats = Math.max(
      0,
      totalSeats - (currentSeats + pendingInvitationsCount),
    );

    return NextResponse.json({
      members: membersWithDetails,
      invitations: invitationsWithDetails,
      teamInfo: {
        teamId: organization?.id,
        teamName: organization?.name,
        currentSeats,
        totalSeats,
        availableSeats,
        billingPeriod,
      },
      isAdmin,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    console.error("Failed to fetch team data:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};

export const DELETE = async (req: NextRequest) => {
  try {
    const guard = await requireTeamOrg(req);
    if (!guard.ok) return guard.response;
    const { userId, organizationId, membership: userMembership } = guard;

    const { searchParams } = new URL(req.url);
    const membershipId = searchParams.get("id");

    if (!membershipId) {
      return NextResponse.json(
        { error: "Membership ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createAdminClient();

    // Try to get the membership
    const { data: membershipToDelete } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", membershipId)
      .single();

    if (!membershipToDelete) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Verify it belongs to the same organization
    if (membershipToDelete.team_id !== organizationId) {
      return NextResponse.json(
        { error: "Member not found in your organization" },
        { status: 404 },
      );
    }

    // Check if this is the last admin
    const { data: allMembers } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", organizationId);

    const adminCount = (allMembers || []).filter(
      (m) => m.role === "admin" || m.role === "owner",
    ).length;

    // Allow non-admins to remove themselves (leave team)
    const isSelfRemoval = membershipToDelete.user_id === userId;
    const isRemoverAdmin =
      userMembership.role === "admin" || userMembership.role === "owner";

    if (isSelfRemoval) {
      // If you're an admin trying to leave
      if (
        (membershipToDelete.role === "admin" ||
          membershipToDelete.role === "owner") &&
        adminCount <= 1
      ) {
        return NextResponse.json(
          {
            error: "Cannot leave as the last admin",
            details:
              "You must have at least one admin in the organization. Please promote another member to admin before leaving.",
          },
          { status: 400 },
        );
      }
      // Non-admins can always leave
    } else {
      // Removing another member - only admins can do this
      if (!isRemoverAdmin) {
        return NextResponse.json(
          { error: "Only admins can remove other members" },
          { status: 403 },
        );
      }

      // Admins can't remove other admins if it's the last one
      if (
        (membershipToDelete.role === "admin" ||
          membershipToDelete.role === "owner") &&
        adminCount <= 1
      ) {
        return NextResponse.json(
          {
            error: "Cannot remove the last admin",
            details:
              "You must have at least one admin in the organization. Please promote another member to admin before removing this user.",
          },
          { status: 400 },
        );
      }
    }

    // Snapshot consumed credits before deletion (bucket is still accessible)
    const consumed = await getTeamMemberConsumed(membershipToDelete.user_id);

    // Delete the membership first — only record debt if deletion succeeds
    await supabase.from("team_members").delete().eq("id", membershipId);

    // Record removed member's consumed credits to org counter
    // so the next new member inherits the "used seat" debt
    if (consumed > 0) {
      await addOrgRemovedUsage(organizationId, consumed);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    console.error("Failed to remove team member:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
