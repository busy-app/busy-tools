# @busy-app/create-app

Scaffolds a JavaScript app for the BUSY Bar. One app, one repository.

```sh
pnpm create @busy-app/app my-app
```

The generator asks for the app's id, display name, description and author, writes the template with those filled in, and runs `git init` unless told not to.

Every prompt has a flag:

```sh
busy-create-app my-app --id app.example.my_app --name "My App" --description "..." --author "..."
```

Anything left out is asked for. `--help` lists the flags.

`--no-git` leaves the repository out, for scaffolding into a workspace that already has one.

### App ids

An id is `<namespace>.<app>`, at most 32 characters, made of letters, digits, dot and underscore. The default namespace is `app.example` — a placeholder. Replace it with your own before publishing.

## What you get

```
my-app/
├── src/                   the app
│   ├── main.ts            the entry point: export default function run()
│   ├── appmeta/
│   │   └── manifest.json  id, name, version
│   ├── images/
│   ├── animations/
│   └── sounds/
├── shared/                app-level helpers, imported as @shared/*
└── tsconfig*.json
```

`src/` is the app, and the build scans it only. `shared/` holds the helpers an app needs but a library cannot provide: the device client, the settings reader and a few date wrappers.

Layout, fonts and XPM2 come from `@busy-app/busy-lib`; the build itself from `@busy-app/cli`.

`pnpm build` produces the package in `dist/<id>/`, named after the manifest id; `--out <path>` puts it elsewhere, and `--tgz` packs it into `<id>.tgz` alongside.

## Working on the generator

```
src/index.ts    the prompts and the copy
template/       exactly what a generated app looks like
test/e2e.mjs    packs, scaffolds, installs, type-checks and builds (node:test)
```

Two conventions in `template/` work around npm, which strips `.gitignore` from packages and misreads a nested `package.json`:

- `_gitignore` and `_env.example` are renamed to their dotted names on copy
- `*.tpl` files carry `{{placeholders}}`; the suffix is dropped on copy

Placeholders are `appId`, `appName`, `description`, `author` and `packageName`. An unknown one fails the build.

### Trying it locally

```sh
pnpm build && node dist/index.js my-app   # the fastest loop
pnpm link --global                        # then: busy-create-app my-app
pnpm test                                 # the full path, through a real tarball
```

Only `pnpm test` catches files missing from the published package, so run it before releasing. It builds a generated app, so it needs that app's Node version — `fnm use` (or `nvm use`) reads it from `.nvmrc`. It installs with `--engine-strict`, so a wrong version fails immediately. The generator itself runs on Node 20 and up.

## Versions

`template/package.json.tpl` pins the ranges a generated app gets for `@busy-app/busy-lib` and `@busy-app/cli`. On a `0.x` release neither range picks up the new minor, so raise it here and release the template alongside.
