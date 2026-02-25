import type { IParsedDiff } from './IParsedDiff';

/**
 * Single-responsibility contract: turn a raw unified diff string
 * into a structured IParsedDiff object.
 * DiffParserService (Phase 2) will implement this.
 */
export interface IDiffParser {
  parse(rawDiff: string): IParsedDiff;
}
