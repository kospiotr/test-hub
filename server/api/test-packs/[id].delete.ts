import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { testPacks } from '../../db/schema'
import { db } from '../../utils/db'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)

  const [deleted] = await db.delete(testPacks).where(eq(testPacks.id, params.id)).returning({
    id: testPacks.id
  })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Test pack not found.' })
  }

  return { ok: true }
})
