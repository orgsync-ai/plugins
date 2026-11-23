/** Masks credential shapes and Luhn-valid card numbers with `[secret]`. @param {string} text */
export function maskSecrets(text: string): string;
/** A turn's own words, with injected blocks and secrets removed. @param {string} text */
export function turnText(text: string): string;
/** @typedef {{ role?: unknown, text?: unknown, toolUses?: unknown, toolResults?: unknown }} SessionMessage */
/**
 * The Claude Code mod's `$.session.messages()` entries as an extractor may read them: each person and assistant turn's text, tool
 * names only. `toolUses` inputs and results and every `toolResults` entry are never read.
 * @param {readonly SessionMessage[]} messages @returns {{ text: string, turns: number }}
 */
export function redactMessages(messages: readonly SessionMessage[]): {
    text: string;
    turns: number;
};
/**
 * A Claude Code session file (JSONL) from a byte offset: person and assistant text blocks only. Tool results, thinking, images,
 * documents, attachments, `toolUseResult`, `mcpMeta` and every `_meta` are never read, nor are meta, compaction and subagent turns.
 * @param {string} text @param {number} [fromOffset] @returns {Redacted}
 */
export function redactClaudeCodeJsonl(text: string, fromOffset?: number): Redacted;
/**
 * A Codex rollout file (JSONL) from a byte offset: `response_item` messages of the person (`input_text`) and the assistant
 * (`output_text`) only. Reasoning, function and tool calls and their outputs, event messages, environment context and
 * instructions are never read; a call's name may stay.
 * @param {string} text @param {number} [fromOffset] @returns {Redacted}
 */
export function redactCodexJsonl(text: string, fromOffset?: number): Redacted;
export type SessionMessage = {
    role?: unknown;
    text?: unknown;
    toolUses?: unknown;
    toolResults?: unknown;
};
export type Redacted = {
    text: string;
    format: string;
    nextOffset: number;
} | {
    text: null;
    format: null;
};
