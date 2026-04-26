import { eq } from 'drizzle-orm'
import { db } from './db'
import { testPacks } from '../db/schema'
import {
  type AdapterInstance,
  type AdapterManifest,
  type AdapterStateValue
} from './adapters/core'
import { DockerPytestAdapter } from './adapters/dockerPytestAdapter'
import { LocalPytestAdapter } from './adapters/localPytestAdapter'
import { ShellPytestAdapter } from './adapters/testAdapter'

const ADAPTER_INSTANCES: AdapterInstance<Record<string, unknown>>[] = [
  new DockerPytestAdapter() as AdapterInstance<Record<string, unknown>>,
  new LocalPytestAdapter() as AdapterInstance<Record<string, unknown>>,
  new ShellPytestAdapter() as AdapterInstance<Record<string, unknown>>
]

function getAdapterInstanceById(id: string) {
  return ADAPTER_INSTANCES.find(adapter => adapter.id === id)
}

async function resolveAdapterForTestPack(testPackId: number) {
  const testPack = await db.query.testPacks.findFirst({
    where: eq(testPacks.id, testPackId)
  })

  if (!testPack) {
    throw createError({ statusCode: 404, statusMessage: 'Test pack not found.' })
  }

  const adapter = getAdapterInstanceById(testPack.adapterId)
  if (!adapter) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported adapter: ${testPack.adapterId}` })
  }

  return {
    testPack,
    adapter
  }
}

export function listAdapters() {
  return ADAPTER_INSTANCES.map(adapter => adapter.toManifest())
}

export function getAdapterById(id: string): AdapterManifest | undefined {
  const adapter = getAdapterInstanceById(id)
  return adapter ? adapter.toManifest() : undefined
}

export function assertValidAdapterConfig(adapterId: string, rawConfig: unknown) {
  const adapter = getAdapterInstanceById(adapterId)
  if (!adapter) {
    throw new Error(`Unsupported adapter: ${adapterId}`)
  }

  return adapter.parseConfig(rawConfig)
}

export async function resolveTestPackState(testPackId: number) {
  const { adapter } = await resolveAdapterForTestPack(testPackId)

  const validationChecks = await adapter.runValidationChecks({ testPackId })
  const adapterStatus = validationChecks.every(item => item.status === 'ok') ? 'ok' : 'error'

  const states: AdapterStateValue[] = []
  states.push({ key: 'adapterStatus', label: 'Adapter Status', value: adapterStatus })

  for (const stateDef of adapter.states) {
    const value = await stateDef.supply({ testPackId })
    states.push({ key: stateDef.key, label: stateDef.label, value })
  }

  return {
    adapterId: adapter.id,
    validationChecks,
    states
  }
}

export async function executeTestPackOperation(
  testPackId: number,
  operationId: string,
  enqueue: (payload: { testPackId: number, operationId: string, testIds?: number[] }) => Promise<{ id: number }>,
  appendLog: (message: string) => Promise<void> = async () => {}
) {
  const { adapter } = await resolveAdapterForTestPack(testPackId)
  const operation = adapter.getOperationById(operationId)

  if (!operation) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported operation: ${operationId}` })
  }

  if (operation.scope !== 'test-pack') {
    throw createError({ statusCode: 400, statusMessage: `Unsupported scope for operation: ${operationId}` })
  }

  return await operation.run({
    scope: 'test-pack',
    testPackId,
    enqueue,
    appendLog
  })
}

export async function executeTestScopeOperation(
  testPackId: number,
  operationId: string,
  testIds: number[],
  enqueue: (payload: { testPackId: number, operationId: string, testIds?: number[] }) => Promise<{ id: number }>,
  appendLog: (message: string) => Promise<void> = async () => {}
) {
  const { adapter } = await resolveAdapterForTestPack(testPackId)
  const operation = adapter.getOperationById(operationId)

  if (!operation) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported operation: ${operationId}` })
  }

  if (operation.scope !== 'test') {
    throw createError({ statusCode: 400, statusMessage: `Unsupported scope for operation: ${operationId}` })
  }

  return await operation.run({
    scope: 'test',
    testPackId,
    testIds,
    enqueue,
    appendLog
  })
}

export async function runAdapterOperationFromJob(
  jobId: number,
  testPackId: number,
  operationId: string,
  testIds: number[] | undefined,
  appendLog: (message: string) => Promise<void>
) {
  const { adapter } = await resolveAdapterForTestPack(testPackId)
  const operation = adapter.getOperationById(operationId)

  if (!operation) {
    throw new Error(`Unsupported operation for adapter ${adapter.id}: ${operationId}`)
  }

  if (!operation.runInJob) {
    throw new Error(`Operation ${operationId} is not executable in worker context.`)
  }

  return await operation.runInJob({
    scope: operation.scope,
    jobId,
    testPackId,
    testIds,
    appendLog
  })
}
