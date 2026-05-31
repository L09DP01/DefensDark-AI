import "server-only";

import { ChatSDKError } from "../errors";
import { createAdminClient } from "@/lib/supabase/server";
import { UIMessage, UIMessagePart } from "ai";
import { extractFileIdsFromParts } from "@/lib/utils/file-token-utils";
import {
  extractAllFileIdsFromMessages,
  getFileTokensByIds,
  truncateMessagesWithFileTokens,
} from "@/lib/utils/file-token-utils";
import {
  countMessagesTokens,
  getMaxTokensForSubscription,
  truncateMessagesToTokenLimit,
} from "@/lib/token-utils";
import { fixIncompleteMessageParts } from "@/lib/chat/chat-processor";
import { compactMessageForStorage } from "@/lib/chat/compaction/prune-tool-outputs";
import type { SubscriptionTier, NoteCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { AGENT_RESUME_PREAMBLE } from "@/lib/chat/summarization/prompts";
import { isAgentMode } from "@/lib/utils/mode-helpers";
import { hasRestageableLocalDesktopAttachments } from "@/lib/utils/local-attachment-messages";
import type { ChatMode } from "@/types/chat";
import { getMessagePersistenceDiagnostics } from "./message-persistence-diagnostics";
import { sanitizeForConvexValue } from "./convex-value-sanitizer";

const MAX_DATABASE_ERROR_MESSAGE_LENGTH = 500;
const MAX_DATABASE_ERROR_DATA_STRING_LENGTH = 500;
const MAX_DATABASE_ERROR_DATA_BYTES = 4 * 1024;
const MAX_DATABASE_ERROR_DATA_DEPTH = 3;
const MAX_DATABASE_ERROR_DATA_ARRAY_LENGTH = 20;
const LARGE_MESSAGE_SAVE_WARNING_BYTES = 850 * 1024;
const REDACTED_ERROR_DATA_VALUE = "[Redacted]";

const sensitiveErrorDataKeys = new Set([
  "authorization",
  "body",
  "content",
  "cookie",
  "cookies",
  "file",
  "files",
  "headers",
  "messages",
  "output",
  "parts",
  "password",
  "prompt",
  "request",
  "requestbody",
  "response",
  "responsebody",
  "result",
  "text",
  "token",
]);

// ... utility functions
const stringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const getErrorData = (error: unknown): unknown => {
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: unknown }).data;
  return data === undefined ? undefined : data;
};

const truncateDiagnosticString = (value: string): string =>
  value.length > MAX_DATABASE_ERROR_MESSAGE_LENGTH
    ? `${value.slice(0, MAX_DATABASE_ERROR_MESSAGE_LENGTH)}...`
    : value;

const getDatabaseErrorCode = (data: unknown): string | undefined => undefined;
const getDatabaseFailureStage = (data: unknown): string | undefined => undefined;

const isChatNotFoundMessageSaveError = (
  operation: string,
  dbErrorData: unknown,
): boolean =>
  operation === "messages.saveMessage" &&
  getDatabaseErrorCode(dbErrorData) === "CHAT_NOT_FOUND";

const logChatMessagePreparationFailure = (
  event: string,
  level: "warn" | "error",
  fields: Record<string, unknown>,
) => {
  const payload = {
    level,
    event,
    service: "chat-handler",
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "warn") {
    console.warn(line);
  } else {
    console.error(line);
  }
};

const databaseError = (
  operation: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
) => {
  const dbErrorName = error instanceof Error ? error.name : typeof error;
  const dbErrorMessage = truncateDiagnosticString(stringifyError(error));
  const dbErrorData = getErrorData(error);
  const isChatNotFound = isChatNotFoundMessageSaveError(operation, dbErrorData);
  const diagnosticMetadata = {
    db_operation: operation,
    db_error_name: dbErrorName,
    db_error_message: dbErrorMessage,
    db_error_data: dbErrorData,
    db_error_code: getDatabaseErrorCode(dbErrorData),
    db_failure_stage: getDatabaseFailureStage(dbErrorData),
    ...metadata,
  };

  const logPayload = {
    level: isChatNotFound ? "warn" : "error",
    event: isChatNotFound
      ? "database_operation_skipped_chat_not_found"
      : "database_operation_failed",
    service: "chat-handler",
    timestamp: new Date().toISOString(),
    ...diagnosticMetadata,
  };

  const logLine = JSON.stringify(logPayload);
  if (isChatNotFound) {
    console.warn(logLine);
  } else {
    console.error(logLine);
  }

  return new ChatSDKError(
    isChatNotFound ? "not_found:chat" : "bad_request:database",
    isChatNotFound
      ? `Chat no longer exists while saving message: ${operation}: ${dbErrorMessage}`
      : `Database operation failed: ${operation}: ${dbErrorMessage}`,
    diagnosticMetadata,
  );
};

