---
"@busy-app/cli": minor
---

Breaking changes:

- Replace `--tgz` and `--tgz-only` with `--emit <tgz|dir|both>`. By default (`--emit tgz`), `busy-cli build` now packs the app into `<id>.tgz` and leaves no intermediate folder. `--emit dir` leaves the `<id>/` directory instead, and `--emit both` keeps both.

New features and improvements:

- `busy-cli create`: run `<pm> create @busy-app/app` using the package manager specified via `--package-manager <npm|pnpm|yarn|bun>`. When omitted in an interactive terminal, prompt for the package manager using an arrow-key menu (with pnpm preselected).
- `busy-cli app`: display progress for each step (`install`, `run`, `stop`, `uninstall`) under an interactive spinner with file size and elapsed time.
- Clean error reporting: failed requests to the BUSY Bar now provide clear error messages with HTTP status, cause chain, and endpoint-specific explanations instead of a bare "terminated". Non-JSON server responses display their first characters, and failed builds display Vite/Rolldown errors directly without raw stack traces.
- Context-aware command hints: when run from a `package.json` script (where `busy-cli` is in `node_modules/.bin`), error hints suggest runnable project commands (such as `pnpm build`, `npm run build`, or `pnpm exec busy-cli build`) instead of bare `busy-cli build`.
- Terminal output formatting: adopt `@clack/prompts` styling across all CLI commands.
