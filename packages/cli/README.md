# @busy-app/cli

`busy-cli` builds a JavaScript app for the BUSY Bar into a device package and manages apps on a connected BUSY Bar.

```sh
npm install -D @busy-app/cli     # or: pnpm add -D, yarn add -D, bun add -D
```

| Command | Description |
| --- | --- |
| `busy-cli create [dir]` | scaffolds a new app with `<pm> create @busy-app/app` |
| `busy-cli build` | builds the app in the current folder into `dist/<id>.tgz` |
| `busy-cli app install [file.tgz]` | installs built app on a connected BUSY Bar |
| `busy-cli app uninstall [app-id]` | uninstalls an app by id |
| `busy-cli app run [app-id]` | runs installed app by id |
| `busy-cli app stop` | stops the running app |

`busy-cli <command> --help` lists the options for each command.

## create

```sh
busy-cli create [dir] [options]
```

Runs `<pm> create @busy-app/app` using the package manager specified via `--package-manager <npm|pnpm|yarn|bun>`, which then installs the app with that package manager. Without the flag, or with an unknown name, `busy-cli create` prompts you interactively, with pnpm preselected. Without a terminal, interactive prompts cannot be shown, so the flag is required. All other options are forwarded to the generator; see [`@busy-app/create-app`](../create).

## The project

`busy-cli build` and `busy-cli app` work on the folder they are run in, and look nowhere else: not above it, not below it.

The app sits under `src/`, as scaffolded by `busy-cli create` or `npm create @busy-app/app`:

```
my-app/
├── src/
│   ├── main.ts
│   ├── appmeta/
│   │   └── manifest.json
│   ├── images/
│   └── sounds/
└── package.json
```

The commands also work when run from inside `src/`. For minimal setups, app files can also sit directly in the project root. A folder with neither `src/appmeta/manifest.json` nor `appmeta/manifest.json` is not an app, and the command exits with an error.

### Entry point

The entry point is `main.ts` or `main.js` in the app folder, or in its `scripts/`, the way the BUSY Bar keeps it: `scripts/main.ts` or `scripts/main.js`. Only one of the four may exist; if more than one is found, the build exits with an error. The name is fixed: the build emits it as `scripts/main.js`, the file the BUSY Bar starts. Any imported modules are emitted as separate files alongside it in `scripts/`, unless `--bundle` inlines them.

The BUSY Bar executes that file directly without calling any exports, so the file must start the app itself and export nothing:

```ts
function main(): void {
  // …
}

main();
```

An export in the entry point fails the build. Imported modules can use standard exports.

### Manifest

`appmeta/manifest.json` is copied into the package as is. Read more about manifest fields in the [apps documentation](https://github.com/busy-app/busybar-firmware/blob/dev/documentation/JavaScript%20Applications.dox.md). The build checks the fields it relies on:

| Field | Rule |
| --- | --- |
| `id` | Latin letters, digits, `_`, `-` and `.`, not starting with `.`, at most 32 characters |
| `version` | `x.y.z` |
| `api_version` | `x.y.z`, the minimum BUSY Bar HTTP API version the app needs |
| `name` | not empty |

### Resources

Images, animations and sounds are sorted by what the BUSY Bar can read:

| Extension | Destination |
| --- | --- |
| `.png` `.image` | `images/` |
| `.anim` | `animations/` |
| `.snd` | `sounds/` |
| anything else | `resources/` |

`images/`, `animations/` and `sounds/` hold only those formats. An image, animation or sound in another format — `.jpg`, `.gif`, `.svg`, `.wav`, `.mp3` and the like — goes to `resources/`, and the build warns that the device cannot read it.

With `src/`, every file in it that isn't a source file is included. A file in `src/images`, `src/animations` or `src/sounds` keeps its folder as long as the BUSY Bar reads its format; one whose extension corresponds to a different folder stays where it is, with a warning.

Without `src/`, the app shares its folder with the rest of the project, so only `images/`, `animations/`, `sounds/` and `resources/` are included. An image, animation or sound located directly in the project folder is omitted, and the build suggests where to move it.

## build

```sh
busy-cli build
```

The package lands in `dist/<id>.tgz`, named after the manifest id. The archive holds the `<id>/` folder, the one `--emit dir` leaves instead:

```
dist/
└── app.example.my_app/
    ├── appmeta/manifest.json
    ├── scripts/
    │   ├── main.js
    │   └── lib-format.js        one file per module of the app, named after its path under the app folder
    └── images/ animations/ sounds/ resources/
```

`dist/` is emptied first, so no artifacts from previous builds remain.

| Option | Description |
| --- | --- |
| `--out <path>` | builds into `<path>` instead of `dist/`; a relative path resolves against the project. Only this app's package is replaced there, while the rest of the directory contents are preserved |
| `--emit <tgz\|dir\|both>` | what the build produces: `tgz` (default), only `<id>.tgz`; `dir`, only the `<id>/` directory; `both`, leaves both |
| `--tgz-name <name>` | names the archive; `{id}` and `{version}` in the name are replaced with the manifest values, e.g. `--tgz-name "{id}-{version}.tgz"` |
| `--addr <host>` | the BUSY Bar address the app connects to, `localhost` by default: the device running the app |
| `--no-minify` | readable output, for debugging on the device |
| `--bundle` | inlines every module into one `scripts/main.js`; without it, each of the app's own modules is emitted as a file alongside `main.js` |

## app

```sh
busy-cli app install [file.tgz]
busy-cli app uninstall [app-id]
busy-cli app run [app-id]
busy-cli app stop
```

| Command | Description |
| --- | --- |
| `install` | uploads the built app and installs it |
| `uninstall` | removes an installed app, keeping its settings |
| `run` | runs an installed app |
| `stop` | quits the running app |

The file and the id can be omitted when the command is run from an app folder:

- `install` takes `dist/<id>.tgz`, the package produced by `busy-cli build`. It does not build anything: without that file it exits with an error. A package built elsewhere or under another name is passed as a path.
- `uninstall` and `run` read the id from `appmeta/manifest.json`.

When specified explicitly, the file and the id work from any folder.

### Reaching the BUSY Bar

All four commands talk to the BUSY Bar over its HTTP API and take the same two options:

| Option | Description |
| --- | --- |
| `--addr <host>` | the BUSY Bar address, `10.0.4.20` by default: its address over USB |
| `--password <password>` | the password from "Password protection", only needed over Wi-Fi |

Over USB, nothing has to be passed unless the address was changed:

```sh
busy-cli app install
```

Over Wi-Fi, pass the BUSY Bar's IP address or hostname with `--addr <host>`, along with the password when set:

```sh
busy-cli app install --addr <host>
busy-cli app run --addr <host> --password <password>
```

Wi-Fi access is configured in the BUSY Bar web interface under **Network** → **HTTP API** → **Over Wi-Fi**:

| Setting | Result |
| --- | --- |
| HTTP API access off | every request over Wi-Fi is refused; use USB |
| HTTP API access on | works as is |
| Password protection on | pass that password with `--password` |
