import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { testExecutions, testPacks, tests } from '../../db/schema'

const querySchema = z.object({
  name: z.string().trim().max(200).optional(),
  testPackId: z.union([
    z.coerce.number().int().positive(),
    z.array(z.coerce.number().int().positive())
  ]).optional(),
  labels: z.union([
    z.string().trim().min(1).max(50),
    z.array(z.string().trim().min(1).max(50))
  ]).optional(),
  executionStatus: z.union([
    z.string().trim().min(1).max(50),
    z.array(z.string().trim().min(1).max(50))
  ]).optional(),
  executionStartedFrom: z.coerce.date().optional(),
  executionStartedTo: z.coerce.date().optional(),
  executionFinishedFrom: z.coerce.date().optional(),
  executionFinishedTo: z.coerce.date().optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  const selectedIds = Array.isArray(query.testPackId)
    ? query.testPackId
    : (typeof query.testPackId === 'number' ? [query.testPackId] : [])

  const whereClause = selectedIds.length === 0
    ? undefined
    : selectedIds.length === 1
      ? eq(tests.testPackId, selectedIds[0] as number)
      : inArray(tests.testPackId, selectedIds)

  const selectedLabels = Array.isArray(query.labels)
    ? query.labels
    : (typeof query.labels === 'string' ? [query.labels] : [])

  const labelWhere = selectedLabels.length === 0
    ? undefined
    : or(...selectedLabels.map(label => sql`${testPacks.labels} LIKE ${`%"${label}"%`}`))

  const selectedStatuses = Array.isArray(query.executionStatus)
    ? query.executionStatus
    : (typeof query.executionStatus === 'string' ? [query.executionStatus] : [])

  const hasExecutionFilters = selectedStatuses.length > 0
    || !!query.executionStartedFrom
    || !!query.executionStartedTo
    || !!query.executionFinishedFrom
    || !!query.executionFinishedTo

  const executionTestIdsSubquery = hasExecutionFilters
    ? db.select({ testId: testExecutions.testId }).from(testExecutions)
      .where(and(
        selectedStatuses.length === 0
          ? undefined
          : selectedStatuses.length === 1
            ? eq(testExecutions.status, selectedStatuses[0] as string)
            : inArray(testExecutions.status, selectedStatuses),
        query.executionStartedFrom ? sql`${testExecutions.startedAt} >= ${query.executionStartedFrom}` : undefined,
        query.executionStartedTo ? sql`${testExecutions.startedAt} <= ${query.executionStartedTo}` : undefined,
        query.executionFinishedFrom ? sql`${testExecutions.finishedAt} >= ${query.executionFinishedFrom}` : undefined,
        query.executionFinishedTo ? sql`${testExecutions.finishedAt} <= ${query.executionFinishedTo}` : undefined
      ))
    : null

  const rows = await db.select({
    test: tests,
    testPackName: testPacks.name,
    testPackLabels: testPacks.labels
  }).from(tests)
    .innerJoin(testPacks, eq(testPacks.id, tests.testPackId))
    .where(and(
      whereClause,
      eq(tests.isDeleted, false),
      query.name ? sql`lower(${tests.name}) LIKE ${`%${query.name.toLowerCase()}%`}` : undefined,
      labelWhere,
      hasExecutionFilters && executionTestIdsSubquery ? inArray(tests.id, executionTestIdsSubquery) : undefined
    ))
    .orderBy(desc(tests.updatedAt))

  return rows.map(row => ({
    ...row.test,
    testPackName: row.testPackName,
    testPackLabels: JSON.parse(row.testPackLabels || '[]') as string[],
    createdAt: new Date(row.test.createdAt).toISOString(),
    updatedAt: new Date(row.test.updatedAt).toISOString()
  }))
})
