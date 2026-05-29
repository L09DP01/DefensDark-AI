<p align="center">
  <img src="public/logo.png" width="150" alt="DefensDark AI Logo">
</p>

<h1 align="center">DefensDark AI</h1>

<h2 align="center">Your AI-Powered Cyber Defense Platform</h2>

## Getting started

### Prerequisites

You'll need the following accounts:

**Required:**

- [OpenRouter](https://openrouter.ai/) - AI model provider
- [OpenAI](https://platform.openai.com/) - Content moderation
- [E2B](https://e2b.dev/) - Sandbox environment for secure code execution in agent mode
- [Convex](https://www.convex.dev/) - Database and backend
- [WorkOS](https://workos.com/) - Authentication and user management
- [Trigger.dev](https://trigger.dev/) - Required durable runtime for agent tasks

**Optional:**

- [Amazon S3](https://aws.amazon.com/s3/) - File storage
- [Perplexity](https://perplexity.ai/) - Web search functionality
- [Jina AI](https://jina.ai/reader) - Web URL content retrieval
- [Redis](https://redis.io/) - Stream resumption
- [Upstash Redis](https://upstash.com/) - Rate limiting
- [PostHog](https://posthog.com/) - Analytics
- [Stripe](https://stripe.com/) - Payment processing

### Install dependencies

```bash
pnpm install
```

### Start the development server

```bash
pnpm run dev
```

### Run the Trigger.dev worker

```bash
npx trigger.dev@latest dev
```
