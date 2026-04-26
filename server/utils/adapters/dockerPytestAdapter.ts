import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { hasLocalImage, pullDockerImage } from '../docker-images'
import { db } from '../db'
import { testExecutions, testPacks, tests } from '../../db/schema'
import { runImageCommand, runImageCommandStream } from '../docker-runner'
import {
  AdapterInstance,
  type AdapterOperationDefinition,
  type AdapterStateSupplier,
  type AdapterValidationCheckResult,
  type AdapterValidationContext
} from './core'

type DockerPytestConfig = {
  imageRegistry: string
  imageName: string
  imageVersion: string
}

export class DockerPytestAdapter extends AdapterInstance<DockerPytestConfig> {
  readonly id = 'docker-pytest'
  readonly label = 'Docker Pytest'
  readonly description = 'Collect tests from a docker image using pytest --collect-only.'

  readonly configSchema = z.object({
    imageRegistry: z.string().trim().min(1).max(200).meta({
      label: 'Image Registry',
      placeholder: 'registry.hub.docker.com'
    }),
    imageName: z.string().trim().min(1).max(200).meta({
      label: 'Image Name',
      placeholder: 'org/qa-runner'
    }),
    imageVersion: z.string().trim().min(1).max(120).meta({
      label: 'Image Version',
      placeholder: 'latest'
    })
  })

  private imageRef(config: DockerPytestConfig) {
    return `${config.imageRegistry.trim()}/${config.imageName.trim()}:${config.imageVersion.trim()}`
  }

  readonly operations: AdapterOperationDefinition[] = [
    {
      id: 'pull-image',
      label: 'Pull Image',
      description: 'Pull docker image for this test pack.',
      scope: 'test-pack',
      run: async (context) => {
        if (!context.testPackId) {
          throw createError({ statusCode: 400, statusMessage: 'testPackId is required for pull-image operation.' })
        }

        const resolved = await this.resolveContext(context.testPackId)
        const imageRef = this.imageRef(resolved.config)
        await context.appendLog(`Pulling image ${imageRef}.`)
        await pullDockerImage(imageRef)
        await context.appendLog(`Pulled image ${imageRef}.`)

        await db.update(testPacks)
          .set({ updatedAt: new Date() })
          .where(eq(testPacks.id, resolved.testPack.id))

        return {
          operationId: 'pull-image',
          mode: 'sync' as const,
          message: `Pulled image ${imageRef}`
        }
      }
    },
    {
      id: 'load-tests',
      label: 'Load Tests',
      description: 'Queue a job to discover tests.',
      scope: 'test-pack',
      run: async (context) => {
        if (!context.testPackId) {
          throw createError({ statusCode: 400, statusMessage: 'testPackId is required for load-tests operation.' })
        }

        await context.appendLog(`Queueing load-tests for testPackId=${context.testPackId}.`)
        const job = await context.enqueue({
          testPackId: context.testPackId,
          operationId: 'load-tests'
        })
        await context.appendLog(`Queued load-tests job #${job.id}.`)

        return {
          operationId: 'load-tests',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued load-tests as job #${job.id}`
        }
      },
      runInJob: async ({testPackId, appendLog}) => {
        if (!testPackId) {
          throw new Error('testPackId is required for load-tests job operation.')
        }

        const resolved = await this.resolveContext(testPackId)
        const imageRef = this.imageRef(resolved.config)
        const existsLocally = await hasLocalImage(imageRef)
        await appendLog(`Resolved docker image ${imageRef}.`)

        if (!existsLocally) {
          await appendLog(`Image missing locally, pulling ${imageRef}.`)
          await pullDockerImage(imageRef)
          await appendLog(`Image pull completed for ${imageRef}.`)
        } else {
          await appendLog(`Image already available locally.`)
        }

        await appendLog('Running pytest collect command in container.')
        const result = await runImageCommand(imageRef, ['pytest', '--collect-only'])
        const stdoutTail = tailText(result.stdout)
        const stderrTail = tailText(result.stderr)
        await appendLog(`imageCommand stdout tail:\n${stdoutTail || '<empty>'}`)
        await appendLog(`imageCommand stderr tail:\n${stderrTail || '<empty>'}`)

        const lines = result.stdout.split('\n').map(line => line.trim()).filter(Boolean)
        const discovered = lines
          .filter(line => line.includes('::') && !line.startsWith('<'))
          .map((nodeId) => {
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
              imageVersion: resolved.config.imageVersion,
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
              imageVersion: resolved.config.imageVersion,
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
          imageRef,
          imageVersion: resolved.config.imageVersion,
          discoveredCount: discovered.length,
          stderr: result.stderr
        }

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

        await context.appendLog(`Queueing run-tests for testPackId=${context.testPackId} with testIds=${context.testIds.join(',')}.`)
        const job = await context.enqueue({
          testPackId: context.testPackId,
          operationId: 'run-tests',
          testIds: context.testIds
        })
        await context.appendLog(`Queued run-tests job #${job.id}.`)

        return {
          operationId: 'run-tests',
          mode: 'job' as const,
          jobId: job.id,
          message: `Queued run-tests as job #${job.id}`
        }
      },
      runInJob: async (context) => {
        if (!context.testPackId || !context.testIds?.length) {
          throw new Error('testPackId and testIds are required for run-tests job operation.')
        }

        const resolved = await this.resolveContext(context.testPackId)
        const imageRef = this.imageRef(resolved.config)
        const existsLocally = await hasLocalImage(imageRef)
        if (!existsLocally) {
          await context.appendLog(`Image missing locally, pulling ${imageRef}.`)
          await pullDockerImage(imageRef)
        }

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

        const runCommand = parseRunCommand('pytest -vv')
        const nodeIds = selectedTests.map(item => item.nodeId)
        const command = [...runCommand, ...nodeIds]
        await context.appendLog(`Running command in docker: ${command.join(' ')}`)

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
          await runImageCommandStream(
            imageRef,
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
          imageRef,
          testIds: context.testIds,
          executedCount: selectedTests.length
        }
      }
    }
  ]

  readonly states: AdapterStateSupplier[] = [
  ]

  async runValidationChecks(context: AdapterValidationContext): Promise<AdapterValidationCheckResult[]> {
    const resolved = await this.resolveContext(context.testPackId)
    const imageRef = this.imageRef(resolved.config)
    const existsLocally = await hasLocalImage(imageRef)

    return [{
      key: 'docker-image-exists',
      description: `Docker image exists locally (${imageRef})`,
      status: existsLocally ? 'ok' : 'error'
    }]
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
