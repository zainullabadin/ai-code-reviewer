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

  constructor(groqApiKey: string, model = 'llama-3.3-70b-versatile') {
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
        temperature: 0.1, // Lower temperature for more focused, consistent reviews
        max_tokens: 4096, // Increased for comprehensive reviews
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: diffSummary,
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
    return `You are a senior software engineer performing a thorough code review. Analyze the provided code changes and identify significant issues only.

**CRITICAL RULES:**
1. Only report REAL, ACTIONABLE issues
2. Each issue must be on a SPECIFIC LINE NUMBER
3. NO duplicate or similar comments
4. NO generic advice without specific line references
5. Be concise and professional - write comments as if talking to a peer

**WHAT TO REVIEW:**

🔴 **ERRORS** (Critical issues that will cause failures):
- Null pointer dereferences, undefined variables
- Logic errors, off-by-one errors, incorrect algorithms
- Security vulnerabilities: SQL injection, XSS, hardcoded credentials in production code
- Resource leaks, infinite loops
- Breaking API changes without migration path
- Race conditions, deadlocks

🟡 **WARNINGS** (Issues that should be fixed but won't break immediately):
- Performance problems: N+1 queries, inefficient algorithms (O(n²) when O(n) possible)
- Missing error handling for critical operations
- SOLID violations: tight coupling, violation of single responsibility
- Missing input validation
- Deprecated API usage
- Inconsistent state management

🔵 **INFO** (Suggestions for improvement):
- Design pattern opportunities (Strategy, Factory, etc.)
- Opportunities to apply SOLID principles
- Better abstractions or separation of concerns
- Potential for code reuse

**IGNORE:**
- console.log, debugging statements
- TODO/FIXME comments
- Naming conventions, code style
- Missing comments or documentation
- Hardcoded test data in test files
- Minor formatting issues

**OUTPUT FORMAT:**
Return valid JSON: {"comments": [{"filename": "path/to/file.ts", "line": 42, "body": "Specific issue description and fix", "severity": "error"}]}

If no significant issues found, return: {"comments": []}

**COMMENT QUALITY:**
✅ Good: "This query runs in O(n²). Consider using a Map for O(n) lookup instead."
✅ Good: "Potential null pointer exception. Add null check before accessing user.profile."
❌ Bad: "Consider refactoring this code."
❌ Bad: "This could be improved."`;
  }

  private buildDiffSummary(diff: IParsedDiff): string {
    const MAX_LINES = 500; // Reduced for better quality with larger model
    const parts: string[] = [];
    let lineCount = 0;

    // Filter and prioritize files
    const files = diff.files
      .filter((f) => f.status !== 'deleted' && !this.shouldSkipFile(f.filename))
      .sort((a, b) => this.getFilePriority(a.filename) - this.getFilePriority(b.filename));

    for (const file of files) {
      const fileLines: string[] = [`### ${file.filename}`];
      
      for (const hunk of file.hunks) {
        const relevantLines: string[] = [];
        
        for (let i = 0; i < hunk.lines.length; i++) {
          const line = hunk.lines[i];
          
          // Include context: 2 lines before and after each added line
          if (line.type === 'added') {
            // Add context before
            for (let j = Math.max(0, i - 2); j < i; j++) {
              const contextLine = hunk.lines[j];
              if (contextLine.type === 'context') {
                relevantLines.push(`  ${contextLine.newLineNumber}: ${contextLine.content}`);
              }
            }
            
            // Add the changed line
            relevantLines.push(`+ ${line.newLineNumber}: ${line.content}`);
            lineCount++;
            
            // Add context after
            for (let j = i + 1; j < Math.min(hunk.lines.length, i + 3); j++) {
              const contextLine = hunk.lines[j];
              if (contextLine.type === 'context') {
                relevantLines.push(`  ${contextLine.newLineNumber}: ${contextLine.content}`);
              }
            }
          }
          
          if (lineCount >= MAX_LINES) break;
        }
        
        if (relevantLines.length > 0) {
          fileLines.push(relevantLines.join('\n'));
        }
        
        if (lineCount >= MAX_LINES) break;
      }
      
      if (fileLines.length > 1) {
        parts.push(fileLines.join('\n'));
      }
      
      if (lineCount >= MAX_LINES) {
        parts.push(`\n[Truncated: Reviewed first ${MAX_LINES} lines. Remaining files skipped for quality.]`);
        break;
      }
    }

    return parts.join('\n\n');
  }

  private shouldSkipFile(filename: string): boolean {
    const skipPatterns = [
      '.test.ts', '.test.js', '.spec.ts', '.spec.js', // Tests
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', // Lock files
      '.min.js', '.bundle.js', '.map', // Minified/generated
      'dist/', 'build/', 'node_modules/', '.next/', // Build outputs
      '.d.ts', // Type definitions
      '.snap', // Snapshots
    ];
    return skipPatterns.some((pattern) => filename.includes(pattern));
  }

  private getFilePriority(filename: string): number {
    // Lower number = higher priority
    if (filename.match(/auth|security|payment|crypto/i)) return 1;
    if (filename.match(/api|service|controller|route/i)) return 2;
    if (filename.match(/model|entity|schema/i)) return 3;
    if (filename.match(/util|helper|config/i)) return 4;
    if (filename.match(/test|spec|mock/i)) return 10;
    return 5;
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
