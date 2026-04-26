import { startJobWorker } from '../utils/jobs'

export default defineNitroPlugin(() => {
  startJobWorker()
})
