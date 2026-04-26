import { z } from 'zod'
import { executeTestPackOperation } from '../../../../utils/adapters'
import { createJob } from '../../../../utils/jobs'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  operationId: z.string().trim().min(1).max(120)
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)

  return await executeTestPackOperation(
    params.id,
    params.operationId,
    async (payload) => {
      const created = await createJob('adapter-operation', payload)
      return { id: created.id }
    },
    async (message) => {
      console.info(`[adapter-op][testPack:${params.id}][${params.operationId}] ${message}`)
    }
  )
})
