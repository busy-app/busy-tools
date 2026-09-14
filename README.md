# busy-tools

Tooling for building JavaScript apps for the [BUSY Bar](https://busy.bar).

| Package                                 | What it is                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| [`@busy-app/cli`](packages/cli)         | `busy` — builds an app into a device package, and installs it |
| [`create-busy-js-app`](packages/create) | `pnpm create busy-js-app` — scaffolds a new app               |

## Getting started

```sh
pnpm create busy-js-app my-app
cd my-app
pnpm install
pnpm build
```

## Developing this repository

Requires Node 22 or 24 and pnpm.

```sh
pnpm install
pnpm build       # build every package
pnpm typecheck
pnpm test
```

Changes that should be released carry a changeset:

```sh
pnpm changeset
```

Merging the "Version Packages" pull request publishes to npm.

## License

MIT
