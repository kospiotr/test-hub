import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function isMissingDocker(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('enoent') || message.includes('not found')
}

function isImageNotFound(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('no such image') || message.includes('no such object')
}

export async function hasLocalImage(imageRef: string): Promise<boolean> {
  try {
    await execFileAsync('docker', ['image', 'inspect', imageRef], { timeout: 8_000 })
    return true
  } catch (error) {
    if (isMissingDocker(error)) {
      console.error('[docker] Docker CLI is not available for image inspect')
      return false
    }

    if (isImageNotFound(error)) {
      return false
    }

    console.warn(`[docker] image inspect failed for ${imageRef}`)

    return false
  }
}

export async function pullDockerImage(imageRef: string): Promise<void> {
  console.info(`[docker] Pulling image ${imageRef}`)

  try {
    await execFileAsync('docker', ['pull', imageRef], { timeout: 120_000 })
    console.info(`[docker] Pulled image ${imageRef}`)
  } catch (error) {
    if (isMissingDocker(error)) {
      console.error('[docker] Docker CLI is not available for pull')
      throw createError({ statusCode: 503, statusMessage: 'Docker CLI is not available on the server.' })
    }

    console.error(`[docker] Failed to pull image ${imageRef}`)
    throw createError({ statusCode: 502, statusMessage: `Failed to pull image ${imageRef}.` })
  }
}
