import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from './db'
import { jobs } from '../db/schema'
import { runAdapterOperationFromJob } from './adapters'

export type JobType = 'adapter-operation'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

type AdapterOperationPayload = {
  testPackId: number
  operationId: string
}

const adapterOperationPayloadSchema = z.object({
  testPackId: z.coerce.number().int().positive(),
  operationId: z.string().trim().min(1).max(120)
})

const MAX_LOG_LENGTH = 100_000

function trimLogs(logs: string) {
  if (logs.length <= MAX_LOG_LENGTH) {
    return logs
  }

  return logs.slice(logs.length - MAX_LOG_LENGTH)
}

function formatLogEntry(message: string) {
  return `[${new Date().toISOString()}] ${message}`
}

function parsePayload(payload: string): AdapterOperationPayload {
  try {
    return adapterOperationPayloadSchema.parse(JSON.parse(payload))
  } catch {
    throw new Error('Failed to parse job payload JSON.')
  }
}

async function appendJobLog(jobId: number, message: string) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) })

  if (!job) {
    return
  }

  const nextLogs = trimLogs(`${job.logs || ''}${formatLogEntry(message)}\n`)

  await db.update(jobs)
    .set({
      logs: nextLogs,
      updatedAt: new Date()
    })
    .where(eq(jobs.id, jobId))
}

async function logJob(jobId: number, message: string) {
  console.info(`[jobs][${jobId}] ${message}`)
  await appendJobLog(jobId, message)
}

async function completeJob(jobId: number, status: JobStatus, output?: string, error?: string) {
  await db.update(jobs)
    .set({
      status,
      output,
      error,
      finishedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(jobs.id, jobId))

  console.info(`[jobs][${jobId}] completed with status=${status}`)
}

async function failJob(jobId: number, message: string, output?: string) {
  console.error(`[jobs][${jobId}] ${message}`)
  await appendJobLog(jobId, `ERROR: ${message}`)
  await completeJob(jobId, 'failed', output, message)
}

export async function createJob(type: JobType, payload: AdapterOperationPayload) {
  const now = new Date()
  const createdLog = `${formatLogEntry(`Job created with type=${type}`)}\n`

  const [created] = await db.insert(jobs).values({
    type,
    status: 'queued',
    payload: JSON.stringify(payload),
    logs: createdLog,
    attempts: 0,
    createdAt: now,
    updatedAt: now
  }).returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create job.' })
  }

  console.info(`[jobs][${created.id}] queued (${type})`)
  return created
}

async function claimNextJob() {
  const nextJob = await db.query.jobs.findFirst({
    where: eq(jobs.status, 'queued'),
    orderBy: asc(jobs.createdAt)
  })

  if (!nextJob) {
    return null
  }

  const [claimed] = await db.update(jobs)
    .set({
      status: 'running',
      attempts: nextJob.attempts + 1,
      startedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(jobs.id, nextJob.id))
    .returning()

  if (claimed) {
    await logJob(claimed.id, `Claimed for execution (attempt ${claimed.attempts}).`)
  }

  return claimed || null
}

async function processAdapterOperationJob(jobId: number, payload: AdapterOperationPayload) {
  await logJob(jobId, `Processing operation=${payload.operationId} for testPackId=${payload.testPackId}.`)

  const result = await runAdapterOperationFromJob(
    payload.testPackId,
    payload.operationId,
    async (message) => await logJob(jobId, message)
  )
  await logJob(jobId, `Operation ${payload.operationId} succeeded.`)

  return {
    output: JSON.stringify(result)
  }
}

let isWorkerRunning = false

async function processSingleJob() {
  const job = await claimNextJob()
  if (!job) {
    return
  }

  try {
    await logJob(job.id, `Dispatching job handler for type=${job.type}.`)

    if (job.type === 'adapter-operation') {
      const payload = parsePayload(job.payload)
      const result = await processAdapterOperationJob(job.id, payload)
      await completeJob(job.id, 'succeeded', result.output)
      return
    }

    throw new Error(`Unsupported job type: ${job.type}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown job failure'

    try {
      await failJob(job.id, message)
    } catch (innerError) {
      const fallbackMessage = innerError instanceof Error ? innerError.message : 'Unknown fallback failure'
      console.error(`[jobs][${job.id}] Failed to persist failed status: ${fallbackMessage}`)

      await db.update(jobs)
        .set({
          status: 'failed',
          error: `${message}; fallback: ${fallbackMessage}`,
          finishedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(jobs.id, job.id))
    }
  }
}

async function workerLoop() {
  if (isWorkerRunning) {
    return
  }

  isWorkerRunning = true
  console.info('[jobs] Worker loop started')

  while (isWorkerRunning) {
    try {
      await processSingleJob()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[jobs] Worker loop error: ${message}`)
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

export function startJobWorker() {
  console.info('[jobs] startJobWorker called')
  void workerLoop()
}
