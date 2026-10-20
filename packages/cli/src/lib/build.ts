// Builds the app into the BusyBar package format:
//
//   dist/<id>/
//   ├── appmeta/manifest.json      # required
//   ├── appmeta/settings.json      # optional
//   ├── scripts/main.js            # fixed entry point, plus sibling modules
//   └── images/ animations/ sounds/ resources/
//
// The package folder is named after the manifest id.
//
// With src/, resources in src/images, src/animations and src/sounds are copied as-is, and anything else in src/ is sorted by file type.
// Without src/ the app shares its directory with the rest of the project, so only its images/, animations/, sounds/ and resources/ are taken; a resource lying beside them is reported and left out.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { build as viteBuild } from 'vite'
import { appmetaDir, outRoot, type Project } from './paths.js'
import { classify, isMedia, KNOWN_DIRS, RESOURCE_DIRS } from './resources.js'
import { buildViteConfig } from './viteConfig.js'

/** Only what the build reads. The firmware owns the manifest schema; the file is copied into the package as it is. */
type Manifest = {
  id: string
  version: string
  api_version: string
  name: string
}

/** Manifest fields an archive name may refer to, as `{id}` and `{version}`. */
const NAME_FIELDS = ['id', 'version'] as const

/** Fills the placeholders of an archive name in from the manifest; throws on an unknown placeholder or a name that is a path. */
function archiveName(pattern: string, manifest: Manifest): string {
  const name = pattern.replace(/\{(\w+)\}/g, (_, key: string) => {
    const field = NAME_FIELDS.find((f) => f === key)
    if (!field) {
      throw new Error(`--tgz-name: unknown placeholder {${key}}, the known ones are ${NAME_FIELDS.map((f) => `{${f}}`).join(', ')}`)
    }
    return manifest[field]
  })
  if (name !== basename(name)) {
    throw new Error(`--tgz-name is a file name, not a path: ${name}\nSet the directory with --out.`)
  }
  return name
}

/** The id in the project's manifest, for the commands that need nothing else from it. */
export function readAppId(project: Project): string {
  const { id } = JSON.parse(readFileSync(resolve(appmetaDir(project), 'manifest.json'), 'utf8')) as Partial<Manifest>
  if (typeof id !== 'string' || id === '') {
    throw new Error('manifest.id is required')
  }
  return id
}

/** Validates the manifest against the spec; throws on violation. */
function validateManifest(path: string): Manifest {
  if (!existsSync(path)) {
    throw new Error('appmeta/manifest.json is missing and required')
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Partial<Manifest>
  if (typeof manifest.id !== 'string') {
    throw new Error('manifest.id is required')
  }
  if (manifest.id.length > 32) {
    throw new Error(`manifest.id must be at most 32 characters, this one is ${manifest.id.length}`)
  }
  // The same check as js_app_is_valid_id in the firmware.
  if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,31}$/.test(manifest.id)) {
    throw new Error('manifest.id must match ^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,31}$: Latin letters, digits, underscore, dash and dot, not starting with a dot, at most 32 characters')
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) {
    throw new Error('manifest.version must be semver, e.g. "1.0.0"')
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.api_version ?? '')) {
    throw new Error('manifest.api_version is required and must be semver, e.g. "27.12.0": the minimum BUSY Bar HTTP API version the app needs')
  }
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    throw new Error('manifest.name is required')
  }
  return manifest as Manifest
}

/** App sources: built by Vite, never treated as resources. */
const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx|d\.ts|map)$/i
/** Entries inside src/ that are not resources; appmeta/ is copied separately. */
const IGNORED = new Set(['appmeta'])

/** Recursively sorts a directory's files into the package's target folders, returning a map of `file name` → `path inside the package`. */
function layoutResources(srcDir: string, outDir: string, sourceDirName?: string, moved = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    // Dot-entries are tooling, never app resources.
    if (entry.name.startsWith('.')) continue
    if (IGNORED.has(entry.name)) continue
    const src = resolve(srcDir, entry.name)
    // A destination inside the project must not feed itself.
    if (src === outDir) continue

    if (entry.isDirectory()) {
      // A known folder name sets the type; any other is transparent.
      const nested = (KNOWN_DIRS as string[]).includes(entry.name) ? entry.name : sourceDirName
      layoutResources(src, outDir, nested, moved)
      continue
    }

    if (SOURCE_FILE.test(entry.name)) continue

    const { target, warning } = classify(entry.name, sourceDirName)
    if (warning) console.warn(`  ⚠ ${warning}`)
    const destDir = resolve(outDir, target)
    mkdirSync(destDir, { recursive: true })
    cpSync(src, resolve(destDir, entry.name))
    moved.set(entry.name, `${target}/${entry.name}`)
  }
  return moved
}

