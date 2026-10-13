# {{appName}}

{{description}}

A JavaScript app for the BUSY Bar, generated from the BUSY JS app template.

## Getting started

```sh
pnpm install
pnpm build
```

The app's id is `{{appId}}`, set in `src/appmeta/manifest.json`. An id is `<namespace>.<app>`, at most 32 characters, made of letters, digits, dot and underscore. If yours still says `app.example`, change it to your own namespace before publishing.

## Layout

`src/` is the app — everything in it is yours to edit.

The entry point is `src/main.ts` (or `src/main.js`). The name is fixed: the build turns it into `scripts/main.js`, the one file the BUSY Bar starts.

`src/main.ts` is run from top to bottom, not imported: it starts the app by calling `main()` at its end and must not export anything. The modules it imports export as usual.

```
my-app/
├── src/                          the app
│   ├── main.ts                   the entry point: function main(), called at the end
│   ├── appmeta/
│   │   ├── manifest.json         id, name, version
│   │   ├── settings.json         the settings screen — optional
│   │   ├── icon_front_8x8.png    front icon, 8×8 colour — optional
│   │   └── icon_back_11x11.png   back icon, 11×11 greyscale — optional
│   ├── images/
│   ├── animations/
│   └── sounds/
├── shared/                       app-level helpers, imported as @shared/*
```

Both icons are optional; without them a default is used.

## Resources

Anything in `src/` that isn't a source file is copied into the package. Files in `src/images`, `src/animations` and `src/sounds` keep their folder; everything else is sorted by extension into the same three, and whatever has no match lands in `resources/`.

| Extension | Goes to |
| --- | --- |
| `.png` `.jpg` `.jpeg` `.gif` `.bmp` `.webp` `.svg` `.image` `.ico` | `images/` |
| `.anim` `.animation` | `animations/` |
| `.wav` `.snd` `.sng` `.mp3` `.ogg` `.rtttl` | `sounds/` |
| anything else | `resources/` |

A file whose extension disagrees with the folder it sits in is still placed by the folder, with a warning.

Everything the app draws goes through the layout helpers in `@busy-app/busy-lib`: build a tree out of `row` / `column` / `stack`, hand it to `render()`, and send the result with `device.DisplayDraw()`. The screen is 72×16 pixels.

## Input

`listen("input", handler)` delivers the device keys: `ok`, `start` and `back` with a `press` / `release` action, and `encoder` with a `delta` of `1` or `-1`. It returns an unbind function.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm build` | builds the package into `dist/` |
| `pnpm build --out <path>` | builds into `<path>` instead |
| `pnpm build --tgz` | also packs the package into a `.tgz` beside it |
| `pnpm build --tgz-only` | packs the `.tgz` and leaves nothing else |
| `pnpm build --tgz --tgz-name <name>` | names the `.tgz`, e.g. `"{id}-{version}.tgz"` |
| `pnpm build --no-minify` | readable output, for debugging |
| `pnpm build --bundle` | inlines every module into one `main.js` |
| `pnpm build --addr <host>` | sets the BUSY Bar address the app connects to, `localhost` by default |
| `pnpm typecheck` | type-checks the app |
| `pnpm app:install` | installs `dist/{{appId}}.tgz` on the BUSY Bar; build it first with `pnpm build --tgz` |
| `pnpm app:uninstall` | removes the app from the BUSY Bar, keeping its settings |
| `pnpm app:run` | launches the installed app |
| `pnpm app:stop` | quits the running app |

The four `app:` commands talk to the BUSY Bar connected over USB. For one on Wi-Fi add `--addr <host>`, and `--password <password>` if it is protected: `pnpm app:install --addr 192.168.1.50`.

## Build output

The package folder is named after the app id:

```
dist/
└── {{appId}}/
    ├── appmeta/manifest.json
    ├── scripts/main.js
    └── images/ animations/ sounds/ resources/
```

`--tgz` packs that folder into `dist/{{appId}}.tgz`, with the folder itself at the root of the archive. `--tgz-name` gives the archive another name; `{id}` and `{version}` in it are filled in from the manifest.

## Releasing

Pushing a tag equal to the manifest `version`, e.g. `0.1.0`, builds the app and attaches `{{appId}}-<version>.tgz` to a GitHub release. The release notes open with the app's name, id, version and API version. The release fails when the tag differs from the manifest `version`.

## Manifest

`src/appmeta/manifest.json` carries the app's identity and a couple of knobs:

| Field | |
| --- | --- |
| `format_version` | manifest format, `1` — required |
| `id` | up to 32 characters — required |
| `name` | display name — required |
| `version` | semver, e.g. `1.0.0` — required |
| `api_version` | minimum BUSY Bar HTTP API version the app needs, e.g. `27.12.0` — required |
| `description`, `author` | free form, default `""` |
| `heap_size_kib` | memory for the app heap, 1–256, default 32 |
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
