import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { testPacks, tests } from '../../db/schema'

const querySchema = z.object({
  testPackId: z.union([
    z.coerce.number().int().positive(),
    z.array(z.coerce.number().int().positive())
  ]).optional()
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

  const rows = await db.select({
    test: tests,
    testPackName: testPacks.name,
    testPackLabels: testPacks.labels
  }).from(tests)
    .innerJoin(testPacks, eq(testPacks.id, tests.testPackId))
    .where(and(whereClause))
    .orderBy(desc(tests.updatedAt))

  return rows.map(row => ({
    ...row.test,
    testPackName: row.testPackName,
    testPackLabels: JSON.parse(row.testPackLabels || '[]') as string[],
    createdAt: new Date(row.test.createdAt).toISOString(),
    updatedAt: new Date(row.test.updatedAt).toISOString()
  }))
})
