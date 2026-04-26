import { z } from 'zod'
import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import {
  AdapterInstance,
  type AdapterOperationDefinition,
  type AdapterValidationCheckResult,
  type AdapterValidationContext
} from './core'

type ShellConfig = {
  workingDirectory: string
  command: string
}

export class ShellPytestAdapter extends AdapterInstance<ShellConfig> {
  readonly id = 'shell-adapter'
  readonly label = 'Shell adapter'
  readonly description = 'Various shell adapter.'

  readonly configSchema = z.object({
    workingDirectory: z.string().trim().min(1).max(1000).meta({
      label: 'Working Directory',
      placeholder: '/Users/you/workspace/my-pytest-project'
    }).default('/Users/prki/workspace/qa-manager/examples/shell-example'),
    command: z.string().trim().min(1).max(1000).meta({
      label: 'Command',
      placeholder: 'pytest --collect-only -q'
    }).default('for i in {1..60}; do date \'+%Y-%m-%d %H:%M:%S\'; sleep 1; done')
  })

  readonly operations: AdapterOperationDefinition[] = [
    {
      id: 'execute',
      label: 'Execute',
      description: 'Executes custom command.',
      scope: 'test-pack',
        run: async (context) => {
          if (!context.testPackId) {
            throw createError({ statusCode: 400, statusMessage: 'testPackId is required for execute operation.' })
          }

          const job = await context.enqueue({
            testPackId: context.testPackId,
            operationId: 'execute'
        })
        await context.appendLog(`Queued job #${job.id}.`)

        return {
          operationId: 'execute',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued execute as job #${job.id}`
        }
      },
      runInJob: async (context) => {
        if (!context.testPackId) {
          throw new Error('testPackId is required for execute job operation.')
        }

        const resolved = await this.resolveContext(context.testPackId)
        const command = resolved.config.command.trim()
        const workingDirectory = resolved.config.workingDirectory.trim()

        await context.appendLog(`Executing configured command in ${workingDirectory}`)
        await context.appendLog(`Command: ${command}`)

        const result = await this.runConfiguredCommand(
          command,
          workingDirectory,
          async (line) => await context.appendLog(`[stdout] ${line}`),
          async (line) => await context.appendLog(`[stderr] ${line}`)
        )

        await context.appendLog(`Command completed with exitCode=${result.exitCode}`)

        return {
          command,
          workingDirectory,
          exitCode: result.exitCode
        }
      }
    }
  ]

  readonly states: AdapterStateSupplier[] = []

  async runValidationChecks(context: AdapterValidationContext): Promise<AdapterValidationCheckResult[]> {
    const resolved = await this.resolveContext(context.testPackId)

    const projectCheck = await this.validateWorkingDirectory(resolved.config.workingDirectory)

    return [projectCheck]
  }

  private async validateWorkingDirectory(projectPath: string): Promise<AdapterValidationCheckResult> {
    try {
      const stats = await stat(projectPath)
      return {
        key: 'project-path-exists',
        description: `Project path exists and is directory (${projectPath})`,
        status: stats.isDirectory() ? 'ok' : 'error'
      }
    } catch {
      return {
        key: 'project-path-exists',
        description: `Project path exists and is directory (${projectPath})`,
        status: 'error'
      }
    }
  }

  private async runConfiguredCommand(
    command: string,
    workingDirectory: string,
    onStdoutLine: (line: string) => Promise<void>,
    onStderrLine: (line: string) => Promise<void>
  ) {
    return await new Promise<{ exitCode: number | null }>((resolve, reject) => {
      const child = spawn('bash', ['-lc', command], {
        cwd: workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      const pushStdout = createLineStream(async (line) => {
        await onStdoutLine(line)
      })
      const pushStderr = createLineStream(async (line) => {
        await onStderrLine(line)
      })

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
          reject(new Error(`Command exited with code ${exitCode}`))
          return
        }

        resolve({ exitCode })
      })
    })
  }
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
