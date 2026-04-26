import { execFile } from 'node:child_process'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function trimOutput(value: string | undefined, max = 8_000) {
  if (!value) {
    return ''
  }

  return value.length > max ? value.slice(value.length - max) : value
}

export async function runImageCommand(image: string, command: string[]) {
  const args = ['run', '--rm', image, ...command]

  try {
    const result = await execFileAsync('docker', args, {
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 20
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr
    }
  } catch (error) {
    const stdout = trimOutput((error as { stdout?: string }).stdout)
    const stderr = trimOutput((error as { stderr?: string }).stderr)
    const message = [
      'Docker command failed.',
      `image=${image}`,
      `command=${command.join(' ')}`,
      stdout ? `stdout_tail=${JSON.stringify(stdout)}` : '',
      stderr ? `stderr_tail=${JSON.stringify(stderr)}` : ''
    ].filter(Boolean).join(' ')

    throw new Error(message)
  }
}

export async function runImageCommandStream(
  image: string,
  command: string[],
  onStdoutLine: (line: string) => Promise<void>,
  onStderrLine: (line: string) => Promise<void>
) {
  const args = ['run', '--rm', image, ...command]

  return await new Promise<{ exitCode: number | null }>((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const pushStdout = createLineStream(onStdoutLine)
    const pushStderr = createLineStream(onStderrLine)

    child.stdout.on('data', (chunk: Buffer) => {
      void pushStdout(chunk.toString('utf8'))
    })

    child.stderr.on('data', (chunk: Buffer) => {
      void pushStderr(chunk.toString('utf8'))
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (exitCode) => {
      void pushStdout('', true)
      void pushStderr('', true)

      if (typeof exitCode === 'number' && exitCode !== 0) {
        reject(new Error(`Docker command failed with exit code ${exitCode}.`))
        return
      }

      resolve({ exitCode })
    })
  })
}

function createLineStream(onLine: (line: string) => Promise<void>) {
  let pending = ''

  return async (chunk: string, flush = false) => {
    pending += chunk
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      await onLine(line)
    }

    if (flush && pending.trim()) {
      await onLine(pending)
      pending = ''
    }
  }
}
