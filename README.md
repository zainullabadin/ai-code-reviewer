# 🤖 AI Code Reviewer

> **An intelligent GitHub bot that reviews your pull requests using AI** 

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-black?logo=bun&logoColor=white)](https://bun.sh/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 🎯 What It Does

This bot automatically reviews your pull requests and provides intelligent feedback on:

- 🏗️ **SOLID Principles** — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- 🔒 **Security Vulnerabilities** — SQL injection, XSS, hardcoded secrets, insecure configurations
- ⚡ **Performance Issues** — N+1 queries, O(n²) algorithms, inefficient data structures, memory leaks
- 🎨 **Code Quality** — Design patterns, error handling, naming conventions, code smells
- 📚 **Best Practices** — TypeScript patterns, async/await usage, proper typing

**Smart Features:**
- ✨ **Incremental Reviews** — Only analyzes new commits (saves 80-95% API costs)
- 🎯 **Context-Aware Analysis** — Includes surrounding code for better understanding
- 🚀 **File Prioritization** — Security configs reviewed first, tests skipped
- 🧹 **Semantic Deduplication** — No repetitive comments (60% similarity threshold)
- 🎨 **Clean Formatting** — 🔴 Errors, 🟡 Warnings, 💡 Suggestions

---

## 🏛️ Architecture

Built following **SOLID principles** with a clean layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Webhook                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              ReviewController (HTTP Layer)              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         ReviewOrchestrationService (Business)           │
└─────┬───────────────┬───────────────┬───────────────────┘
      │               │               │
      ▼               ▼               ▼
┌──────────┐   ┌──────────┐   ┌──────────────────┐
│  Diff    │   │ Pipeline │   │  GitHub Notifier │
│  Parser  │   │ Service  │   │     Service      │
└──────────┘   └────┬─────┘   └──────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │ Regex  │  │Heuristic│ │  Groq  │
   │  Rules │  │  Rules  │  │   AI   │
   └────────┘  └────────┘  └────────┘
       └──────── IReviewLayer ────────┘
```

**Key Principles Applied:**
- **S**ingle Responsibility — Each service has one job
- **O**pen/Closed — Add layers without modifying existing code
- **L**iskov Substitution — All review layers are interchangeable
- **I**nterface Segregation — Small, focused interfaces
- **D**ependency Inversion — Depend on abstractions, not concretions

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | [Bun](https://bun.sh/) 1.2 — Fast, modern JavaScript runtime |
| **Framework** | [Express](https://expressjs.com/) 4.21 — Web server |
| **Language** | [TypeScript](https://www.typescriptlang.org/) 5.9 — Type safety |
| **AI Model** | [Groq](https://groq.com/) — llama-3.3-70b-versatile |
| **Validation** | [Zod](https://zod.dev/) 3.24 — Schema validation |
| **HTTP Client** | [Axios](https://axios-http.com/) 1.7 — GitHub API calls |
| **Code Quality** | ESLint + Prettier + Husky — Lint on commit |

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed
- GitHub repository with webhook access
- [Groq API key](https://console.groq.com/)
- [GitHub Personal Access Token](https://github.com/settings/tokens)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-code-reviewer.git
cd ai-code-reviewer

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your credentials:

```env
PORT=3000
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
NODE_ENV=development
```

**GitHub Token Permissions Required:**
- `repo` (full control of private repositories)
- `write:discussion` (to post review comments)

### Running Locally

```bash
# Development mode (auto-reload)
bun run dev

# Production mode
bun start

# Type checking
bun run typecheck

# Lint code
bun run lint

# Format code
bun run format
```

Server runs on `http://localhost:3000`

---

## 🔗 GitHub Webhook Setup

### 1. Configure Webhook in GitHub

Go to **Settings → Webhooks → Add webhook**:

- **Payload URL:** `https://your-domain.com/api/review/webhook`
- **Content type:** `application/json`
- **Secret:** Use the same value as `GITHUB_WEBHOOK_SECRET` in `.env`
- **Events:** Select "Pull requests"
- **Active:** ✅ Checked

### 2. Local Development with Port Forwarding

For testing webhooks locally, use VS Code's port forwarding:

1. Open VS Code → **Ports** tab
2. Forward port `3000`
3. Set visibility to **Public**
4. Use the forwarded URL as your webhook URL

> **Note:** For production, deploy to a proper hosting service with HTTPS.

---

## 📖 How It Works

### 1. **Webhook Trigger**
When a PR is opened or a new commit is pushed, GitHub sends a webhook to your server.

### 2. **Incremental Diff Fetching**
The bot fetches only the diff between the previous commit and the new commit (not the entire PR).

### 3. **Context-Aware Analysis**
Each changed line is analyzed with 2 lines of surrounding context for better understanding.

### 4. **AI Review Pipeline**
The diff is sent to Groq's llama-3.3-70b-versatile model with a comprehensive prompt checking:
- SOLID principles violations
- Security vulnerabilities
- Performance anti-patterns
- Code quality issues

### 5. **Smart Deduplication**
Comments are deduplicated using Jaccard similarity (60% word overlap threshold).

### 6. **GitHub Comment Posting**
Clean, emoji-formatted comments are posted directly to the PR (max 30 comments).

---

## 📊 Example Output

```typescript
// Before: Violation of Single Responsibility Principle
class UserManager {
  saveUser(user: User) { /* ... */ }
  sendEmail(user: User) { /* ... */ }  // ❌ Not related to user management
  logActivity(user: User) { /* ... */ } // ❌ Not related to user management
}
```

**AI Review Comment:**
> 🔴 **SOLID Violation — Single Responsibility Principle**
>
> This class has multiple responsibilities (user management, email sending, logging).
> Consider splitting into separate classes: `UserRepository`, `EmailService`, `ActivityLogger`.
>
> **Suggested refactor:**
> ```typescript
> class UserRepository {
>   saveUser(user: User) { /* ... */ }
> }
>
> class EmailService {
>   sendEmail(user: User) { /* ... */ }
> }
> ```

---

## 🎨 Customization

### Adding Custom Review Rules

Create a new layer implementing `IReviewLayer`:

```typescript
// src/services/layers/CustomRuleLayer.ts
import type { IReviewLayer, IParsedDiff, IReviewComment } from '../../interfaces';

export class CustomRuleLayer implements IReviewLayer {
  readonly name = 'CustomRuleLayer';

  async analyze(diff: IParsedDiff): Promise<IReviewComment[]> {
    const comments: IReviewComment[] = [];
    
    // Your custom logic here
    
    return comments;
  }
}
```

Register in [src/routes/review.routes.ts](src/routes/review.routes.ts):

```typescript
const layers = [
  new CustomRuleLayer(),
  new GroqAILayer(env.groqApiKey, env.groqModel),
];
```

### Adjusting AI Model

Change `GROQ_MODEL` in `.env` to any supported model:
- `llama-3.3-70b-versatile` (recommended)
- `llama-3.1-8b-instant` (faster, less comprehensive)
- `mixtral-8x7b-32768` (alternative)

---

## 📈 Cost Optimization

**Incremental Diff Fetching** saves 80-95% of API costs:

| Scenario | Traditional | Incremental | Savings |
|----------|-------------|-------------|---------|
| 10 commits on 500-line PR | ~5,000 tokens × 10 = 50k | ~500 tokens × 10 = 5k | **90%** |
| Large PR with frequent updates | Full PR every time | Only new changes | **80-95%** |

**File Prioritization** ensures critical files are reviewed first:

1. 🔒 Security configs (`.env`, `auth`, `secrets`)
2. 🌐 API routes
3. 🏗️ Models & Business logic
4. 🛠️ Utilities
5. ⏭️ Tests, locks, build files (skipped)

---

## 🧪 Testing

### Manual PR Review Test

```bash
# Create a test commit
git commit --allow-empty -m "test: trigger AI review"
git push

# Check PR for AI comments
```

### API Endpoint Test

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{"diff": "diff --git a/test.ts b/test.ts\n+console.log(\"test\");"}'
```

---

## 🤝 Contributing

Contributions are welcome! This is a learning project, so feel free to:

- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📖 Improve documentation

**Pre-commit hooks** will automatically format and lint your code.

---

## 📝 License

MIT License — Feel free to use this project for learning or in production.

---

## 🙏 Acknowledgments

- **Groq** — Lightning-fast AI inference
- **GitHub** — Webhook infrastructure
- **Bun** — Blazing fast runtime
- **TypeScript** — Type safety and developer experience

---

## 🌟 Star History

If you found this project helpful for learning SOLID principles or building AI-powered tools, consider giving it a star! ⭐

---

<div align="center">

**Built with ❤️ and SOLID principles**

[Report Bug](https://github.com/yourusername/ai-code-reviewer/issues) · [Request Feature](https://github.com/yourusername/ai-code-reviewer/issues) · [Documentation](https://github.com/yourusername/ai-code-reviewer/wiki)

</div>
