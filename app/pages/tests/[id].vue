<script setup lang="ts">
import * as z from 'zod'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TestEntity, TestExecution } from '~/types'

const route = useRoute()
const toast = useToast()

const idSchema = z.coerce.number().int().positive()
const testId = idSchema.parse(route.params.id)

const { data: test, status: testStatus, refresh: refreshTest } = await useFetch<TestEntity>(`/api/tests/${testId}`, {
  default: () => ({
    id: testId,
    testPackId: 0,
    testPackName: '',
    testPackLabels: [],
    imageVersion: '',
    nodeId: '',
    name: '',
    path: '',
    suite: '',
    operations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
})

const { data: executions, status: executionsStatus, refresh: refreshExecutions } = await useFetch<TestExecution[]>(`/api/test-executions?testId=${testId}`, {
  default: () => []
})

const columns: TableColumn<TestExecution>[] = [{
  accessorKey: 'id',
  header: 'ID'
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => {
    const value = row.original.status
    const color = value === 'passed' ? 'success' : value === 'failed' ? 'error' : value === 'skipped' ? 'warning' : 'neutral'
    return h(resolveComponent('UBadge'), { color, variant: 'subtle', class: 'capitalize' }, () => value)
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
      size: 'xs',
      variant: 'ghost',
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

const testOperations = computed(() => (test.value.operations || []).filter(op => op.scope === 'test'))

async function runOperation(operationId: string, operationLabel: string) {
  const result = await $fetch<{ message?: string }>(`/api/tests/operations/${operationId}`, {
    method: 'POST',
    body: {
      testIds: [testId]
    }
  })

  toast.add({
    title: operationLabel,
    description: result.message || `${operationLabel} queued.`,
    color: 'success'
  })

  await Promise.all([refreshTest(), refreshExecutions()])
}

async function refreshData() {
  await Promise.all([refreshTest(), refreshExecutions()])
}
</script>

<template>
  <UDashboardPanel id="test-details">
    <template #header>
      <UDashboardNavbar :title="`Test: ${test.name}`" :ui="{ right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-list-checks"
            label="Tests"
            color="neutral"
            variant="ghost"
            to="/tests"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="testStatus === 'pending'" class="text-sm text-muted">Loading test...</div>

      <div v-else class="space-y-6">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-md border border-default p-3">
            <div class="text-xs text-muted">Name</div>
            <div class="font-medium">{{ test.name }}</div>
          </div>
          <div class="rounded-md border border-default p-3">
            <div class="text-xs text-muted">Node</div>
            <div class="font-mono text-xs break-all">{{ test.nodeId }}</div>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-highlighted">Labels</h3>
          <div class="flex flex-wrap gap-2">
            <UBadge v-for="label in test.testPackLabels" :key="label" variant="subtle" color="neutral">{{ label }}</UBadge>
            <span v-if="!test.testPackLabels.length" class="text-sm text-muted">No labels</span>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-highlighted">Operations</h3>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="operation in testOperations"
              :key="operation.id"
              :label="operation.label"
              icon="i-lucide-play"
              color="primary"
              @click="runOperation(operation.id, operation.label)"
            />
            <span v-if="!testOperations.length" class="text-sm text-muted">No test-scope operations for this adapter.</span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-highlighted">Latest Executions</h3>
            <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshData" />
          </div>

          <UTable
            v-model:pagination="pagination"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :columns="columns"
            :data="executions"
            :loading="executionsStatus === 'pending'"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
