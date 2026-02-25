# AI Code Review Bot — Copilot Workspace Instructions

## Project summary
Learning project to practice **SOLID principles** using an AI-powered code review bot.
Stack: **Bun · Express · TypeScript · Zod · Groq SDK · Axios**. No database (v1).
Location: `E:\ai-code-reviewer` (standalone repo, not inside any other project).

---

## Architecture

```
GitHub Webhook → Route → Controller → ReviewOrchestrationService
                                              │
                  ┌───────────────────────────┼─────────────────────┐
                  │                           │                     │
           DiffParserService     ReviewPipelineService    GitHubNotifierService
                                         │
                  ┌──────────────────────┼────────────────────┐
                  │                     │                     │
           RegexRuleLayer     HeuristicRuleLayer    GroqAILayer
           (IReviewLayer)      (IReviewLayer)      (IReviewLayer)
```

Layered: Routes → Controllers → Services (no repository layer — no DB).
Dependency injection via constructors. Composition root is `src/routes/review.routes.ts`.

---

## Core interfaces (`src/interfaces/`)

```ts
interface IReviewLayer {
  readonly name: string;
  analyze(diff: IParsedDiff): Promise<IReviewComment[]>;
}

interface IVCSNotifier {
  postReview(prContext: IPRContext, comments: IReviewComment[]): Promise<void>;
}

interface IReviewPipeline {
  run(diff: IParsedDiff): Promise<IReviewComment[]>;
}

interface IDiffParser {
  parse(rawDiff: string): IParsedDiff;
}
```

All interfaces are re-exported from `src/interfaces/index.ts` — always import from there.

---

## SOLID mapping

| Principle | Where |
|---|---|
| **S** | `DiffParserService` parses only. `GroqAILayer` calls AI only. `GitHubNotifierService` posts only. |
| **O** | New rule layer = new file implementing `IReviewLayer`, zero edits to existing code. |
| **L** | `RegexRuleLayer`, `HeuristicRuleLayer`, `GroqAILayer` fully interchangeable via `IReviewLayer`. |
| **I** | `IVCSNotifier` is separate from `IReviewLayer` — layers have zero knowledge of GitHub. |
| **D** | `ReviewOrchestrationService` receives `IDiffParser`, `IReviewLayer[]`, `IVCSNotifier` via constructor. |

---

## Build phases

| Phase | Status | Scope |
|---|---|---|
| **1** | ✅ Complete | Scaffold + all interfaces + zero implementations |
| **2** | 🔲 Next | `DiffParserService`, `RegexRuleLayer`, `HeuristicRuleLayer`, `ReviewPipelineService`. Test via `POST /api/review` with a raw diff string — no AI, no GitHub. |
| **3** | 🔲 Pending | GitHub webhook handler, `DiffFetcherService` (GitHub API via Axios), `GitHubNotifierService`. |
| **4** | 🔲 Pending | `GroqAILayer` implements `IReviewLayer` — plug into pipeline, prove OCP + DIP. |

---

## Planned review rules

### RegexRuleLayer (Phase 2)
- No `console.log` / `console.debug` in added lines
- No `TODO` / `FIXME` / `HACK` / `XXX` comments
- No hardcoded secrets (`password=`, `api_key=`, `secret=` patterns)
- No `debugger` statements

### HeuristicRuleLayer (Phase 2)
- Functions exceeding 50 lines
- Files with high churn (additions + deletions > threshold)
- Deeply nested blocks (indentation depth heuristic)
- Large single commits (total additions > threshold)

---

## Key conventions

- **Arrow functions** for controller methods to preserve `this` context
- **`asyncHandler` wrapper** for all async route handlers (no try/catch in controllers)
- **`APIError` class** for business-logic errors (`src/errors/APIError.ts`)
- **Zod schemas** validate all request bodies (`src/schemas/`)
- **DTOs** transform service output to HTTP response shape (`src/dtos/`)
- `noUnusedLocals / noUnusedParameters` are `false` in `tsconfig.json` during Phase 1 stubs — flip both to `true` in Phase 2 once implementations exist

---

## Environment variables (`.env`)

```
PORT=3000
GROQ_API_KEY=           # from console.groq.com
GITHUB_TOKEN=           # GitHub Personal Access Token
GITHUB_WEBHOOK_SECRET=  # secret used to verify webhook signatures
NODE_ENV=development
```

---

## Dev commands

```bash
bun run dev          # hot-reload via bun --watch
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier --write
```

Health check: `GET http://localhost:3000/health`
Phase 2 test endpoint: `POST http://localhost:3000/api/review` — body `{ "diff": "<raw diff string>" }`
