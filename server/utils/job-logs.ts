import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export function resolveJobsLogDir() {
  const configured = process.env.JOBS_LOG_DIR?.trim()
  const target = configured && configured.length ? configured : '.jobs'

  if (path.isAbsolute(target)) {
    return target
  }

  return path.resolve(process.cwd(), target)
}

export function getJobLogFilePath(jobId: number) {
  return path.join(resolveJobsLogDir(), `job-${jobId}.log`)
}

export async function ensureJobsLogDir() {
  await mkdir(resolveJobsLogDir(), { recursive: true })
}

export async function appendJobLogLine(jobId: number, line: string) {
  await ensureJobsLogDir()
  await appendFile(getJobLogFilePath(jobId), `${line}\n`, 'utf8')
}

export async function readJobLog(jobId: number, offset = 0) {
  const filePath = getJobLogFilePath(jobId)

  try {
    const buffer = await readFile(filePath)
    const safeOffset = Math.max(0, Math.min(offset, buffer.length))
    const content = buffer.subarray(safeOffset).toString('utf8')

    return {
      content,
      nextOffset: buffer.length,
      exists: true
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('no such file') || message.includes('enoent')) {
      return {
        content: '',
        nextOffset: 0,
        exists: false
      }
    }

    throw error
  }
}
