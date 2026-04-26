import { listAdapters } from '../../utils/adapters'

export default defineEventHandler(async () => {
  return listAdapters()
})
