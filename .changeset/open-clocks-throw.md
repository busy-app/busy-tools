---
"@busy-app/cli": minor
---

Breaking changes:

- The entry file must not export anything: it starts the app with its own `main()` call at the end. A default export is no longer turned into a call, and fails the build.
- `appmeta/manifest.json` must have `api_version`, the minimum BUSY Bar HTTP API version the app needs, as `x.y.z`.
- `images/`, `animations/` and `sounds/` accept only the formats the BUSY Bar reads: `.png`, `.image`, `.anim`, `.snd`. Any other image, animation or sound goes to `resources/`, with a warning.
- `build` empties `dist/` before building. With `--out`, only the app's own package is replaced.

New:

- Apps without `src/`: `appmeta/` and `main.js` can sit directly in the project folder.
- `build --addr <host>` sets the BUSY Bar address the app connects to, `localhost` by default.
- `build --tgz-name <name>` names the archive, with `{id}` and `{version}` taken from the manifest.
- `app install`, `uninstall` and `run` work without a file or id when run from an app folder.
- `busy-cli create --help` lists `--api-version`, `--no-git` and `--no-install`.
- A README for the package.
