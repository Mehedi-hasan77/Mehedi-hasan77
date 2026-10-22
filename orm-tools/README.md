# ORM Case Desk

A privacy-first, dependency-free, browser-based case intake and reporting-draft tool, published under the Mehedi Hasan portfolio.

## Live site

https://mehedi-hasan77.github.io/Mehedi-hasan77/orm-tools/

## Features

- Four workflows: authorized copyright/DMCA notice draft, Google Business Profile review policy report brief, social media platform report brief, Ads/SEO audit brief.
- Public HTTP(S) URL validation, max 20 URLs, de-duplication, local/reserved host rejection and duplicate-fragment removal.
- Clear ownership/good-faith/accuracy declarations before creating a DMCA notice.
- Context-aware fields and reporting guidance.
- Local in-memory case queue, session metrics, TXT and JSON exports, clipboard copying.
- Client-side 8-drafts/minute rate limit and 20-case memory limit.
- Mobile-responsive, keyboard-accessible UI, inert DOM rendering through textContent.
- No accounts, client-side API keys, tracking, cookies, localStorage, backend, scraping, automated submission, or removal claims.

## Development

Requires Node.js 20+ for tests. No npm dependencies.

From the repository root:

\`\`\`bash
cd orm-tools
npm test
python3 -m http.server 8000
\`\`\`

Open http://localhost:8000/orm-tools/ if serving from the repository root, or http://localhost:8000/ if serving from inside \`orm-tools\`.

The production application is plain HTML/CSS/ES modules and is deployed by GitHub Pages from the \`main\` branch, so there is no build step and no secret or environment variables.

## Security

All user-submitted case data is kept only in JavaScript memory until the user downloads it or closes the page. It is never sent to this website's server; users should safeguard exported JSON and TXT files, which can include personally identifying information.

Validation reduces malformed records and rejects suspicious URLs; browser-only validation and rate limiting are **not** server-side security controls. The tool does not fetch submitted URLs, reducing SSRF exposure. Untrusted content is displayed with \`textContent\`, not injected into HTML markup. A strict CSP should be retained in production.

If adding external API integrations or an authenticated multi-user backend:

1. Build a separate HTTPS backend (e.g., Cloudflare Worker or FastAPI), authenticated accounts, RBAC and audit logging.
2. Move API keys, provider credentials and rate limits to server-side secret storage.
3. Enforce URL allowlisting and network egress/SSRF protections on the backend; do not fetch arbitrary private IP ranges.
4. Obtain explicit user authorization and use official provider APIs/forms within terms and quotas; implement retry/backoff and review queues.
5. Encrypt stored evidence, set retention/deletion policies, and monitor abuse.

## Disclaimer

The tool **does not file complaints or remove content**. It prepares user-reviewed drafts only. The user must verify ownership, good faith, applicable policy and each statement before following the relevant platform's official procedures. Submitting false DMCA notices can have legal consequences. A negative Google review by itself is not a policy violation.

References:
- [Google legal reporting](https://support.google.com/legal/troubleshooter/1114905)
- [Google Business Profile review reporting](https://support.google.com/business/answer/4596773)
- [Google personal-content search removals](https://support.google.com/websearch/contact/content_removal_form)
