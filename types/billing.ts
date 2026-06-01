import { SubscriptionTier } from "./chat";

export interface Team {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string | null;
  team_id: string | null;
  tier: SubscriptionTier;
  status: "active" | "canceled" | "past_due" | "unpaid";
  payment_provider: "stripe" | "moncash" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  moncash_transaction_ref: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
