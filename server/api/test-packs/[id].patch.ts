import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { testPacks } from '../../db/schema'
import { db } from '../../utils/db'
import { mapTestPack, serializeTestPackInput, testPackBodySchema } from '../../utils/test-packs'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)
  const body = await readBody(event)
  const payload = testPackBodySchema.parse(body)

  const [updated] = await db.update(testPacks).set({
    ...serializeTestPackInput(payload),
    updatedAt: new Date()
  }).where(eq(testPacks.id, params.id)).returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Test pack not found.' })
  }

  return await mapTestPack(updated)
})
