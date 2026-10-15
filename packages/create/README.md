# @busy-app/create-app

Scaffolds a JavaScript app for the BUSY Bar. One app, one repository.

```sh
pnpm create @busy-app/app my-app
```

The generator asks for the app's author, id, display name, description and minimum API version, writes the template with those filled in, then runs `git init` and `pnpm install` unless told not to.

Every prompt has a flag:

```sh
busy-create-app my-app --author "Jane Doe" --id app.jane_doe.my_app --name "My App" --description "..." --api-version 27.12.0
```

Any omitted option will be prompted interactively. `--help` lists the flags.

`--no-git` skips initializing a git repository, for scaffolding into a workspace that already has one. `--no-install` skips installing dependencies. A failed install does not remove the scaffolded app: the generator reports the error and leaves `pnpm install` to you.

### App IDs

An id is `<namespace>.<app>`, at most 32 characters, made of Latin letters, digits, underscores, dashes, and dots, and not starting with a dot. The default id is made from the author's name and the folder name, lowercased, with spaces turned into underscores: "Jane Doe" and `my-app` give `app.jane_doe.my-app`. An author's name the id cannot take — one with other characters, or one too long to fit — falls back to `app.example`, a placeholder to replace with your own namespace before publishing; a folder name the id cannot take falls back to `app`.

## What you get

```
my-app/
├── src/                     the app
│   ├── main.ts              the entry point: function main(), called at the end
│   └── appmeta/
│       └── manifest.json    id, name, version, api_version
├── shared/                  app-level helpers, imported as @shared/*
├── types/env.d.ts           globals the device and the build provide
├── .github/workflows/       CI, and a release on every version tag
├── package.json
├── tsconfig.json
├── .nvmrc
└── README.md
```

Resources go into `src/images/`, `src/animations/` and `src/sounds/`, created as the app needs them.

`src/` is the app, and the build scans only this folder. Its entry point has to be `src/main.ts` or `src/main.js`: the build emits it as `scripts/main.js`, the file the firmware starts, with the modules it imports alongside it. `shared/` holds the helpers an app needs but a library cannot provide: the device client, the settings reader and a few date wrappers.

Layout, fonts and XPM2 come from `@busy-app/busy-lib`; the build itself from `@busy-app/cli`.

`pnpm build` empties `dist/` and produces the package in `dist/<id>/`, named after the manifest id; `--out <path>` puts it elsewhere, and `--tgz` packs it into `<id>.tgz` alongside, or under the name given with `--tgz-name`. `pnpm app:install`, `app:uninstall`, `app:run` and `app:stop` manage the app on a connected BUSY Bar. The generated app's README covers both topics, and [`@busy-app/cli`](../cli) has the details.

## Working on the generator

```
src/index.ts    the prompts and the copy
template/       exactly what a generated app looks like
test/e2e.mjs    packs, scaffolds, installs, type-checks and builds (node:test)
```

Two conventions in `template/` work around npm, which strips `.gitignore` from packages and misreads a nested `package.json`:

- `_gitignore` is renamed to `.gitignore` when copied
- `*.tpl` files carry `{{placeholders}}`; the suffix is dropped when copied

Placeholders are `appId`, `appName`, `description`, `author`, `packageName` and `apiVersion`. Any unrecognized placeholder causes the build to fail.

### Trying it locally

```sh
pnpm build && node dist/index.js my-app   # the fastest loop
pnpm link --global                        # then: busy-create-app my-app
pnpm test                                 # the full path, through a real tarball
```

Only `pnpm test` catches files missing from the published package, so run it before releasing. It builds a generated app, so it needs that app's Node version — `fnm use` (or `nvm use`) reads it from `.nvmrc`. It installs with `--engine-strict`, so an incorrect version fails immediately. The generator itself runs on Node 20 and up.

## Versions

`template/package.json.tpl` pins the ranges a generated app gets for `@busy-app/busy-lib` and `@busy-app/cli`. On a `0.x` release, neither range automatically picks up the new minor version, so bump them here and release the template alongside.
