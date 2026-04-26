import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { hasLocalImage, pullDockerImage } from '../docker-images'
import { db } from '../db'
import { testPacks, tests } from '../../db/schema'
import { runImageCommand } from '../docker-runner'
import {
  type AdapterConfigField,
  AdapterInstance,
  type AdapterOperationDefinition,
  type AdapterStateSupplier,
  type AdapterJobOperationContext
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

  readonly configFields: AdapterConfigField[] = [
    {
      key: 'imageRegistry',
      label: 'Image Registry',
      type: 'text',
      placeholder: 'registry.hub.docker.com',
      required: true
    },
    {key: 'imageName', label: 'Image Name', type: 'text', placeholder: 'org/qa-runner', required: true},
    {key: 'imageVersion', label: 'Image Version', type: 'text', placeholder: 'latest', required: true}
  ]

  readonly configSchema = z.object({
    imageRegistry: z.string().trim().min(1).max(200),
    imageName: z.string().trim().min(1).max(200),
    imageVersion: z.string().trim().min(1).max(120)
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
      }
    }
  ]

  readonly states: AdapterStateSupplier[] = [
    {
      key: 'imageStatus',
      label: 'Image Status',
      supply: async (context) => {
        const resolved = await this.resolveContext(context.testPackId)
        const imageRef = this.imageRef(resolved.config)
        const pulled = await hasLocalImage(imageRef)
        return pulled ? 'pulled' : 'missing'
      }
    },
    {
      key: 'testsCount',
      label: 'Tests Count',
      supply: async (context) => {
        const resolved = await this.resolveContext(context.testPackId)
        const rows = await db.select({ id: tests.id }).from(tests)
          .where(and(
            eq(tests.testPackId, resolved.testPack.id),
            eq(tests.imageVersion, resolved.config.imageVersion)
          ))

        return String(rows.length)
      }
    }
  ]

  async runLoadTests(testPackId: number, appendLog: (message: string) => Promise<void>) {
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
    const result = await runImageCommand(imageRef, ['pytest', '--collect-only', '-q'])
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

    await db.delete(tests).where(eq(tests.testPackId, resolved.testPack.id))
    await appendLog(`Cleared existing tests for testPackId=${resolved.testPack.id}.`)

    const now = new Date()

    if (discovered.length) {
      await db.insert(tests).values(discovered.map(item => ({
        testPackId: resolved.testPack.id,
        imageVersion: resolved.config.imageVersion,
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
      imageRef,
      imageVersion: resolved.config.imageVersion,
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
}


function tailText(value: string, max = 8_000) {
  if (value.length <= max) {
    return value
  }

  return value.slice(value.length - max)
}
