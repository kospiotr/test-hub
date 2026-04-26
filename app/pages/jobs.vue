<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Job } from '~/types'

const table = useTemplateRef('table')
const UBadge = resolveComponent('UBadge')

const selectedJob = ref<Job | null>(null)
const detailsOpen = ref(false)
const autoRefresh = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const { data, status, refresh } = await useFetch<Job[]>('/api/jobs', {
  lazy: true,
  default: () => []
})

const columns: TableColumn<Job>[] = [{
  accessorKey: 'id',
  header: 'ID'
}, {
  accessorKey: 'type',
  header: 'Type'
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => {
    const color = {
      queued: 'warning',
      running: 'warning',
      succeeded: 'success',
      failed: 'error',
      cancelled: 'neutral'
    }[row.original.status] as 'warning' | 'success' | 'error' | 'neutral'

    return h(UBadge, { color, variant: 'subtle', class: 'capitalize' }, () => row.original.status)
  }
}, {
  accessorKey: 'attempts',
  header: 'Attempts'
}, {
  accessorKey: 'createdAt',
  header: 'Created',
  cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
}, {
  accessorKey: 'updatedAt',
  header: 'Updated',
  cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString()
}, {
  accessorKey: 'error',
  header: 'Error'
}, {
  id: 'details',
  header: 'Details',
  cell: ({ row }) => h(resolveComponent('UButton'), {
    label: 'View',
    icon: 'i-lucide-file-text',
    size: 'xs',
    variant: 'outline',
    onClick: () => {
      selectedJob.value = row.original
      detailsOpen.value = true
    }
  })
}]

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

async function refreshJobs() {
  await refresh()

  if (selectedJob.value) {
    selectedJob.value = data.value.find(item => item.id === selectedJob.value?.id) || null
    if (!selectedJob.value) {
      detailsOpen.value = false
    }
  }
}

onMounted(() => {
  refreshTimer = setInterval(() => {
    if (!autoRefresh.value) {
      return
    }

    void refreshJobs()
  }, 2000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

const prettyPayload = computed(() => {
  const raw = selectedJob.value?.payload
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
  const raw = selectedJob.value?.output
  if (!raw) {
    return ''
  }

  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})
</script>

<template>
  <UDashboardPanel id="jobs">
    <template #header>
      <UDashboardNavbar title="Jobs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex justify-end">
          <div class="flex items-center gap-2">
            <UCheckbox v-model="autoRefresh" label="Auto refresh" />
            <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshJobs" />
          </div>
        </div>

        <UTable
          ref="table"
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :columns="columns"
          :data="data"
          :loading="status === 'pending'"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }"
        />

        <UModal v-model:open="detailsOpen" title="Job details" :description="selectedJob ? `Job #${selectedJob.id}` : undefined" :ui="{ content: 'sm:max-w-4xl' }">
          <template #body>
            <div v-if="selectedJob" class="space-y-4">
              <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div><span class="font-medium">Type:</span> {{ selectedJob.type }}</div>
                <div><span class="font-medium">Status:</span> {{ selectedJob.status }}</div>
                <div><span class="font-medium">Attempts:</span> {{ selectedJob.attempts }}</div>
                <div><span class="font-medium">Updated:</span> {{ new Date(selectedJob.updatedAt).toLocaleString() }}</div>
              </div>

              <UFormField label="Payload" class="w-full">
                <UTextarea :model-value="prettyPayload" :rows="8" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
              </UFormField>

              <UFormField label="Logs" class="w-full">
                <UTextarea :model-value="selectedJob.logs || 'No logs yet.'" :rows="14" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
              </UFormField>

              <UFormField label="Output" class="w-full">
                <UTextarea :model-value="prettyOutput || 'No output yet.'" :rows="10" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
              </UFormField>

              <UFormField label="Error" class="w-full">
                <UTextarea :model-value="selectedJob.error || 'No error.'" :rows="4" autoresize readonly class="w-full font-mono text-xs" :ui="{ base: 'w-full' }" />
              </UFormField>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
