import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { testPacks, tests } from '../../db/schema'
import { getAdapterById } from '../../utils/adapters'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)

  const row = await db.select({
    test: tests,
    testPackName: testPacks.name,
    testPackLabels: testPacks.labels,
    adapterId: testPacks.adapterId
  }).from(tests)
    .innerJoin(testPacks, eq(testPacks.id, tests.testPackId))
    .where(and(eq(tests.id, params.id), eq(tests.isDeleted, false)))
    .limit(1)

  const item = row[0]
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Test not found.' })
  }

  const adapter = getAdapterById(item.adapterId)
  const operations = (adapter?.operations || []).filter(op => op.scope === 'test')

  return {
    ...item.test,
    testPackName: item.testPackName,
    testPackLabels: JSON.parse(item.testPackLabels || '[]') as string[],
    operations,
    createdAt: new Date(item.test.createdAt).toISOString(),
    updatedAt: new Date(item.test.updatedAt).toISOString(),
    deletedAt: item.test.deletedAt ? new Date(item.test.deletedAt).toISOString() : undefined
  }
})
