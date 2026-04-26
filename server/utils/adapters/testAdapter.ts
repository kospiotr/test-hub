import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { stat } from 'node:fs/promises'
import { db } from '../db'
import { testPacks, tests } from '../../db/schema'
import { runLocalProjectCommand } from '../local-runner'
import {
  AdapterInstance,
  type AdapterOperationDefinition,
  type AdapterStateSupplier,
  type AdapterJobOperationContext,
  type AdapterValidationCheckResult,
  type AdapterValidationContext
} from './core'

type ShellConfig = {
  workingDirectory: string
}

export class ShellPytestAdapter extends AdapterInstance<ShellConfig> {
  readonly id = 'shell-adapter'
  readonly label = 'Shell adapter'
  readonly description = 'Various shell adapter.'

  readonly configSchema = z.object({
    workingDirectory: z.string().trim().min(1).max(1000).meta({
      label: 'Working Directory',
      placeholder: '/Users/you/workspace/my-pytest-project'
    })
  })

  readonly operations: AdapterOperationDefinition[] = [
    {
      id: 'execute',
      label: 'Execute',
      description: 'Executes custom command.',
      scope: 'test-pack',
      run: async (context) => {
        if (!context.testPackId) {
          throw createError({statusCode: 400, statusMessage: 'testPackId is required for load-tests operation.'})
        }
        const job = await context.enqueue({
          testPackId: context.testPackId,
          operationId: 'execute'
        })
        await context.appendLog(`Queued job #${job.id}.`)

        return {
          operationId: 'load-tests',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued local load-tests as job #${job.id}`
        }
      },
      runInJob: async (context) => {
        await context.appendLog('started')
        await new Promise(resolve => setTimeout(resolve, 3000))
        await context.appendLog('finished')
      }
    }
  ]

  readonly states: AdapterStateSupplier[] = []

  constructor() {
    super()
  }

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
}