export async function getChatById({ id }: { id: string }) {
  try {
    const supabase = createAdminClient();
    const { data: selectedChat, error } = await supabase
      .from("chats")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return selectedChat || null;
  } catch (error) {
    throw databaseError("chats.getChatById", error, { chat_id: id });
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("chats")
      .insert({
        id,
        user_id: userId,
        title,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    throw databaseError("chats.saveChat", error, {
      chat_id: id,
      user_id: userId,
      title_length: title.length,
    });
  }
}

export async function saveMessage({
  chatId,
  userId,
  message,
  extraFileIds,
  model,
  mode,
  generationStartedAt,
  generationTimeMs,
  finishReason,
  usage,
  updateOnly,
  isHidden,
  wasAborted,
  wasPreemptiveTimeout,
}: {
  chatId: string;
  userId: string;
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    parts: UIMessagePart<any, any>[];
  };
  extraFileIds?: Array<string>;
  model?: string;
  mode?: ChatMode;
  generationStartedAt?: number;
  generationTimeMs?: number;
  finishReason?: string;
  usage?: Record<string, unknown>;
  updateOnly?: boolean;
  isHidden?: boolean;
  wasAborted?: boolean;
  wasPreemptiveTimeout?: boolean;
}) {
  let fixedParts = message.parts;
  let partsForSave = message.parts;
  let persistenceDiagnostics = getMessagePersistenceDiagnostics(partsForSave);

  try {
    fixedParts =
      message.role === "assistant"
        ? fixIncompleteMessageParts(message.parts, {
            logContext: {
              service: "chat-handler",
              source: "save_message",
              chatId,
              userId,
              messageId: message.id,
              mode,
              finishReason,
              updateOnly,
            },
          })
        : message.parts;
    const convexSafeParts = sanitizeForConvexValue(fixedParts) as UIMessagePart<any, any>[];
    const storageSafeMessage =
      message.role === "assistant"
        ? compactMessageForStorage({ ...message, parts: convexSafeParts })
        : null;
    const storageSafeParts = storageSafeMessage?.message.parts ?? convexSafeParts;

    partsForSave = sanitizeForConvexValue(storageSafeParts) as UIMessagePart<any, any>[];
    persistenceDiagnostics = getMessagePersistenceDiagnostics(partsForSave);

    const fileIds = extractFileIdsFromParts(partsForSave);
    const mergedFileIds = [
      ...fileIds,
      ...((extraFileIds || []).filter(Boolean) as string[]),
    ];

    const supabase = createAdminClient();
    
    if (updateOnly) {
      const { error } = await supabase
        .from("messages")
        .update({
          parts: partsForSave,
          model,
          mode,
          generation_started_at: generationStartedAt,
          generation_time_ms: generationTimeMs,
          finish_reason: finishReason,
          usage,
          is_hidden: isHidden,
        })
        .eq("id", message.id);
      if (error) throw error;
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .upsert({
        id: message.id,
        chat_id: chatId,
        user_id: userId,
        role: message.role,
        parts: partsForSave,
        file_ids: mergedFileIds.length > 0 ? mergedFileIds : null,
        model,
        mode,
        generation_started_at: generationStartedAt,
        generation_time_ms: generationTimeMs,
        finish_reason: finishReason,
        usage,
        is_hidden: isHidden,
      });
      
    if (error) throw error;
    return data;
  } catch (error) {
    throw databaseError("messages.saveMessage", error, {
      chat_id: chatId,
      user_id: userId,
      message_id: message.id,
      ...persistenceDiagnostics,
    });
  }
}

export async function handleInitialChatAndUserMessage({
  chatId,
  userId,
  messages,
  regenerate,
  chat,
  isHidden,
}: {
  chatId: string;
  userId: string;
  messages: { id: string; parts: UIMessagePart<any, any>[] }[];
  regenerate?: boolean;
  chat: any;
  isHidden?: boolean;
}) {
  if (!chat) {
    let title = "New Chat";

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (
        lastMessage?.parts &&
        Array.isArray(lastMessage.parts) &&
        lastMessage.parts.length > 0
      ) {
        const firstPart = lastMessage.parts[0];
        if (firstPart?.type === "text" && firstPart.text) {
          title = firstPart.text;
        }
      }
    }

    title = (title ?? "New Chat").substring(0, 100);

    await saveChat({
      id: chatId,
      userId,
      title,
    });
  } else {
    if (chat.user_id !== userId) {
      throw new ChatSDKError(
        "forbidden:chat",
        "You don't have permission to access this chat",
      );
    }
  }

  if (!regenerate && Array.isArray(messages) && messages.length > 0) {
    await saveMessage({
      chatId,
      userId,
      message: {
        id: messages[messages.length - 1].id,
        role: "user",
        parts: messages[messages.length - 1].parts,
      },
      isHidden,
    });
  }
}

export async function updateChat({
  chatId,
  title,
  finishReason,
  todos,
  defaultModelSlug,
  sandboxType,
  selectedModel,
}: {
  chatId: string;
  title?: string;
  finishReason?: string;
  todos?: Array<any>;
  defaultModelSlug?: "ask" | "agent";
  sandboxType?: string;
  selectedModel?: string;
}) {
  try {
    const supabase = createAdminClient();
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (finishReason !== undefined) updateData.finish_reason = finishReason;
    if (todos !== undefined) updateData.todos = todos;
    if (defaultModelSlug !== undefined) updateData.default_model_slug = defaultModelSlug;
    if (sandboxType !== undefined) updateData.sandbox_type = sandboxType;
    if (selectedModel !== undefined) updateData.selected_model = selectedModel;

    const { error } = await supabase.from("chats").update(updateData).eq("id", chatId);
    if (error) throw error;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", `Failed to update chat: ${error}`);
  }
}

export async function getMessagesByChatId({
  chatId,
  userId,
  newMessages,
  regenerate,
  subscription,
  isTemporary,
  mode,
  useClientMessagesForRegenerate,
}: {
  chatId: string;
  userId: string;
  subscription: SubscriptionTier;
  newMessages: UIMessage[];
  regenerate?: boolean;
  isTemporary?: boolean;
  mode?: ChatMode;
  useClientMessagesForRegenerate?: boolean;
}) {
  let chat = undefined;
  let isNewChat = true;
  let existingMessages: UIMessage[] = [];

  if (!isTemporary) {
    chat = await getChatById({ id: chatId });
    isNewChat = !chat;

    const shouldUseClientMessagesForRegenerate =
      !!regenerate &&
      !!useClientMessagesForRegenerate &&
      Array.isArray(newMessages) &&
      newMessages.length > 0 &&
      hasRestageableLocalDesktopAttachments(newMessages);

    if (!isNewChat && shouldUseClientMessagesForRegenerate) {
      existingMessages = newMessages;
    }

    if (!isNewChat && !shouldUseClientMessagesForRegenerate) {
      try {
        const latestSummary = chat?.latest_summary_id
          ? await getLatestSummary({ chatId })
          : null;

        const supabase = createAdminClient();
        const { data: messages, error } = await supabase
          .from("messages")
          .select("*")
          .eq("chat_id", chatId)
          .order("update_time", { ascending: false })
          .limit(96);
          
        if (error) throw error;

        let fetchedDesc = (messages || []).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content || "",
          parts: m.parts,
          // mapping other fields...
        })) as UIMessage[];

        let fileTokensFromLoop: Record<string, number> = {};
        const skipFileTokens = mode === "agent";

        let truncatedFromLoop: UIMessage[] | null = null;
        
        const existingChrono = [...fetchedDesc].reverse();
        const candidate = regenerate && !isTemporary ? existingChrono : [...existingChrono, ...newMessages];

        if (!skipFileTokens) {
          const allFileIds = extractAllFileIdsFromMessages(candidate);
          if (allFileIds.length > 0) {
            const newTokens = await getFileTokensByIds(allFileIds as any, userId);
            Object.assign(fileTokensFromLoop, newTokens);
          }
        }

        const maxTokens = getMaxTokensForSubscription(subscription, { mode });
        truncatedFromLoop = truncateMessagesToTokenLimit(candidate, fileTokensFromLoop, maxTokens);

        if (regenerate && !isTemporary && truncatedFromLoop) {
          while (
            truncatedFromLoop.length > 0 &&
            truncatedFromLoop[truncatedFromLoop.length - 1].role === "assistant"
          ) {
            truncatedFromLoop = truncatedFromLoop.slice(0, -1);
          }
        }

        if (!fetchedDesc.length && !truncatedFromLoop) {
          existingMessages = [];
        } else if (!truncatedFromLoop) {
          existingMessages = [...fetchedDesc].reverse();
        } else {
          if (latestSummary) {
            const summaryUpToId = latestSummary.summary_up_to_message_id;
            const cutoffIndex = truncatedFromLoop.findIndex((m) => m.id === summaryUpToId);
            const messagesAfterCutoff = cutoffIndex >= 0 ? truncatedFromLoop.slice(cutoffIndex + 1) : truncatedFromLoop;

            const summaryPrefix = mode && isAgentMode(mode) ? AGENT_RESUME_PREAMBLE : "";
            const summaryMessage: UIMessage = {
              id: uuidv4(),
              role: "user",
              parts: [{ type: "text", text: `${summaryPrefix}<context_summary>\n${latestSummary.summary_text}\n</context_summary>` }],
            };

            const summaryTokens = countMessagesTokens([summaryMessage], fileTokensFromLoop);
            const budgetForMessages = maxTokens - summaryTokens;
            const truncatedAfterCutoff = budgetForMessages > 0
                ? truncateMessagesToTokenLimit(messagesAfterCutoff, fileTokensFromLoop, budgetForMessages)
                : [];
            const truncatedWithSummary: UIMessage[] = [summaryMessage, ...truncatedAfterCutoff];

            return { truncatedMessages: truncatedWithSummary, chat, isNewChat, fileTokens: fileTokensFromLoop };
          }

          return { truncatedMessages: truncatedFromLoop, chat, isNewChat, fileTokens: fileTokensFromLoop };
        }
      } catch (error) {
        if (newMessages.length === 0) {
          throw databaseError("messages.getMessagesPageForBackend", error, { chatId });
        }
      }
    }
  }

  let allMessages: UIMessage[];
  if (regenerate && !isTemporary) {
    allMessages = existingMessages;
    while (allMessages.length > 0 && allMessages[allMessages.length - 1].role === "assistant") {
      allMessages = allMessages.slice(0, -1);
    }
  } else {
    allMessages = [...existingMessages, ...newMessages];
  }

  const truncateResult = await truncateMessagesWithFileTokens(
    allMessages,
    subscription,
    mode === "agent",
    mode,
    userId,
  );
  const truncatedMessages = truncateResult.messages;
  const fileTokens = truncateResult.fileTokens;

  if (!truncatedMessages || truncatedMessages.length === 0) {
    if (allMessages.length === 0) {
      throw new ChatSDKError("bad_request:api", "No message content was found");
    }
    throw new ChatSDKError("bad_request:api", "Your input is too large");
  }

  return { truncatedMessages, chat, isNewChat, fileTokens };
}

