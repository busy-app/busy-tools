# @busy-app/create-app

## 0.5.0

### Minor Changes

- c099dee: The template:

  - Add `AGENTS.md` with instructions for AI coding agents.
  - Quit the app on a `short` press of `back` instead of `press`, the default action for a tap.
  - Add the `short`, `long` and `repeat` input actions to the types in `types/env.d.ts` and document them in the README.
  - Correct the `heap_size_kib` range in the README to 1–512 KiB with a default of 128 KiB, and link the firmware apps documentation.

## 0.4.0

### Minor Changes

- 4553af8: The generator:

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

## 0.3.0

### Minor Changes

- ea59005: The generator:

  - Allow dashes in app IDs, matching the firmware rules: Latin letters, digits, underscores, dashes and dots, at most 32 characters, not starting with a dot.
  - Keep dashes in folder names and turn whitespace into underscores when suggesting an app ID (`"My-App 2"` by "Jane Doe" → `app.jane_doe.my-app_2`).
  - Fall back to a placeholder (`app` or `example`) for a folder or author name with characters the firmware rejects, keeping the valid segment.
  - Add `-v, --version`, and show the package version in `--help` and above the banner.

  The template:

  - Add a `build/tgz` script (`busy-cli build --tgz`) to build and pack the package into a `.tgz` archive in one step.
  - Update `@busy-app/cli` to `^0.5.0`.

## 0.2.0

### Minor Changes

- a730049: The generator:

  - Asks for the author first, and makes the default id `app.<author>.<folder>`.
  - Asks for the minimum BUSY Bar API version, also given with `--api-version`; `27.12.0` by default.
  - Runs `pnpm install` after scaffolding; `--no-install` skips it.

  The template:

  - `src/main.ts` starts the app with a `main()` call at the end and exports nothing.
  - The manifest has `api_version`. `heap_size_kib` and `debug` are gone, so the firmware defaults apply.
  - No `.env`: the BUSY Bar address comes from `busy-cli build --addr`, as `__BUSY_ADDR__`.
  - `app:install`, `app:uninstall`, `app:run` and `app:stop` scripts.
  - The release workflow attaches `<id>-<version>.tgz` and opens the release notes with the app's name, id, version and API version. The tag still equals `version`.
  - One `tsconfig.json`, and `env.d.ts` moved to `types/`.
  - `@busy-app/busy-lib` ^0.21.1, `@busy-app/cli` ^0.4.0, TypeScript ~6.0.3.

## 0.1.3

### Patch Changes

- 7a1112b: Leave the app on the back key in the template, and declare `listen()` and its input events in `env.d.ts`

## 0.1.2

### Patch Changes

- 442a484: Reject a dash in the app id; a dashed folder name becomes an underscore

## 0.1.1

### Patch Changes

- 6ea9264: Pin @busy-app/cli to ^0.2.0 in the template
