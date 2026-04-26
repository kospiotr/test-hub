import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { stat } from 'node:fs/promises'
import { db } from '../db'
import { testExecutions, testPacks, tests } from '../../db/schema'
import { runLocalProjectCommand, runLocalProjectCommandStream } from '../local-runner'
import {
  AdapterInstance,
  type AdapterOperationDefinition,
  type AdapterStateSupplier,
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
      },
      runInJob: async (context) => {
        if (!context.testPackId) {
          throw new Error('testPackId is required for load-tests job operation.')
        }

        return await this.runLoadTests(context.testPackId, context.appendLog)
      }
    },
    {
      id: 'run-tests',
      label: 'Run Tests',
      description: 'Queue a job to run selected tests.',
      scope: 'test',
      run: async (context) => {
        if (!context.testPackId || !context.testIds?.length) {
          throw createError({ statusCode: 400, statusMessage: 'testPackId and testIds are required for run-tests operation.' })
        }

        await context.appendLog(`Queueing local run-tests for testPackId=${context.testPackId} with testIds=${context.testIds.join(',')}.`)
        const job = await context.enqueue({
          testPackId: context.testPackId,
          operationId: 'run-tests',
          testIds: context.testIds
        })
        await context.appendLog(`Queued local run-tests job #${job.id}.`)

        return {
          operationId: 'run-tests',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued local run-tests as job #${job.id}`
        }
      },
      runInJob: async (context) => {
        if (!context.testPackId || !context.testIds?.length) {
          throw new Error('testPackId and testIds are required for run-tests job operation.')
        }

        const resolved = await this.resolveContext(context.testPackId)
        const selectedTests = await db.select().from(tests)
          .where(and(
            eq(tests.testPackId, resolved.testPack.id),
            inArray(tests.id, context.testIds),
            eq(tests.isDeleted, false)
          ))

        if (!selectedTests.length) {
          throw new Error('No tests found for requested test IDs.')
        }

        const selectedIds = new Set(selectedTests.map(item => item.id))
        const missing = context.testIds.filter(id => !selectedIds.has(id))
        if (missing.length) {
          throw new Error(`Some tests do not belong to this test pack: ${missing.join(',')}`)
        }

        const runCommand = parseRunCommand( `${resolved.config.pythonPath} -m pytest -q`)
        const nodeIds = selectedTests.map(item => item.nodeId)
        const command = [...runCommand, ...nodeIds]

        await context.appendLog(`Running command locally in ${resolved.config.projectPath}: ${command.join(' ')}`)

        const now = new Date()
        const executionRows = await db.insert(testExecutions).values(selectedTests.map(test => ({
          testId: test.id,
          jobId: context.jobId,
          status: 'running',
          startedAt: now,
          createdAt: now,
          updatedAt: now
        }))).returning()

        const executionByTestId = new Map(executionRows.map(item => [item.testId, item]))
        const statusByNodeId = new Map<string, 'passed' | 'failed' | 'skipped'>()
        const outputByNodeId = new Map<string, string[]>()
        let runFailed = false
        let runError = ''

        try {
          await runLocalProjectCommandStream(
            resolved.config.projectPath,
            command,
            async (line) => {
              await context.appendLog(`[stdout] ${line}`)
              capturePytestLine(line, nodeIds, statusByNodeId, outputByNodeId)
            },
            async (line) => {
              await context.appendLog(`[stderr] ${line}`)
              capturePytestLine(line, nodeIds, statusByNodeId, outputByNodeId)
            }
          )
        } catch (error) {
          runFailed = true
          runError = error instanceof Error ? error.message : String(error)
          await context.appendLog(`Run command failed: ${runError}`)
        }

        const finishedAt = new Date()
        for (const testRow of selectedTests) {
          const execution = executionByTestId.get(testRow.id)
          if (!execution) {
            continue
          }

          const parsedStatus = statusByNodeId.get(testRow.nodeId)
          const finalStatus = parsedStatus || (runFailed ? 'failed' : 'passed')
          const output = (outputByNodeId.get(testRow.nodeId) || []).join('\n')

          await db.update(testExecutions)
            .set({
              status: finalStatus,
              output: output || undefined,
              finishedAt,
              updatedAt: finishedAt
            })
            .where(eq(testExecutions.id, execution.id))
        }

        if (runFailed) {
          throw new Error(runError || 'Run command failed.')
        }

        return {
          testIds: context.testIds,
          executedCount: selectedTests.length
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

    const now = new Date()
    const existing = await db.select().from(tests)
      .where(eq(tests.testPackId, resolved.testPack.id))

    const existingByNodeId = new Map(existing.map(item => [item.nodeId, item]))
    const discoveredByNodeId = new Map(discovered.map(item => [item.nodeId, item]))

    let restoredCount = 0
    let addedCount = 0
    let updatedCount = 0
    let deletedMarkedCount = 0

    for (const discoveredItem of discovered) {
      const match = existingByNodeId.get(discoveredItem.nodeId)
      if (!match) {
        await db.insert(tests).values({
          testPackId: resolved.testPack.id,
          isDeleted: false,
          deletedAt: null,
          imageVersion: 'local',
          nodeId: discoveredItem.nodeId,
          name: discoveredItem.name,
          path: discoveredItem.path,
          suite: discoveredItem.suite,
          createdAt: now,
          updatedAt: now
        })
        addedCount += 1
        continue
      }

      await db.update(tests)
        .set({
          isDeleted: false,
          deletedAt: null,
          imageVersion: 'local',
          name: discoveredItem.name,
          path: discoveredItem.path,
          suite: discoveredItem.suite,
          updatedAt: now
        })
        .where(eq(tests.id, match.id))

      if (match.isDeleted) {
        restoredCount += 1
      } else {
        updatedCount += 1
      }
    }

    for (const existingItem of existing) {
      if (discoveredByNodeId.has(existingItem.nodeId)) {
        continue
      }

      if (existingItem.isDeleted) {
        continue
      }

      await db.update(tests)
        .set({
          isDeleted: true,
          deletedAt: now,
          updatedAt: now
        })
        .where(eq(tests.id, existingItem.id))

      deletedMarkedCount += 1
    }

    await appendLog(`Discovery synced: added=${addedCount}, updated=${updatedCount}, restored=${restoredCount}, marked_deleted=${deletedMarkedCount}.`)

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

function parseRunCommand(value: string) {
  return value.split(' ').map(item => item.trim()).filter(Boolean)
}

function capturePytestLine(
  line: string,
  nodeIds: string[],
  statusByNodeId: Map<string, 'passed' | 'failed' | 'skipped'>,
  outputByNodeId: Map<string, string[]>
) {
  const match = line.match(/^(.*::[^\s]+)\s+(PASSED|FAILED|ERROR|SKIPPED|XFAILED|XPASSED)\b/i)
  if (match) {
    const nodeId = (match[1] || '').trim()
    const statusRaw = (match[2] || '').toUpperCase()
    if (statusRaw === 'PASSED' || statusRaw === 'XPASSED') {
      statusByNodeId.set(nodeId, 'passed')
    } else if (statusRaw === 'SKIPPED' || statusRaw === 'XFAILED') {
      statusByNodeId.set(nodeId, 'skipped')
    } else {
      statusByNodeId.set(nodeId, 'failed')
    }
  }

  for (const nodeId of nodeIds) {
    if (!line.includes(nodeId)) {
      continue
    }

    const bucket = outputByNodeId.get(nodeId) || []
    bucket.push(line)
    outputByNodeId.set(nodeId, bucket)
  }
}

function tailText(value: string, max = 8_000) {
  if (value.length <= max) {
    return value
  }

  return value.slice(value.length - max)
}
