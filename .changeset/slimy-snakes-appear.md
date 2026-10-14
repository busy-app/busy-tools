---
"@busy-app/create-app": minor
---

The generator:

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
