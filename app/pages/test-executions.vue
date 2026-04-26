<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TestExecution, TestPack } from '~/types'

const UBadge = resolveComponent('UBadge')

const selectedTestPackIds = ref<number[]>([])

const { data: testPacks } = await useFetch<TestPack[]>('/api/test-packs', {
  default: () => []
})

const testPackOptions = computed(() => (testPacks.value || []).map(testPack => ({
  label: testPack.name,
  value: testPack.id
})))

const executionsPath = computed(() => {
  if (!selectedTestPackIds.value.length) {
    return '/api/test-executions'
  }

  const search = new URLSearchParams()
  for (const id of selectedTestPackIds.value) {
    search.append('testPackId', String(id))
  }

  return `/api/test-executions?${search.toString()}`
})

const { data: executions, status, refresh } = await useFetch<TestExecution[]>(executionsPath, {
  default: () => [],
  watch: [executionsPath]
})

const columns: TableColumn<TestExecution>[] = [{
  accessorKey: 'id',
  header: 'ID'
}, {
  accessorKey: 'name',
  header: 'Test'
}, {
  accessorKey: 'nodeId',
  header: 'Node ID',
  cell: ({ row }) => h('span', { class: 'font-mono text-xs break-all' }, row.original.nodeId)
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => {
    const value = row.original.status
    const color = value === 'passed' ? 'success' : value === 'failed' ? 'error' : value === 'skipped' ? 'warning' : 'neutral'
    return h(UBadge, { color, variant: 'subtle', class: 'capitalize' }, () => value)
  }
}, {
  accessorKey: 'jobId',
  header: 'Job',
  cell: ({ row }) => {
    if (!row.original.jobId) {
      return '-'
    }

    return h(resolveComponent('UButton'), {
      label: `#${row.original.jobId}`,
      variant: 'ghost',
      size: 'xs',
      icon: 'i-lucide-briefcase-business',
      onClick: () => navigateTo(`/jobs/${row.original.jobId}`)
    })
  }
}, {
  accessorKey: 'startedAt',
  header: 'Started',
  cell: ({ row }) => row.original.startedAt ? new Date(row.original.startedAt).toLocaleString() : '-'
}, {
  accessorKey: 'finishedAt',
  header: 'Finished',
  cell: ({ row }) => row.original.finishedAt ? new Date(row.original.finishedAt).toLocaleString() : '-'
}]

const pagination = ref({ pageIndex: 0, pageSize: 10 })

async function refreshExecutions() {
  await refresh()
}
</script>

<template>
  <UDashboardPanel id="test-executions">
    <template #header>
      <UDashboardNavbar title="Test Executions">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <USelectMenu
            v-model="selectedTestPackIds"
            :items="testPackOptions"
            value-key="value"
            class="min-w-96"
            placeholder="All test packs"
            multiple
          />
          <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshExecutions" />
        </div>

        <UTable
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :columns="columns"
          :data="executions"
          :loading="status === 'pending'"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
