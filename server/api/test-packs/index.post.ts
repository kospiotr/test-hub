import { testPacks } from '../../db/schema'
import { db } from '../../utils/db'
import { mapTestPack, serializeTestPackInput, testPackBodySchema } from '../../utils/test-packs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = testPackBodySchema.parse(body)
  const now = new Date()

  const [created] = await db.insert(testPacks).values({
    ...serializeTestPackInput(payload),
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create test pack.' })
  }

  return await mapTestPack(created)
})