export async function getUserCustomization({ userId }: { userId: string }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("user_customization").select("*").eq("user_id", userId).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  } catch (error) {
    return null;
  }
}

export async function setActiveTriggerRun({ chatId, triggerRunId, expectedRunId }: { chatId: string, triggerRunId: string | null, expectedRunId?: string }) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("chats").update({ active_trigger_run_id: triggerRunId }).eq("id", chatId);
    if (error) throw error;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to set active trigger run");
  }
}

export async function getActiveTriggerRun({ chatId }: { chatId: string }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("chats").select("active_trigger_run_id").eq("id", chatId).single();
    if (error) throw error;
    return data?.active_trigger_run_id || null;
  } catch (error) {
    return null;
  }
}

export async function startStream({ chatId, streamId }: { chatId: string, streamId: string }) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("chats").update({ active_stream_id: streamId }).eq("id", chatId);
    if (error) throw error;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to start stream");
  }
}

export async function prepareForNewStream({ chatId }: { chatId: string }) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("chats").update({ active_stream_id: null, canceled_at: null }).eq("id", chatId);
    if (error) throw error;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to prepare for new stream");
  }
}

export async function getCancellationStatus({ chatId }: { chatId: string }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("chats").select("canceled_at").eq("id", chatId).single();
    if (error) throw error;
    return data?.canceled_at || null;
  } catch (error) {
    return null;
  }
}

