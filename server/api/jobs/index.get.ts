import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { jobs } from '../../db/schema'

const querySchema = z.object({
  testPackId: z.coerce.number().int().positive().optional(),
  operationId: z.string().trim().min(1).max(120).optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100)

  const filteredRows = rows.filter((row) => {
    if (!query.testPackId && !query.operationId) {
      return true
    }

    try {
      const payload = JSON.parse(row.payload) as { testPackId?: number, operationId?: string }

      if (query.testPackId && payload.testPackId !== query.testPackId) {
        return false
      }

      if (query.operationId && payload.operationId !== query.operationId) {
        return false
      }

      return true
    } catch {
      return false
    }
  })

  return filteredRows.map(row => ({
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : undefined,
    finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }))
})
