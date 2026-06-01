import type { NextRequest } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import type { SubscriptionTier } from "@/types";
import {
  parseEntitlements,
  resolveSubscriptionTier,
} from "@/lib/auth/entitlements";
import { auth } from "@/auth";

/**
 * Get the current user ID from the authenticated session
 * Throws ChatSDKError if user is not authenticated
 *
 * @param req - NextRequest object (server-side only)
 * @returns Promise<string> - User ID
 * @throws ChatSDKError - When user is not authenticated
 */
export const getUserID = async (req?: NextRequest): Promise<string> => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ChatSDKError("unauthorized:auth");
    }

    return session.user.id;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }

    console.error("Failed to get user session:", error);
    throw new ChatSDKError("unauthorized:auth");
  }
};

/**
 * Get the current user ID and pro status from the authenticated session
 * Throws ChatSDKError if user is not authenticated
 *
 * @param req - NextRequest object (server-side only)
 * @returns Promise<{ userId: string; isPro: boolean; subscription: SubscriptionTier }> - Object with userId, isPro, and subscription
 * @throws ChatSDKError - When user is not authenticated
 */
export const getUserIDAndPro = async (
  req?: NextRequest,
): Promise<{
  userId: string;
  subscription: SubscriptionTier;
  organizationId?: string;
}> => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ChatSDKError("unauthorized:auth");
    }

    const entitlements = parseEntitlements((session as any).entitlements || []);
    const subscription = resolveSubscriptionTier(entitlements);

    return {
      userId: session.user.id,
      subscription,
      organizationId: undefined, // Replace with your own logic if using organizations
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }

    console.error("Failed to get user session:", error);
    throw new ChatSDKError("unauthorized:auth");
  }
};

/**
 * Get the current user ID only if the user has signed in recently.
 * Since NextAuth doesn't natively track lastSignInAt, this currently just checks authentication.
 *
 * @param req - NextRequest object (server-side only)
 * @param windowMs - Freshness window in milliseconds (default 10 minutes)
 * @returns Promise<string> - User ID
 * @throws ChatSDKError - When user is not authenticated or login is stale
 */
export const getUserIDWithFreshLogin = async (
  req?: NextRequest,
  windowMs: number = 10 * 60 * 1000,
): Promise<string> => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ChatSDKError("unauthorized:auth", "missing_session_user");
    }

    // TODO: Implement fresh login logic with NextAuth JWT
    return session.user.id;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }

    console.error("Failed to verify fresh login:", error);
    throw new ChatSDKError("unauthorized:auth", "recent_login_required");
  }
};
