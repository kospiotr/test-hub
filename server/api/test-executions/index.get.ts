import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { testExecutions, tests } from '../../db/schema'

const querySchema = z.object({
  testId: z.union([
    z.coerce.number().int().positive(),
    z.array(z.coerce.number().int().positive())
  ]).optional(),
  testPackId: z.union([
    z.coerce.number().int().positive(),
    z.array(z.coerce.number().int().positive())
  ]).optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  const selectedTestIds = Array.isArray(query.testId)
    ? query.testId
    : (typeof query.testId === 'number' ? [query.testId] : [])

  const selectedPackIds = Array.isArray(query.testPackId)
    ? query.testPackId
    : (typeof query.testPackId === 'number' ? [query.testPackId] : [])

  const rows = await db.select({
    execution: testExecutions,
    testPackId: tests.testPackId,
    nodeId: tests.nodeId,
    name: tests.name
  }).from(testExecutions)
    .innerJoin(tests, eq(tests.id, testExecutions.testId))
    .where(and(
      selectedTestIds.length === 0
        ? undefined
        : selectedTestIds.length === 1
          ? eq(testExecutions.testId, selectedTestIds[0] as number)
          : inArray(testExecutions.testId, selectedTestIds),
      selectedPackIds.length === 0
        ? undefined
        : selectedPackIds.length === 1
          ? eq(tests.testPackId, selectedPackIds[0] as number)
          : inArray(tests.testPackId, selectedPackIds)
    ))
    .orderBy(desc(testExecutions.updatedAt))

  return rows.map(row => ({
    ...row.execution,
    testPackId: row.testPackId,
    nodeId: row.nodeId,
    name: row.name,
    startedAt: row.execution.startedAt ? new Date(row.execution.startedAt).toISOString() : undefined,
    finishedAt: row.execution.finishedAt ? new Date(row.execution.finishedAt).toISOString() : undefined,
    createdAt: new Date(row.execution.createdAt).toISOString(),
    updatedAt: new Date(row.execution.updatedAt).toISOString()
  }))
})
