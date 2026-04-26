import { desc } from 'drizzle-orm'
import { db } from '../../utils/db'
import { jobs } from '../../db/schema'

export default defineEventHandler(async () => {
  const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100)

  return rows.map(row => ({
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : undefined,
    finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }))
})
