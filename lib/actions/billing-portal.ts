"use server";

import { stripe } from "../../app/api/stripe";
import { auth } from "@/auth";

export default async function redirectToBillingPortal() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  // NOTE: WorkOS organization logic removed since we migrated to NextAuth.
  // Update with your own Supabase or database organization logic if needed.
  // We mock the org id to an empty string to keep the rest compiling.
  const organizationId = "";

  if (false && !organizationId) {
    throw new Error("No organization found");
  }

  // Mocked WorkOS behavior to compile. Update this to use your own DB.
  /*
  const response = await fetch(
    `https://api.workos.com/organizations/${organizationId}`,
    ...
  );
  */
  const workosOrg = { stripe_customer_id: null };

  if (!workosOrg?.stripe_customer_id) {
    throw new Error(
      "No billing account found for this organization. You must update billing-portal.ts to use your DB.",
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const billingPortalSession = await stripe.billingPortal.sessions.create({
    customer: workosOrg.stripe_customer_id,
    return_url: `${baseUrl}`,
  });

  if (!billingPortalSession?.url) {
    throw new Error("Failed to create billing portal session");
  }
  return billingPortalSession.url;
}
