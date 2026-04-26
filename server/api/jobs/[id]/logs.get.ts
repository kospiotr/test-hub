import { z } from 'zod'
import { readJobLog } from '../../../utils/job-logs'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).optional()
})

export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(event.context.params)
  const query = querySchema.parse(getQuery(event))

  const result = await readJobLog(params.id, query.offset || 0)

  return {
    ...result,
    offset: query.offset || 0
  }
})
