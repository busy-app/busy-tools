---
"@busy-app/create-app": minor
---

The generator:

- Adopt `@clack/prompts` for interactive terminal prompts (`intro`, `text`, `spinner`, `note`, `outro`), with consistent formatting for options passed via flags or non-interactive (piped) input.
- Install the app with the package manager that launched the generator (`npm create`, `pnpm create`, `yarn create`, `bun create`) instead of always pnpm, falling back to npm when run in any other way.
- Format the generated README, the `Next steps` hint, and CI workflows for the selected package manager.
- For Yarn, add `.yarnrc.yml` with `nodeLinker: node-modules` and an empty `yarn.lock`; for Yarn 2+, include the `packageManager` field in `package.json`.
- Add a `create-app` binary (expected by `yarn create @busy-app/app` on Yarn 1) while keeping `busy-create-app`.
- Run dependency installation under a spinner, suppressing output unless installation fails.

The template:

- Drop the `build/tgz` script from `package.json`, as `busy-cli build` now packs `<id>.tgz` by default.
- Update the template README, quickstart instructions, and GitHub release workflow to use `build` directly.
- Update `@busy-app/cli` to `^0.6.0`.
