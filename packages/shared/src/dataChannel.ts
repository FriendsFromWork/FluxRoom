import { z } from 'zod';
import { AvatarIdSchema } from './signaling.js';

/**
 * Messages exchanged directly between peers over an RTCDataChannel — never touch
 * the signaling server. Control messages (this schema) are sent as JSON strings;
 * file bytes are sent as separate binary frames encoded via chunk.ts and matched
 * back to a file by the `id` embedded in their own binary header.
 *
 * Each message embeds the sender's name + avatarId directly (rather than requiring
 * a lookup against the peer roster) so the feed can always render correctly even
 * after a sender has left the room.
 */

export const FileMetaSchema = z.object({
  type: z.literal('file-meta'),
  id: z.string(),
  from: z.string(),
  avatarId: AvatarIdSchema,
  name: z.string(),
  size: z.number().nonnegative(),
  mime: z.string(),
  ts: z.number(),
});
export type FileMeta = z.infer<typeof FileMetaSchema>;

export const FileDoneSchema = z.object({
  type: z.literal('file-done'),
  id: z.string(),
  from: z.string(),
  ts: z.number(),
});
export type FileDone = z.infer<typeof FileDoneSchema>;

export const ChatMessageSchema = z.object({
  type: z.literal('chat'),
  id: z.string(),
  from: z.string(),
  avatarId: AvatarIdSchema,
  text: z.string().min(1).max(4000),
  ts: z.number(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Cross-browser-safe upper bound for a single RTCDataChannel string message.
 * Pasted text/code is sent as one JSON message (unlike files, which are
 * chunked), so it must stay comfortably under the smallest common SCTP
 * message-size ceiling across browsers.
 */
export const MAX_PASTE_LENGTH = 60_000;

export const TextMessageSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  from: z.string(),
  avatarId: AvatarIdSchema,
  content: z.string().min(1).max(MAX_PASTE_LENGTH),
  ts: z.number(),
});
export type TextMessage = z.infer<typeof TextMessageSchema>;

export const CodeMessageSchema = z.object({
  type: z.literal('code'),
  id: z.string(),
  from: z.string(),
  avatarId: AvatarIdSchema,
  lang: z.string(),
  content: z.string().min(1).max(MAX_PASTE_LENGTH),
  ts: z.number(),
});
export type CodeMessage = z.infer<typeof CodeMessageSchema>;

export const DataChannelMessageSchema = z.union([
  ChatMessageSchema,
  TextMessageSchema,
  CodeMessageSchema,
  FileMetaSchema,
  FileDoneSchema,
]);
export type DataChannelMessage = z.infer<typeof DataChannelMessageSchema>;

export const CHUNK_SIZE = 64 * 1024; // 64KB per file chunk, safely under SCTP message limits
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 1 * 1024 * 1024; // 1MB backpressure watermark
