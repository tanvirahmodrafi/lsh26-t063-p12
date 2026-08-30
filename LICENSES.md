# Third-Party Material and AI Disclosure

No third-party framework, runtime library, starter, UI kit, icon set or web font is bundled with the application. The frontend is handwritten vanilla HTML, CSS and JavaScript and the serverless functions use the Node.js runtime and native `fetch`.

| Name | Version or source URL | Licence / terms | Used for |
|---|---|---|---|
| LofiStack Hackathon P12 public fixture | Organizer-provided `P12_personal_ledger_public.json`, schema 2.1 | Organizer-provided event material | Published sample cases available through the Demo case selector |
| LofiStack Hackathon Submission Kit | Organizer-provided v2.2 templates | Organizer-provided event material | Structure and required fields for README, event record, licence disclosure and evaluation manifest |
| Punji logo and favicon | Team-created with ChatGPT image generation during the event | Team original | Product identity in `assets/logo.png` and `assets/favicon.png` |
| Punji background | Team-created/generated during the event | Team original | Application backdrop in `assets/bg.jpg` |
| Unicode emoji and symbols | Rendered by the user's operating system | Platform-provided glyphs; no icon files shipped | Category and interface indicators |
| System font stack | `system-ui`, `-apple-system`, `Segoe UI`, sans-serif | Platform-provided fonts; no font files shipped | Application typography |
| Vercel | <https://vercel.com/legal/terms> | Vercel platform terms | Hosting and Node.js serverless runtime; no Vercel library is bundled |
| Neon | <https://neon.com/terms-of-service> | Neon platform terms | Postgres persistence through the HTTP SQL API; no database driver is bundled |
| OpenRouter | <https://openrouter.ai/terms> | OpenRouter and model-provider terms | Runtime access to receipt-reading vision models; no SDK is bundled |

## AI tools

| Tool | Used for | How output was verified |
|---|---|---|
| Claude Code (Anthropic) | Implementation, refactoring and documentation assistance | Team review against P12 rules, JavaScript syntax checks, source diffs and browser workflow testing |
| OpenAI ChatGPT / Codex | Logo/favicon generation, implementation audit, safety and accessibility fixes, and submission documentation | Team review, `node --check`, `git diff --check`, deterministic calculation checks and automated browser regression testing |
| OpenRouter vision models (Google Gemini 2.5 Flash Lite / Flash) | Receipt shop/date/amount/category extraction at application runtime | Raw detected fields are displayed and remain editable before saving; success, partial-read and failed-read behavior was tested |

## Original-work statement

Everything not declared in this file or `EVENT.md` was created by the registered team during the event window.
