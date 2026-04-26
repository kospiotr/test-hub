<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TestEntity, TestExecution, TestPack } from '~/types'
import TestListTable from '~/components/tests/TestListTable.vue'

const UBadge = resolveComponent('UBadge')
const toast = useToast()

const selectedTestPackId = ref<number | null>(null)
const selectedTestPack = computed(() => (testPacks.value || []).find(pack => pack.id === selectedTestPackId.value) || null)

const { data: testPacks } = await useFetch<TestPack[]>('/api/test-packs', {
  default: () => []
})

const testPackOptions = computed(() => (testPacks.value || []).map(testPack => ({
  label: testPack.name,
  value: testPack.id
})))

watch(() => testPackOptions.value, (items) => {
  if (!selectedTestPackId.value && items.length) {
    selectedTestPackId.value = items[0]?.value ?? null
  }
}, { immediate: true })

const testsPath = computed(() => selectedTestPackId.value ? `/api/tests?testPackId=${selectedTestPackId.value}` : '/api/tests')
const executionsPath = computed(() => selectedTestPackId.value ? `/api/test-executions?testPackId=${selectedTestPackId.value}` : '/api/test-executions')

const { data: tests, status: testsStatus, refresh: refreshTests } = await useFetch<TestEntity[]>(testsPath, {
  default: () => [],
  watch: [testsPath]
})

const { data: executions, status: execStatus, refresh: refreshExecutions } = await useFetch<TestExecution[]>(executionsPath, {
  default: () => [],
  watch: [executionsPath]
})

async function runAllTests() {
  if (!selectedTestPackId.value) {
    return
  }

  const loadTestsOperation = selectedTestPack.value?.operations?.find(op => op.id === 'load-tests')
  if (!loadTestsOperation) {
    toast.add({ title: 'Not supported', description: 'Selected adapter does not expose Load Tests operation.', color: 'warning' })
    return
  }

  const job = await $fetch<{ jobId?: number }>(`/api/test-packs/${selectedTestPackId.value}/operations/load-tests`, { method: 'POST' })

  toast.add({ title: 'Job queued', description: `Load tests job #${job.jobId ?? '-'} queued.`, color: 'success' })
}

const executionColumns: TableColumn<TestExecution>[] = [{
  accessorKey: 'id',
  header: 'ID'
}, {
  accessorKey: 'testId',
  header: 'Test ID'
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => {
    const color = row.original.status === 'completed' ? 'success' : row.original.status === 'failed' ? 'error' : 'warning'
    return h(UBadge, { color, variant: 'subtle' }, () => row.original.status)
  }
}, {
  accessorKey: 'createdAt',
  header: 'Created',
  cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
}]

const executionPagination = ref({ pageIndex: 0, pageSize: 10 })

const selectedTestPackModel = computed<number | undefined>({
  get: () => selectedTestPackId.value ?? undefined,
  set: (value) => {
    selectedTestPackId.value = value ?? null
  }
})

async function refreshData() {
  await Promise.all([refreshTests(), refreshExecutions()])
}
</script>

<template>
  <UDashboardPanel id="tests">
    <template #header>
      <UDashboardNavbar title="Tests">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">
        <div class="flex flex-wrap items-center gap-2">
          <USelect v-model="selectedTestPackModel" :items="testPackOptions" class="min-w-96" placeholder="Select test pack" />
          <UButton label="Load Tests" icon="i-lucide-list-checks" @click="runAllTests" />
          <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshData" />
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-highlighted">Discovered Tests</h3>
          <TestListTable :tests="tests" :loading="testsStatus === 'pending'" />
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-highlighted">Test Executions</h3>
          <UTable
            v-model:pagination="executionPagination"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :columns="executionColumns"
            :data="executions"
            :loading="execStatus === 'pending'"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