/** Rewrites "/_assets/<file>" references to the real path in the package. */
function rewriteAssetUrls(scriptsDir: string, moved: Map<string, string>): void {
  for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue
    const path = resolve(scriptsDir, entry.name)
    const code = readFileSync(path, 'utf8')
    const patched = code.replace(/(^|[^\w.-])\/_assets\/([\w.-]+)/g, (match, prefix, file) =>
      moved.has(file) ? `${prefix}${moved.get(file)}` : match,
    )
    if (patched !== code) writeFileSync(path, patched)
  }
}

export const DEFAULT_ADDR = 'localhost'

/** What a build leaves: the archive, the package folder, or both. */
export const EMITS = ['tgz', 'dir', 'both'] as const
export type Emit = (typeof EMITS)[number]

export type Options = {
  /** Output directory; a relative path resolves against the project root. */
  out?: string
  /** BUSY Bar address compiled into the app. */
  addr?: string
  minify?: boolean
  bundle?: boolean
  /** `tgz` (the default) leaves only `<id>.tgz`, `dir` only the `<id>/` folder, `both` the two. */
  emit?: Emit
  /** Archive file name; `{id}` and `{version}` are filled in from the manifest. */
  tgzName?: string
}

/** Builds the app of `project`, returning the archive or, when only the folder is emitted, the folder. */
export async function build(project: Project, opts: Options = {}): Promise<string> {
  const { root, app, hasSrc } = project
  const { out, addr = DEFAULT_ADDR, minify = true, bundle = false, emit = 'tgz', tgzName = '{id}.tgz' } = opts

  const destDir = outRoot(project, out)
  const manifest = validateManifest(resolve(appmetaDir(project), 'manifest.json'))
  console.log(`\n▶ Building ${manifest.id} v${manifest.version}`)
  if (addr !== DEFAULT_ADDR) console.log(`  addr: ${addr}`)

  const outDir = resolve(destDir, manifest.id)
  // Resolved before the build, so a bad name fails at once.
  const archive = resolve(destDir, archiveName(tgzName, manifest))

  // The default dist/ is the build's own, so it starts empty: no package or archive of an earlier build is left to be taken for this one.
  // A directory given with --out may hold anything else, so there only this app's package folder is replaced.
  rmSync(out === undefined ? destDir : outDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })

  await viteBuild(buildViteConfig(project, { outDir, addr, minify, bundle }))

  if (!existsSync(resolve(outDir, 'scripts/main.js'))) {
    throw new Error('build produced no scripts/main.js')
  }

  // appmeta/: the manifest, plus settings.json and the icons when the app has them.
  cpSync(appmetaDir(project), resolve(outDir, 'appmeta'), { recursive: true })

  // images/animations/sounds keep their folder; the rest go by extension.
  if (hasSrc) {
    layoutResources(app, outDir)
  } else {
    for (const dir of RESOURCE_DIRS) {
      const path = resolve(app, dir)
      if (existsSync(path)) layoutResources(path, outDir, (KNOWN_DIRS as string[]).includes(dir) ? dir : undefined)
    }
    // A resource in the app's root is in no folder the build takes, so it would be missing on the device without a word.
    for (const entry of readdirSync(app, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('.') || !isMedia(entry.name)) continue
      console.warn(`  ⚠ ${entry.name} is not packaged, move it to ${classify(entry.name).target}/`)
    }
  }

  // Assets vite emitted land in scripts/_assets/; spread them out and drop it.
  const emitted = resolve(outDir, 'scripts/_assets')
  if (existsSync(emitted)) {
    const moved = layoutResources(emitted, outDir)
    rmSync(emitted, { recursive: true, force: true })
    rewriteAssetUrls(resolve(outDir, 'scripts'), moved)
  }

  const scripts = readdirSync(resolve(outDir, 'scripts')).sort()
  console.log(`  scripts: ${scripts.join(', ')}`)

  let result = outDir

  if (emit !== 'dir') {
    // Packed from destDir so the archive holds the <id>/ folder itself.
    execFileSync('tar', ['-czf', archive, '-C', destDir, manifest.id], { stdio: 'inherit' })
    if (emit === 'tgz') rmSync(outDir, { recursive: true, force: true })
    result = archive
  }

  console.log(`\n✔ Done → ${relative(root, result) || result}`)
  return result
}
