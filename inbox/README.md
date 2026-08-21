# 📥 Inbox — drop documents here

Anything you commit into this folder is forged automatically by the **Forge on Demand**
GitHub workflow:

1. Drop any formal document here (TXT, MD, or any plain-text document — PDFs and DOCX
   should be converted to text first, or handled in the app).
2. Push to `main`. The workflow installs Ollama on a free GitHub runner, serves the best
   open-weights model that fits (default `qwen2.5:7b-instruct-q4_K_M` — override it from
   the workflow's *Run workflow* dialog), and forges a reply for every new file.
3. The drafted response lands in `outbox/` as `<filename>.response.md`, committed back
   automatically. Already-forged files are skipped on re-runs.

No API keys. No credits. Free compute, every time.

> ⚠️ Documents pushed here become part of the repository history. Keep them
> non-confidential.
