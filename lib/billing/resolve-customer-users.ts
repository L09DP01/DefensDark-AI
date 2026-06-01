import { stripe } from "@/app/api/stripe";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function resolveUserIdsFromCustomer(
  customerId: string,
  logPrefix: string,
): Promise<{ userIds: string[]; orgId: string | null }> {
  try {
    const customerData = await stripe.customers.retrieve(customerId);
    if (customerData.deleted) return { userIds: [], orgId: null };

    const customer = customerData as Stripe.Customer;
    const userId = customer.metadata?.supabaseUserId ?? null;

    const supabase = await createAdminClient();

    if (!userId) {
      // Try to find the user in Supabase by stripe_customer_id
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id, team_id")
        .eq("stripe_customer_id", customerId)
        .limit(1)
        .single();

      if (sub?.user_id) {
        return { userIds: [sub.user_id], orgId: sub.team_id };
      }

      console.error(
        `[${logPrefix}] Customer ${customerId} missing supabaseUserId metadata and not found in db`,
      );
      return { userIds: [], orgId: null };
    }

    // Check if this user is part of a team subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("team_id")
      .eq("stripe_customer_id", customerId)
      .limit(1)
      .single();

    const teamId = sub?.team_id || null;

    if (teamId) {
      // Fetch all team members
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);

      if (members && members.length > 0) {
        const teamUserIds = members.map((m) => m.user_id);
        return { userIds: teamUserIds, orgId: teamId };
      }
    }

    return { userIds: [userId], orgId: null };
  } catch (error) {
    console.error(
      `[${logPrefix}] Failed to resolve users for customer ${customerId}:`,
      error,
    );
    return { userIds: [], orgId: null };
  }
}