export async function startTempStream({ chatId, userId }: { chatId: string, userId: string }) {
  try {
    const supabase = createAdminClient();
    await supabase.from("temp_streams").upsert({ chat_id: chatId, user_id: userId });
  } catch (error) {}
}

export async function getTempCancellationStatus({ chatId }: { chatId: string }) {
  // Simplification for temp streams
  return null;
}

export async function deleteTempStreamForBackend({ chatId }: { chatId: string }) {
  try {
    const supabase = createAdminClient();
    await supabase.from("temp_streams").delete().eq("chat_id", chatId);
  } catch (error) {}
}

export async function saveChatSummary({ chatId, summaryText, summaryUpToMessageId }: { chatId: string, summaryText: string, summaryUpToMessageId: string }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("chat_summaries").insert({
      chat_id: chatId,
      summary_text: summaryText,
      summary_up_to_message_id: summaryUpToMessageId,
    }).select().single();
    
    if (error) throw error;

    // Update chat latest summary
    await supabase.from("chats").update({ latest_summary_id: data.id }).eq("id", chatId);
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat summary");
  }
}

export async function getLatestSummary({ chatId }: { chatId: string }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("chats").select("latest_summary_id").eq("id", chatId).single();
    if (error || !data?.latest_summary_id) return null;

    const { data: summary, error: summaryError } = await supabase.from("chat_summaries").select("*").eq("id", data.latest_summary_id).single();
    if (summaryError) return null;
    return summary;
  } catch (error) {
    return null;
  }
}

