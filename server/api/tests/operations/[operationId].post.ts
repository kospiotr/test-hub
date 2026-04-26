import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { createJob } from '../../../utils/jobs'
import { db } from '../../../utils/db'
import { tests } from '../../../db/schema'
import { executeTestScopeOperation } from '../../../utils/adapters'

const paramsSchema = z.object({
  operationId: z.string().trim().min(1).max(120)
})

const bodySchema = z.object({
  testIds: z.array(z.coerce.number().int().positive()).min(1)
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)
  const body = bodySchema.parse(await readBody(event))

  const testRows = await db.select({
    id: tests.id,
    testPackId: tests.testPackId
  }).from(tests)
    .where(and(inArray(tests.id, body.testIds), eq(tests.isDeleted, false)))

  if (testRows.length !== body.testIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some selected tests do not exist.' })
  }

  const firstPackId = testRows[0]?.testPackId
  if (!firstPackId) {
    throw createError({ statusCode: 400, statusMessage: 'No tests selected.' })
  }

  const crossPack = testRows.some(item => item.testPackId !== firstPackId)
  if (crossPack) {
    throw createError({ statusCode: 400, statusMessage: 'Selected tests must belong to a single test pack.' })
  }

  return await executeTestScopeOperation(
    firstPackId,
    params.operationId,
    body.testIds,
    async (payload) => {
      const created = await createJob('adapter-operation', payload)
      return { id: created.id }
    },
    async (message) => {
      console.info(`[adapter-op][testScope][${params.operationId}] ${message}`)
    }
  )
})
