/**
 * Transcript JSONL files contain prompt text and tool payloads.
 * Phase 1 does not read transcripts:
 * - official docs warn they can lag the in-memory conversation
 * - they include content we refuse to store by default
 * - live quota is not documented on transcript records
 */
export const TRANSCRIPT_INGEST_ENABLED = false;