export async function createNote({ userId, title, content, category, tags }: { userId: string, title: string, content: string, category?: NoteCategory, tags?: string[] }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("notes").insert({
      user_id: userId,
      note_id: uuidv4(),
      title,
      content,
      category: category || "general",
      tags: tags || [],
      tokens: 0,
    }).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to create note");
  }
}

export async function listNotes({ userId, category, tags, search }: { userId: string, category?: NoteCategory, tags?: string[], search?: string }) {
  try {
    const supabase = createAdminClient();
    let query = supabase.from("notes").select("*").eq("user_id", userId);
    if (category) query = query.eq("category", category);
    if (tags && tags.length > 0) query = query.contains("tags", tags);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to list notes");
  }
}

export async function updateNote({ userId, noteId, title, content, tags }: { userId: string, noteId: string, title?: string, content?: string, tags?: string[] }) {
  try {
    const supabase = createAdminClient();
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (tags !== undefined) updateData.tags = tags;
    const { data, error } = await supabase.from("notes").update(updateData).eq("note_id", noteId).eq("user_id", userId).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to update note");
  }
}

export async function deleteNote({ userId, noteId }: { userId: string, noteId: string }) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("notes").delete().eq("note_id", noteId).eq("user_id", userId);
    if (error) throw error;
    return true;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete note");
  }
}

export async function getNotes({ userId, subscription }: { userId: string, subscription: SubscriptionTier }) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("notes").select("*").eq("user_id", userId);
    if (error) throw error;
    return data || [];
  } catch (error) {
    return [];
  }
}

export async function logUsageRecord({
  userId,
  model,
  type,
  inputTokens,
  outputTokens,
  totalTokens,
  cacheReadTokens,
  cacheWriteTokens,
  costDollars,
}: {
  userId: string;
  model: string;
  type: "included" | "extra";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costDollars: number;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("usage_logs").insert({
      user_id: userId,
      model,
      type,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      cost_dollars: costDollars,
    });
  } catch (error) {
    console.error("Failed to log usage record:", error);
  }
}
