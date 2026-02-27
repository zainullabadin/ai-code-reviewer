import Groq from 'groq-sdk';
import type { IReviewLayer, IParsedDiff, IReviewComment, ReviewSeverity } from '../../interfaces';

/**
 * L — Liskov Substitution: fully interchangeable with RegexRuleLayer / HeuristicRuleLayer.
 * O — Open/Closed: plugged into ReviewPipelineService without any changes to existing code.
 * D — Dependency Inversion: ReviewPipelineService only sees IReviewLayer — it has no idea
 *     this layer calls an external AI API.
 *
 * Sends the parsed diff to the Groq API (llama model) and parses the JSON
 * response into IReviewComment[].
 */
export class GroqAILayer implements IReviewLayer {
  readonly name = 'GroqAILayer';
  private readonly client: Groq;
  private readonly model: string;

  constructor(groqApiKey: string, model = 'llama-3.1-8b-instant') {
    this.client = new Groq({ apiKey: groqApiKey });
    this.model = model;
  }

  async analyze(diff: IParsedDiff): Promise<IReviewComment[]> {
    // Build a concise representation of the diff for the AI
    const diffSummary = this.buildDiffSummary(diff);

    if (!diffSummary.trim()) return [];

    try {
      const chatCompletion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: `Review the following code diff and provide feedback:\n\n${diffSummary}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) return [];

      return this.parseAIResponse(content, diff);
    } catch (err) {
      console.error('[GroqAILayer] API call failed:', err);
      return []; // graceful degradation — never throw from a layer
    }
  }

  // ---- private helpers ---------------------------------------------------

  private getSystemPrompt(): string {
    return `You are an expert code reviewer focused on finding FUNCTIONAL problems, not style issues.

Analyze the code diff and return a JSON object with a "comments" array.

Each comment must have:
- "filename": string (file path)
- "line": number (line number)
- "body": string (concise, actionable feedback)
- "severity": "info" | "warning" | "error"

FOCUS ON:
- Bugs and logic errors (off-by-one, null pointer, race conditions)
- Security vulnerabilities (SQL injection, XSS, insecure crypto)
- Performance issues (N+1 queries, unnecessary loops, memory leaks)
- Correctness issues (wrong algorithm, broken edge cases)

IGNORE:
- console.log statements
- Hardcoded strings/secrets
- TODO/FIXME comments
- Naming conventions
- Code style
- Missing comments

Return {"comments": []} if you find no functional issues.
Respond ONLY with valid JSON, no markdown.`;
  }

  private buildDiffSummary(diff: IParsedDiff): string {
    const parts: string[] = [];

    for (const file of diff.files) {
      if (file.status === 'deleted') continue; // skip deleted files

      const addedLines = file.hunks
        .flatMap((h) => h.lines)
        .filter((l) => l.type === 'added')
        .map((l) => `+${l.newLineNumber}: ${l.content}`)
        .join('\n');

      if (addedLines) {
        parts.push(`--- File: ${file.filename} ---\n${addedLines}`);
      }
    }

    return parts.join('\n\n');
  }

  private parseAIResponse(content: string, diff: IParsedDiff): IReviewComment[] {
    try {
      const parsed = JSON.parse(content) as {
        comments?: Array<{
          filename?: string;
          line?: number;
          body?: string;
          severity?: string;
        }>;
      };

      if (!Array.isArray(parsed.comments)) return [];

      // Collect valid filenames from the diff for validation
      const validFiles = new Set(diff.files.map((f) => f.filename));

      return parsed.comments
        .filter(
          (c) =>
            c.filename &&
            c.line &&
            c.body &&
            validFiles.has(c.filename),
        )
        .map((c) => ({
          filename: c.filename!,
          line: c.line!,
          body: c.body!,
          severity: this.normalizeSeverity(c.severity),
          source: this.name,
        }));
    } catch {
      console.error('[GroqAILayer] Failed to parse AI response');
      return [];
    }
  }

  private normalizeSeverity(severity?: string): ReviewSeverity {
    if (severity === 'error' || severity === 'warning' || severity === 'info') {
      return severity;
    }
    return 'info';
  }
}
