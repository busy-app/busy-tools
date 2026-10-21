# {{appName}}

{{description}}

A JavaScript app for the BUSY Bar, generated from the BUSY JS app template.

## Getting started

```sh
{{pm}} install
{{run}} build         # build the app into dist/{{appId}}.tgz
{{run}} app:install   # install it on the BUSY Bar connected over USB
{{run}} app:run       # launch the installed app
```

The app's id is `{{appId}}`, set in `src/appmeta/manifest.json`. An id is `<namespace>.<app>`, at most 32 characters, made of Latin letters, digits, underscores, dashes, and dots, and not starting with a dot. If yours still says `app.example`, change it to your own namespace before publishing.

## Layout

`src/` is the app — everything in it is yours to edit.

The entry point is `src/main.ts` (or `src/main.js`). The name is fixed: the build turns it into `scripts/main.js`, the file the BUSY Bar starts. Any imported modules are emitted as separate files alongside it in `scripts/`, unless `{{run}} build{{argsSep}} --bundle` inlines them.

`src/main.ts` is run from top to bottom, not imported: it starts the app by calling `main()` at the end and must not export anything. Imported modules can use standard exports.

```
my-app/
├── src/                          the app
│   ├── main.ts                   the entry point: function main(), called at the end
│   ├── appmeta/
│   │   ├── manifest.json         id, name, version
│   │   ├── settings.json         the settings screen — optional
│   │   ├── icon_front_8x8.png    front icon, 8×8 color — optional
│   │   └── icon_back_11x11.png   back icon, 11×11 grayscale — optional
│   ├── images/
│   ├── animations/
│   └── sounds/
├── shared/                       app-level helpers, imported as @shared/*
```

Both icons are optional; without them a default is used.

## Resources

Anything in `src/` that isn't a source file is copied into the package, sorted by what the BUSY Bar can read:

| Extension | Destination |
| --- | --- |
| `.png` `.image` | `images/` |
| `.anim` | `animations/` |
| `.snd` | `sounds/` |
| anything else | `resources/` |

A file in `src/images`, `src/animations` or `src/sounds` keeps its folder as long as the BUSY Bar reads its format.

`images/`, `animations/` and `sounds/` hold only those formats. An image, animation or sound in another format — `.jpg`, `.gif`, `.svg`, `.wav`, `.mp3` and the like — goes to `resources/`, and the build warns that the device cannot read it.

Everything the app draws goes through the layout helpers in `@busy-app/busy-lib`: build a tree out of `row` / `column` / `stack`, hand it to `render()`, and send the result with `device.DisplayDraw()`. The screen is 72×16 pixels.

## Input

`listen("input", handler)` delivers the device keys: `ok`, `start` and `back` with a `press` / `release` / `short` / `long` / `repeat` action, and `encoder` with a `delta` of `1` or `-1`. It returns an unbind function.

## Commands

| Command | Description |
| --- | --- |
| `{{run}} build` | empties `dist/` and builds the package into `dist/{{appId}}.tgz` |
| `{{run}} build{{argsSep}} --emit dir` | leaves the `{{appId}}/` folder instead of the `.tgz` |
| `{{run}} build{{argsSep}} --emit both` | leaves the folder and the `.tgz` |
| `{{run}} build{{argsSep}} --out <path>` | builds into `<path>` instead, replacing only this app's package there |
| `{{run}} build{{argsSep}} --tgz-name <name>` | names the `.tgz`, e.g. `"{id}-{version}.tgz"` |
| `{{run}} build{{argsSep}} --no-minify` | readable output, for debugging |
| `{{run}} build{{argsSep}} --bundle` | inlines every module into one `main.js` |
| `{{run}} build{{argsSep}} --addr <host>` | sets the BUSY Bar address the app connects to, `localhost` by default |
| `{{run}} typecheck` | type-checks the app |
| `{{run}} app:install` | installs `dist/{{appId}}.tgz` on the BUSY Bar; build it first with `{{run}} build` |
| `{{run}} app:uninstall` | removes the app from the BUSY Bar, keeping its settings |
| `{{run}} app:run` | launches the installed app |
| `{{run}} app:stop` | quits the running app |

The four `app:` commands talk to the BUSY Bar connected over USB. For a device connected over Wi-Fi, pass `--addr <host>` with its network IP address or hostname, and `--password <password>` if password protection is enabled:

```sh
{{run}} app:install{{argsSep}} --addr <host>
{{run}} app:install{{argsSep}} --addr <host> --password <password>
```

## Build output

The package folder is named after the app id:

```
dist/
└── {{appId}}/
    ├── appmeta/manifest.json
    ├── scripts/main.js
    └── images/ animations/ sounds/ resources/
```

By default the build packs that folder into `dist/{{appId}}.tgz`, with the folder itself at the root of the archive, and removes the folder; `--emit dir` keeps only the folder, `--emit both` keeps both. `--tgz-name` gives the archive another name; `{id}` and `{version}` in it are replaced with the manifest values.

## Releasing

Pushing a git tag matching the manifest `version` (e.g. `0.1.0`) builds the app and attaches `{{appId}}-<version>.tgz` to a GitHub release. The release notes open with the app's name, id, version and API version. The release fails when the tag differs from the manifest `version`.

## Manifest

`src/appmeta/manifest.json` carries the app's identity and a couple of knobs:

| Field | Description |
| --- | --- |
| `format_version` | manifest format, `1` — required |
| `id` | up to 32 characters — required |
| `name` | display name — required |
| `version` | semver, e.g. `1.0.0` — required |
| `api_version` | minimum BUSY Bar HTTP API version the app needs, e.g. `27.12.0` — required |
| `description`, `author` | free form, default `""` |
| `heap_size_kib` | memory for the app heap, 1–512, default 128 |
| `debug` | when true, shown only in developer mode, default false |

Raise `heap_size_kib` if the app runs out of memory.

## Node version

The app builds on Node 24 — the version in `.nvmrc` and the range `engines` allows. Node 26 breaks the build and is excluded. With `fnm` or `nvm` installed, `fnm use` / `nvm use` picks the right one up from `.nvmrc`.

## Settings

To give the app a settings screen, add `src/appmeta/settings.json` describing the fields, then read the stored values:

```ts
import { loadValues } from "@shared/settings";

const values = await loadValues();
```

`loadValues()` returns `null` when nothing is stored yet — use the defaults.
