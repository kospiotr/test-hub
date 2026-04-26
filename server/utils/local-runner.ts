import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function trimOutput(value: string | undefined, max = 8_000) {
  if (!value) {
    return ''
  }

  return value.length > max ? value.slice(value.length - max) : value
}

export async function runLocalProjectCommand(projectPath: string, command: string[]) {
  if (!command.length) {
    throw new Error('Command is empty.')
  }

  const [binary, ...args] = command
  if (!binary) {
    throw new Error('Command binary is missing.')
  }

  try {
    const result = await execFileAsync(binary, args, {
      cwd: projectPath,
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
      'Local command failed.',
      `projectPath=${projectPath}`,
      `command=${command.join(' ')}`,
      stdout ? `stdout_tail=${JSON.stringify(stdout)}` : '',
      stderr ? `stderr_tail=${JSON.stringify(stderr)}` : ''
    ].filter(Boolean).join(' ')

    throw new Error(message)
  }
}
