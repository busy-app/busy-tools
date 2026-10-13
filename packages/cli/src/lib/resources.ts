// Sorts app resources into the package's target folders.

import { extname } from 'node:path'

/** A folder inside the built app package. */
export type Target = 'images' | 'animations' | 'sounds' | 'resources'

/** Extension → destination folder inside the app package. Only what the firmware reads: PNG and its own .image, .anim and .snd. */
const BY_EXTENSION = new Map<string, Target>([
  ['.png', 'images'],
  ['.image', 'images'],
  ['.anim', 'animations'],
  ['.snd', 'sounds'],
])

/** Media the firmware has no decoder for: extension → what it is, and the format to convert it to. */
const UNSUPPORTED = new Map<string, { kind: string; use: string }>([
  ...['.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'].map((ext) => [ext, { kind: 'images', use: '.png' }] as const),
  ['.animation', { kind: 'animations', use: '.anim' }],
  ...['.wav', '.sng', '.mp3', '.ogg', '.rtttl'].map((ext) => [ext, { kind: 'sounds', use: '.snd' }] as const),
])

/** Source folders already named after their target. */
export const KNOWN_DIRS: Target[] = ['images', 'animations', 'sounds']

/** The folders resources are taken from when the app has no src/ around it: images/, animations/, sounds/ and resources/. Nothing else in the project is looked at. */
export const RESOURCE_DIRS: Target[] = [...KNOWN_DIRS, 'resources']

function isKnownDir(dir: string): dir is Target {
  return (KNOWN_DIRS as string[]).includes(dir)
}

/** True for an image, animation or sound, whether the firmware reads its format or not. */
export function isMedia(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase()
  return BY_EXTENSION.has(ext) || UNSUPPORTED.has(ext)
}

/** Picks the destination for a file. images/, animations/ and sounds/ get only what the firmware reads: there a known source folder wins over the extension. Everything else goes to resources/. `warning` is set when the firmware cannot read the file, or when it does not land in the folder it sits in. */
export function classify(fileName: string, sourceDir?: string): { target: Target; warning: string | null } {
  const ext = extname(fileName).toLowerCase()
  const byExtension = BY_EXTENSION.get(ext)
  const inKnownDir = sourceDir !== undefined && isKnownDir(sourceDir)

  if (byExtension) {
    if (!inKnownDir || byExtension === sourceDir) return { target: byExtension, warning: null }
    return { target: sourceDir, warning: `${fileName} is in ${sourceDir}/, but its extension says ${byExtension}/` }
  }

  const format = UNSUPPORTED.get(ext)
  if (format) {
    return { target: 'resources', warning: `${fileName} goes to resources/: the BUSY Bar cannot read ${ext} ${format.kind}, use ${format.use}` }
  }

  return { target: 'resources', warning: inKnownDir ? `${fileName} goes to resources/: ${sourceDir}/ takes only what the BUSY Bar reads as ${sourceDir}` : null }
}
