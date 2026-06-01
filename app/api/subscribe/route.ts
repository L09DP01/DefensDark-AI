import { stripe } from "../stripe";
import { getUserID } from "@/lib/auth/get-user-id";
import { NextRequest, NextResponse, after } from "next/server";
import { getSuspensionMessage } from "@/lib/suspensionMessage";
import { phLogger } from "@/lib/posthog/server";
import { createClient } from "@/lib/supabase/server";
import { KobaraClient } from "kobara-js";

function planLookupKeyToTier(
  lookupKey: string,
): "pro" | "pro-plus" | "ultra" | "team" | null {
  if (lookupKey.startsWith("ultra")) return "ultra";
  if (lookupKey.startsWith("pro-plus")) return "pro-plus";
  if (lookupKey.startsWith("team")) return "team";
  if (lookupKey.startsWith("pro")) return "pro";
  return null;
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedPlan: string | undefined = body?.plan;
    const requestedQuantity: number | undefined = body?.quantity;
    const paymentProvider: string | undefined =
      body?.paymentProvider || "stripe";

    const posthogDistinctId = req.headers.get("x-posthog-distinct-id");
    const posthogSessionId = req.headers.get("x-posthog-session-id");
    const userId = await getUserID(req);
    const supabase = await createClient();

    const { data: user } = await supabase.auth.getUser();

    const allowedPlans = new Set([
      "pro-monthly-plan",
      "pro-plus-monthly-plan",
      "ultra-monthly-plan",
      "pro-yearly-plan",
      "pro-plus-yearly-plan",
      "ultra-yearly-plan",
      "team-monthly-plan",
      "team-yearly-plan",
    ]);

    const subscriptionLevel =
      typeof requestedPlan === "string" && allowedPlans.has(requestedPlan)
        ? requestedPlan
        : "pro-monthly-plan";

    const quantity =
      requestedQuantity && requestedQuantity >= 1 ? requestedQuantity : 1;

    // TODO: Create a Team if requesting a team plan, for now associate with user
    const teamId = null;

    if (paymentProvider === "moncash") {
      // MONCASH (KOBARA) INTEGRATION
      const PRICING = {
        "pro-monthly-plan": 25,
        "pro-yearly-plan": 21 * 12,
        "pro-plus-monthly-plan": 60,
        "pro-plus-yearly-plan": 50 * 12,
        "ultra-monthly-plan": 200,
        "ultra-yearly-plan": 166 * 12,
        "team-monthly-plan": 40,
        "team-yearly-plan": 33 * 12,
      };

      const amount = PRICING[subscriptionLevel as keyof typeof PRICING] || 25;

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "https://defensdark-ai.vercel.app";
      const successUrl = new URL(baseUrl);
      successUrl.searchParams.set("refresh", "entitlements");
      const cancelUrl = new URL(baseUrl);

      const kobara = new KobaraClient({
        apiKey: process.env.KOBARA_SECRET_KEY || "",
      });

      const payment = await kobara.payments.create({
        amount,
        currency: "USD",
        description: `DefensDark AI - ${subscriptionLevel}`,
        customer: {
          email: user?.user?.email,
        },
        successUrl: successUrl.toString(),
        errorUrl: cancelUrl.toString(),
        metadata: {
          userId,
          requestedPlan: subscriptionLevel,
        },
      });

      return NextResponse.json({ url: payment.payment_url });
    } else {
      // STRIPE INTEGRATION
      let price;
      try {
        price = await stripe.prices.list({
          lookup_keys: [subscriptionLevel],
        });

        if (!price.data || price.data.length === 0) {
          return NextResponse.json(
            {
              error: "Subscription plan not found",
              details: `No price found for plan: ${subscriptionLevel}`,
            },
            { status: 404 },
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Error retrieving price from Stripe" },
          { status: 500 },
        );
      }

      // Check if user already has a stripe_customer_id in our DB
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .single();

      let customerId = existingSub?.stripe_customer_id;
      let customer;

      if (customerId) {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if ("deleted" in existingCustomer && existingCustomer.deleted) {
          return NextResponse.json(
            { error: "Billing account is no longer available" },
            { status: 409 },
          );
        }
        customer = existingCustomer;

        if (customer.metadata.blocked === "true") {
          return NextResponse.json(
            { error: getSuspensionMessage(customer.metadata.blocked_reason) },
            { status: 403 },
          );
        }
      } else {
        // Create new Stripe customer
        customer = await stripe.customers.create({
          email: user?.user?.email,
          metadata: {
            supabaseUserId: userId,
          },
        });
        customerId = customer.id;
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      if (!baseUrl) {
        return NextResponse.json(
          { error: "NEXT_PUBLIC_BASE_URL is not configured" },
          { status: 500 },
        );
      }

      const successUrl = new URL(baseUrl);
      successUrl.searchParams.set("refresh", "entitlements");

      if (subscriptionLevel.startsWith("team")) {
        successUrl.searchParams.set("team-welcome", "true");
      }

      const cancelUrl = new URL(baseUrl);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        billing_address_collection: "auto",
        line_items: [
          {
            price: price.data[0].id,
            quantity: quantity,
          },
        ],
        mode: "subscription",
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
        metadata: {
          userId,
          requestedPlan: subscriptionLevel,
        },
        subscription_data: {
          metadata: {
            userId,
            requestedPlan: subscriptionLevel,
          },
        },
        custom_text: {
          submit: {
            message:
              "Renews automatically until cancelled. Cancel anytime in Settings.",
          },
        },
      });

      const selectedPrice = price.data[0];
      phLogger.event("checkout_started", {
        userId,
        from_tier: "free",
        to_tier: planLookupKeyToTier(subscriptionLevel),
        plan: subscriptionLevel,
        billing_interval: selectedPrice.recurring?.interval,
        billing_interval_count: selectedPrice.recurring?.interval_count,
        quantity,
        checkout_amount_dollars:
          selectedPrice.unit_amount != null
            ? (selectedPrice.unit_amount * quantity) / 100
            : undefined,
        currency: selectedPrice.currency,
        stripe_customer_id: customerId,
        stripe_checkout_session_id: session.id,
        stripe_price_id: selectedPrice.id,
        client_distinct_id: posthogDistinctId ?? undefined,
        $session_id: posthogSessionId ?? undefined,
        $set: {
          last_checkout_started_at: new Date().toISOString(),
        },
      });
      after(() => phLogger.flush());

      return NextResponse.json({ url: session.url });
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    console.error(errorMessage, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
