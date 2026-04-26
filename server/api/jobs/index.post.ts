import { z } from 'zod'
import { createJob } from '../../utils/jobs'

const bodySchema = z.object({
  type: z.enum(['adapter-operation']),
  payload: z.record(z.string(), z.unknown())
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = bodySchema.parse(body)

  const normalizedPayload = z.object({
    testPackId: z.coerce.number().int().positive(),
    operationId: z.string().trim().min(1).max(120)
  }).parse(payload.payload)

  const created = await createJob(payload.type, normalizedPayload)

  return {
    id: created.id,
    type: created.type,
    status: created.status,
    attempts: created.attempts,
    createdAt: new Date(created.createdAt).toISOString(),
    updatedAt: new Date(created.updatedAt).toISOString()
  }
})
