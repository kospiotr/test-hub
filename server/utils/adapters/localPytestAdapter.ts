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

type LocalPytestConfig = {
  projectPath: string
  pythonPath: string
}

export class LocalPytestAdapter extends AdapterInstance<LocalPytestConfig> {
  readonly id = 'local-pytest'
  readonly label = 'Local Pytest'
  readonly description = 'Collect tests from a local pytest project path.'

  readonly configSchema = z.object({
    projectPath: z.string().trim().min(1).max(1000).meta({
      label: 'Project Path',
      placeholder: '/Users/you/workspace/my-pytest-project'
    }),
    pythonPath: z.string().trim().min(1).max(1000).meta({
      label: 'Python Path',
      placeholder: '/usr/bin/python3'
    })
  })

  readonly operations: AdapterOperationDefinition[] = [
    {
      id: 'load-tests',
      label: 'Load Tests',
      description: 'Queue a job to discover tests from local path.',
      scope: 'test-pack',
      run: async (context) => {
        if (!context.testPackId) {
          throw createError({ statusCode: 400, statusMessage: 'testPackId is required for load-tests operation.' })
        }

        await context.appendLog(`Queueing local load-tests for testPackId=${context.testPackId}.`)
        const job = await context.enqueue({
          testPackId: context.testPackId,
          operationId: 'load-tests'
        })
        await context.appendLog(`Queued local load-tests job #${job.id}.`)

        return {
          operationId: 'load-tests',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued local load-tests as job #${job.id}`
        }
      }
    }
  ]

  readonly states: AdapterStateSupplier[] = [
  ]

  async runLoadTests(testPackId: number, appendLog: (message: string) => Promise<void>) {
    const resolved = await this.resolveContext(testPackId)
    const projectPath = resolved.config.projectPath
    const pythonPath = resolved.config.pythonPath
    await appendLog(`Resolved local project path ${projectPath}.`)
    await appendLog(`Using python binary ${pythonPath}.`)
    await appendLog('Running local pytest collect command.')

    const result = await runLocalProjectCommand(projectPath, [pythonPath, '-m', 'pytest', '--collect-only'])
    const stdoutTail = tailText(result.stdout)
    const stderrTail = tailText(result.stderr)
    await appendLog(`localCommand stdout tail:\n${stdoutTail || '<empty>'}`)
    await appendLog(`localCommand stderr tail:\n${stderrTail || '<empty>'}`)

    const lines = result.stdout.split('\n').map((line: string) => line.trim()).filter(Boolean)
    const discovered = lines
      .filter((line: string) => line.includes('::') && !line.startsWith('<'))
      .map((nodeId: string) => {
        const parts = nodeId.split('::')
        const filePath = parts[0] || ''
        const name = parts[parts.length - 1] || nodeId
        const suite = parts.length > 2 ? parts.slice(1, -1).join('::') : undefined

        return {
          nodeId,
          name,
          path: filePath,
          suite
        }
      })

    await db.delete(tests).where(eq(tests.testPackId, resolved.testPack.id))
    await appendLog(`Cleared existing tests for testPackId=${resolved.testPack.id}.`)

    const now = new Date()

    if (discovered.length) {
      await db.insert(tests).values(discovered.map((item: {
        nodeId: string
        name: string
        path: string
        suite?: string
      }) => ({
        testPackId: resolved.testPack.id,
        imageVersion: 'local',
        nodeId: item.nodeId,
        name: item.name,
        path: item.path,
        suite: item.suite,
        createdAt: now,
        updatedAt: now
      })))
    }

    await appendLog(`Inserted discovered tests count=${discovered.length}.`)

    await db.update(testPacks)
      .set({ updatedAt: now })
      .where(eq(testPacks.id, resolved.testPack.id))

    return {
      projectPath,
      pythonPath,
      discoveredCount: discovered.length,
      stderr: result.stderr
    }
  }

  private async runLoadTestsInJob(context: AdapterJobOperationContext) {
    if (!context.testPackId) {
      throw new Error('testPackId is required for load-tests job operation.')
    }

    return await this.runLoadTests(context.testPackId, context.appendLog)
  }

  constructor() {
    super()

    const loadTestsOp = this.operations.find(op => op.id === 'load-tests')
    if (loadTestsOp) {
      loadTestsOp.runInJob = async (context) => await this.runLoadTestsInJob(context)
    }
  }

  async runValidationChecks(context: AdapterValidationContext): Promise<AdapterValidationCheckResult[]> {
    const resolved = await this.resolveContext(context.testPackId)

    const projectCheck = await this.validateProjectPath(resolved.config.projectPath)
    const pythonCheck = await this.validatePythonPath(resolved.config.pythonPath)

    return [projectCheck, pythonCheck]
  }

  private async validateProjectPath(projectPath: string): Promise<AdapterValidationCheckResult> {
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

  private async validatePythonPath(pythonPath: string): Promise<AdapterValidationCheckResult> {
    try {
      const stats = await stat(pythonPath)
      return {
        key: 'python-path-exists',
        description: `Python path exists and is file (${pythonPath})`,
        status: stats.isFile() ? 'ok' : 'error'
      }
    } catch {
      return {
        key: 'python-path-exists',
        description: `Python path exists and is file (${pythonPath})`,
        status: 'error'
      }
    }
  }
}

function tailText(value: string, max = 8_000) {
  if (value.length <= max) {
    return value
  }

  return value.slice(value.length - max)
}
