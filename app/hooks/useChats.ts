"use client";

import { usePaginatedQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";

/**
 * Wrapper around usePaginatedQuery for user chats.
 * Auth is enforced server-side by Convex.
 */
export const useChats = (shouldFetch = true) =>
  usePaginatedQuery(api.chats.getUserChats, shouldFetch ? {} : "skip", {
    initialNumItems: 28,
  });

export const usePinChat = () => useMutation(api.chats.pinChat);
export const useUnpinChat = () => useMutation(api.chats.unpinChat);
