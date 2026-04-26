import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { testPacks, tests } from '../db/schema'
import { assertValidAdapterConfig, getAdapterById, resolveTestPackState } from './adapters'

export const testPackBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  labels: z.array(z.string().trim().min(1).max(50)).default([]),
  description: z.string().default(''),
  documentation: z.string().default(''),
  adapterId: z.string().trim().min(1).max(120),
  configuration: z.record(z.string(), z.unknown())
}).superRefine((value, ctx) => {
  if (!getAdapterById(value.adapterId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adapterId'],
      message: 'Unknown adapter.'
    })
    return
  }

  try {
    assertValidAdapterConfig(value.adapterId, value.configuration)
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['configuration'],
      message: 'Invalid adapter configuration.'
    })
  }
})

type TestPackRow = typeof testPacks.$inferSelect

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function serializeTestPackInput(input: z.output<typeof testPackBodySchema>) {
  const configuration = assertValidAdapterConfig(input.adapterId, input.configuration)

  return {
    name: input.name,
    labels: JSON.stringify(input.labels),
    description: input.description,
    documentation: input.documentation,
    adapterId: input.adapterId,
    configuration: JSON.stringify(configuration)
  }
}

export async function mapTestPack(row: TestPackRow) {
  let state = {
    adapterId: row.adapterId,
    validationChecks: [] as Array<{ key: string, description: string, status: 'ok' | 'error' }>,
    states: [] as Array<{ key: string, label: string, value: string }>
  }

  try {
    state = await resolveTestPackState(row.id)
  } catch {
    state = {
      adapterId: row.adapterId,
      validationChecks: [{
        key: 'adapter-config-valid',
        description: 'Adapter configuration is valid and state can be resolved',
        status: 'error'
      }],
      states: [
        { key: 'adapterStatus', label: 'Adapter Status', value: 'error' },
        { key: 'testsCount', label: 'Tests Count', value: '0' }
      ]
    }
  }

  const adapter = getAdapterById(row.adapterId)
  const testsCount = await db.select({ id: tests.id }).from(tests)
    .where(eq(tests.testPackId, row.id))

  return {
    id: row.id,
    name: row.name,
    labels: parseJson<string[]>(row.labels, []),
    description: row.description,
    documentation: row.documentation,
    adapterId: row.adapterId,
    configuration: parseJson<Record<string, unknown>>(row.configuration, {}),
    operations: adapter?.operations || [],
    state,
    testsCount: testsCount.length,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }
}
