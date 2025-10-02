import fse from 'fs-extra'

export async function copySpecdev(source, destination, force = false) {
  try {
    if (force) {
      // Remove existing if force is true
      await fse.remove(destination)
    }

    // Copy the template directory
    await fse.copy(source, destination, {
      overwrite: force,
      errorOnExist: !force
    })

    return true
  } catch (error) {
    throw new Error(`Copy failed: ${error.message}`)
  }
}
