import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { testExecutions, tests } from '../../db/schema'

const querySchema = z.object({
  testId: z.coerce.number().int().positive().optional(),
  testPackId: z.coerce.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  const rows = await db.select({
    execution: testExecutions,
    testPackId: tests.testPackId,
    nodeId: tests.nodeId,
    name: tests.name
  }).from(testExecutions)
    .innerJoin(tests, eq(tests.id, testExecutions.testId))
    .where(and(
      query.testId ? eq(testExecutions.testId, query.testId) : undefined,
      query.testPackId ? eq(tests.testPackId, query.testPackId) : undefined
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
