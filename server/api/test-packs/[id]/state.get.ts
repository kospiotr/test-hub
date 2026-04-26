import { z } from 'zod'
import { resolveTestPackState } from '../../../utils/adapters'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)
  return await resolveTestPackState(params.id)
})
