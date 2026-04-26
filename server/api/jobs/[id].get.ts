import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { jobs } from '../../db/schema'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)

  const row = await db.query.jobs.findFirst({
    where: eq(jobs.id, params.id)
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found.' })
  }

  return {
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : undefined,
    finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }
})
