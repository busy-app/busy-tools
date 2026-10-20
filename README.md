<div align="center">
# busy-tools

### Tooling for building JavaScript apps for the [BUSY Bar](https://busy.bar).

</div>

## Quickstart

Scaffold a new app:

```bash
npm create @busy-app/app my-app
cd my-app
```

Build and run the app:

```bash
npm run build         # builds the app and packs it into dist/<id>.tgz
npm run app:install   # installs it on the BUSY Bar connected over USB
npm run app:run       # launches the installed app
```

These commands call `busy-cli` under the hood. More about it below.

## Manage apps with CLI

`busy-cli` builds a JavaScript app for the BUSY Bar into a device package and manages apps on a connected BUSY Bar.

```bash
npm install -D @busy-app/cli
```

### Reference

| Command                           | Description                                              |
| --------------------------------- | -------------------------------------------------------- |
| `busy-cli create [dir]`           | scaffolds a new app via `pnpm create @busy-app/app`      |
| `busy-cli build`                  | builds the app in the current folder into a .tgz archive |
| `busy-cli app install [file.tgz]` | installs built app on a connected BUSY Bar               |
| `busy-cli app uninstall [app-id]` | uninstalls an app by id                                  |
| `busy-cli app run [app-id]`       | runs installed app by id                                 |
| `busy-cli app stop`               | stops (any currently running) app                        |

`busy-cli <command> --help` lists the options for each command.

### App Structure

`busy-cli` expects the following file structure:

```
my-app/
├── src/
│   ├── main.ts
│   ├── appmeta/
│   │   └── manifest.json
│   └── images/
└── package.json
```

It looks for `main.ts` or `main.js` in the current or `src` directory. An app also must have a valid manifest file. Read more about it in the [apps documentation](https://github.com/busy-app/busybar-firmware/blob/dev/documentation/JavaScript%20Applications.dox.md).

## License

MIT
