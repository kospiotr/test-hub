<script setup lang="ts">
import * as z from 'zod'
import type { Job } from '~/types'

const route = useRoute()

const idSchema = z.coerce.number().int().positive()
const jobId = idSchema.parse(route.params.id)

const fallbackJob: Job = {
  id: jobId,
  type: '',
  status: 'queued',
  payload: '',
  output: '',
  error: '',
  attempts: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const { data: job, status, refresh } = await useFetch<Job>(`/api/jobs/${jobId}`, {
  default: () => fallbackJob
})

const jobData = computed<Job>(() => job.value || fallbackJob)
const logsOffset = ref(0)
const logsContent = ref('')
const logsTextareaRef = ref<HTMLTextAreaElement | null>(null)
let eventSource: EventSource | null = null

// const autoRefresh = ref(true)
// let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // void refreshLogs(true)
  startLogsStream(true)
  //
  // refreshTimer = setInterval(() => {
  //   if (!autoRefresh.value) {
  //     return
  //   }
  //
  //   void refresh()
  // }, 2000)
})

// onBeforeUnmount(() => {
//   stopLogsStream()
//
//   if (refreshTimer) {
//     clearInterval(refreshTimer)
//     refreshTimer = null
//   }
// })

// watch(autoRefresh, (enabled) => {
//   if (enabled) {
//     startLogsStream(false)
//     return
//   }
//
//   stopLogsStream()
// })

const prettyPayload = computed(() => {
  const raw = jobData.value.payload
  if (!raw) {
    return ''
  }

  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const prettyOutput = computed(() => {
  const raw = jobData.value.output
  if (!raw) {
    return ''
  }

  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const statusColor = computed(() => ({
  queued: 'warning',
  running: 'warning',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'neutral'
}[jobData.value.status] as 'warning' | 'success' | 'error' | 'neutral'))

async function refreshJob() {
  await refresh()
  await refreshLogs(true)
}

async function refreshLogs(reset: boolean) {
  const targetOffset = reset ? 0 : logsOffset.value
  const response = await $fetch<{ content: string, nextOffset: number, exists: boolean }>(`/api/jobs/${jobId}/logs`, {
    query: {
      offset: targetOffset
    }
  })

  if (reset) {
    logsContent.value = response.content
  } else {
    logsContent.value = `${logsContent.value}${response.content}`
  }

  logsOffset.value = response.nextOffset
  await nextTick()
  scrollLogsToBottom()
}

function startLogsStream(reset: boolean) {
  stopLogsStream()

  const offset = reset ? 0 : logsOffset.value
  const search = new URLSearchParams({ offset: String(offset) })
  eventSource = new EventSource(`/api/jobs/${jobId}/logs/stream?${search.toString()}`)

  eventSource.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data) as { chunk: string, nextOffset: number }
      if (!data.chunk) {
        return
      }

      if (reset && logsOffset.value === 0) {
        logsContent.value = data.chunk
      } else {
        logsContent.value = `${logsContent.value}${data.chunk}`
      }

      logsOffset.value = data.nextOffset
      await nextTick()
      scrollLogsToBottom()
    } catch {
      // ignore malformed event payloads
    }
  }

  eventSource.onerror = () => {
    stopLogsStream()
    startLogsStream(false)
    // if (autoRefresh.value) {
    //   setTimeout(() => {
    //     startLogsStream(false)
    //   }, 1500)
    // }
  }
}

function stopLogsStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function scrollLogsToBottom() {
  const textarea = logsTextareaRef.value
  if (!textarea) {
    return
  }

  textarea.scrollTop = textarea.scrollHeight
}
</script>

<template>
  <UDashboardPanel id="job-details">
    <template #header>
      <UDashboardNavbar :title="`Job #${jobData.id}`" :ui="{ right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-briefcase-business"
            label="Jobs"
            color="neutral"
            variant="ghost"
            to="/jobs"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="text-sm text-muted">Loading job...</div>

      <div v-else class="space-y-4 max-w-5xl">
        <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><span class="font-medium">Type:</span> {{ jobData.type }}</div>
          <div class="flex items-center gap-2">
            <span class="font-medium">Status:</span>
            <UBadge :color="statusColor" variant="subtle" class="capitalize">{{ jobData.status }}</UBadge>
          </div>
          <div><span class="font-medium">Attempts:</span> {{ jobData.attempts }}</div>
          <div><span class="font-medium">Created:</span> {{ new Date(jobData.createdAt).toLocaleString() }}</div>
          <div><span class="font-medium">Updated:</span> {{ new Date(jobData.updatedAt).toLocaleString() }}</div>
          <div><span class="font-medium">Started:</span> {{ jobData.startedAt ? new Date(jobData.startedAt).toLocaleString() : '-' }}</div>
          <div><span class="font-medium">Finished:</span> {{ jobData.finishedAt ? new Date(jobData.finishedAt).toLocaleString() : '-' }}</div>
        </div>

        <UFormField label="Payload" class="w-full">
          <UTextarea :model-value="prettyPayload" :rows="8" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
        </UFormField>

        <UFormField label="Logs" class="w-full">
          <UTextarea ref="logsTextareaRef" :model-value="logsContent || 'No logs yet.'" :rows="16" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
        </UFormField>

        <UFormField label="Output" class="w-full">
          <UTextarea :model-value="prettyOutput || 'No output yet.'" :rows="10" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
        </UFormField>

        <UFormField label="Error" class="w-full">
          <UTextarea :model-value="jobData.error || 'No error.'" :rows="4" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
        </UFormField>
      </div>
    </template>
  </UDashboardPanel>
</template>
