import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { tests } from '../../db/schema'

const querySchema = z.object({
  testPackId: z.coerce.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  const rows = await db.select().from(tests)
    .where(and(query.testPackId ? eq(tests.testPackId, query.testPackId) : undefined))
    .orderBy(desc(tests.updatedAt))

  return rows.map(row => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }))
})
