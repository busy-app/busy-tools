// Sorts app resources into the package's target folders.

import { extname } from 'node:path'

/** A folder inside the built app package. */
export type Target = 'images' | 'animations' | 'sounds' | 'resources'

/** Extension → destination folder inside the app package. */
const BY_EXTENSION = new Map<string, Target>([
  // images/
  ['.png', 'images'],
  ['.jpg', 'images'],
  ['.jpeg', 'images'],
  ['.gif', 'images'],
  ['.bmp', 'images'],
  ['.webp', 'images'],
  ['.svg', 'images'],
  ['.image', 'images'],
  ['.ico', 'images'],
  // animations/
  ['.anim', 'animations'],
  ['.animation', 'animations'],
  // sounds/ — .wav in firmware sources, .snd in built device assets
  ['.wav', 'sounds'],
  ['.snd', 'sounds'],
  ['.sng', 'sounds'],
  ['.mp3', 'sounds'],
  ['.ogg', 'sounds'],
  ['.rtttl', 'sounds'],
])

/** Source folders already named after their target. */
export const KNOWN_DIRS: Target[] = ['images', 'animations', 'sounds']

function isKnownDir(dir: string): dir is Target {
  return (KNOWN_DIRS as string[]).includes(dir)
}

/** Picks the destination for a file. A known source folder wins over the extension; anything unrecognized goes to resources/. `warning` is set when the extension disagrees with the containing folder. */
export function classify(fileName: string, sourceDir?: string): { target: Target; warning: string | null } {
  const byExtension = BY_EXTENSION.get(extname(fileName).toLowerCase())

  if (sourceDir && isKnownDir(sourceDir)) {
    const warning =
      byExtension === sourceDir
        ? null
        : byExtension
          ? `${fileName} is in ${sourceDir}/, but its extension says ${byExtension}/`
          : `${fileName} is in ${sourceDir}/, but its extension is unknown`
    return { target: sourceDir, warning }
  }

  return { target: byExtension ?? 'resources', warning: null }
}
