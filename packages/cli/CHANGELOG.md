# @busy-app/cli

## 0.5.0

### Minor Changes

- 14b72ad: - Support entry points in `scripts/`: `scripts/main.ts` or `scripts/main.js`, matching the layout of the package on the device. Modules beside the entry are emitted without a `scripts-` prefix. More than one entry point is now an error.
  - Validate `manifest.id` the way the firmware does: Latin letters, digits, underscores, dashes and dots, at most 32 characters, not starting with a dot.
  - Add `-v, --version`, show the package version in `--help`, and print it before running `busy-cli create`.

## 0.4.0

### Minor Changes

- 7b944ae: Breaking changes:

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

## 0.3.0

### Minor Changes

- d097973: Add the app command: install, run, stop and uninstall apps on a connected BUSY Bar, over USB or Wi-Fi

  Colors are now off when the output is not a terminal or NO_COLOR is set

## 0.2.1

### Patch Changes

- fc1cb93: Claim #font-maps before Vite resolves it, so an app bundles the glyph maps it draws with

## 0.2.0

### Minor Changes

- 0979ab6: Add the create command, scaffolding an app through @busy-app/create-app

## 0.1.1

### Patch Changes

- dd47641: Fix `--tgz-only` producing neither the archive nor the folder removal.
