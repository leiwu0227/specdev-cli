import { join } from 'path'
import fse from 'fs-extra'

const BIG_PICTURE_PLACEHOLDER = 'TODO: filled by'
const BIG_PICTURE_MIN_LENGTH = 100

export async function readBigPictureStatus(specdevPath) {
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (!(await fse.pathExists(bigPicturePath))) {
    return { exists: false, filled: false, path: bigPicturePath, content: '' }
  }

  const content = await fse.readFile(bigPicturePath, 'utf-8')
  const filled =
    content.trim().length > BIG_PICTURE_MIN_LENGTH &&
    !content.includes(BIG_PICTURE_PLACEHOLDER)

  return { exists: true, filled, path: bigPicturePath, content }
}
