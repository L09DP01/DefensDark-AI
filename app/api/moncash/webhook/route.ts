import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { phLogger } from "@/lib/posthog/server";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-moncash-signature"); // example signature header
    const body = await req.json().catch(() => ({}));

    // TODO: Verify MonCash webhook signature
    // if (!verifyMoncashSignature(JSON.stringify(body), signature)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    // }

    const { transaction_id, status, plan, user_id, team_id, expires_at } = body;

    if (status === "succeeded") {
      const supabase = await createAdminClient();

      const payload: any = {
        tier: plan,
        status: "active",
        payment_provider: "moncash",
        moncash_transaction_ref: transaction_id,
        expires_at:
          expires_at ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (team_id) {
        payload.team_id = team_id;

        // Find existing team subscription
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("team_id", team_id)
          .limit(1)
          .single();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update(payload)
            .eq("id", existingSub.id);
        } else {
          await supabase.from("subscriptions").insert(payload);
        }
      } else if (user_id) {
        payload.user_id = user_id;

        // Find existing user subscription
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user_id)
          .limit(1)
          .single();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update(payload)
            .eq("id", existingSub.id);
        } else {
          await supabase.from("subscriptions").insert(payload);
        }
      }

      phLogger.event("moncash_subscription_started", {
        userId: user_id,
        org_id: team_id,
        tier: plan,
        transaction_id,
      });

      return NextResponse.json({ received: true });
    }

    if (status === "failed" || status === "expired") {
      // Update status to canceled
      const supabase = await createAdminClient();

      let query = supabase.from("subscriptions").update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      });

      if (team_id) {
        query = query.eq("team_id", team_id);
      } else if (user_id) {
        query = query.eq("user_id", user_id);
      } else {
        query = query.eq("moncash_transaction_ref", transaction_id);
      }

      await query;

      phLogger.event("moncash_subscription_failed", {
        userId: user_id,
        org_id: team_id,
        tier: plan,
        transaction_id,
      });

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[MonCash Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
