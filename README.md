# busy-tools

Tooling for building JavaScript apps for the [BUSY Bar](https://busy.bar).

| Package                                   | Description                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| [`@busy-app/cli`](packages/cli)           | `busy-cli` — builds an app into a device package and installs it on a BUSY Bar |
| [`@busy-app/create-app`](packages/create) | `pnpm create @busy-app/app` — scaffolds a new app                              |

## Getting started

```sh
pnpm create @busy-app/app my-app
cd my-app
pnpm build         # build the app into dist/<id>.tgz
pnpm app:install   # install it on the BUSY Bar connected over USB
pnpm app:run       # launch the installed app
```

## Developing this repository

Requires Node.js 22 or 24, and pnpm.

```sh
pnpm install
pnpm build       # build every package
pnpm typecheck
pnpm test
```

Changes intended for release must include a changeset:

```sh
pnpm changeset
```

Merging the "Bump versions" pull request stages the release; approve it on npm to publish.

## License

MIT
