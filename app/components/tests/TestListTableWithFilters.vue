<script setup lang="ts">
import type { TestEntity } from '~/types'
import TestsFiltersPanel from '~/components/tests/FiltersPanel.vue'
import TestListTable from '~/components/tests/TestListTable.vue'

const tests = ref<TestEntity[]>([])
const {selectedTestPackIds} = defineProps<{selectedTestPackIds?: number[]}>()
const filtersOpen = ref(false)
const selectedTestPackIdsRef = ref<number[]>(selectedTestPackIds || [])
const filterName = ref('')
const filterLabels = ref<string[]>([])
const filterExecutionStatuses = ref<string[]>([])
const filterExecutionStartedFrom = ref('')
const filterExecutionStartedTo = ref('')
const filterExecutionFinishedFrom = ref('')
const filterExecutionFinishedTo = ref('')

const testsPath = computed(() => {
  const search = new URLSearchParams()

  if (filterName.value.trim()) {
    search.set('name', filterName.value.trim())
  }

  for (const id of selectedTestPackIdsRef.value) {
    search.append('testPackId', String(id))
  }

  for (const label of filterLabels.value) {
    search.append('labels', label)
  }

  for (const status of filterExecutionStatuses.value) {
    search.append('executionStatus', status)
  }

  if (filterExecutionStartedFrom.value) {
    search.set('executionStartedFrom', new Date(filterExecutionStartedFrom.value).toISOString())
  }

  if (filterExecutionStartedTo.value) {
    search.set('executionStartedTo', new Date(filterExecutionStartedTo.value).toISOString())
  }

  if (filterExecutionFinishedFrom.value) {
    search.set('executionFinishedFrom', new Date(filterExecutionFinishedFrom.value).toISOString())
  }

  if (filterExecutionFinishedTo.value) {
    search.set('executionFinishedTo', new Date(filterExecutionFinishedTo.value).toISOString())
  }

  return `/api/tests?${search.toString()}`
})

const { data, status, refresh: refreshTests } = await useFetch<TestEntity[]>(testsPath, {
  default: () => [],
  watch: [testsPath]
})

const executionsPath = computed(() => {
  if (!tests.value.length) {
    return '/api/test-executions'
  }

  const search = new URLSearchParams()
  for (const test of tests.value) {
    search.append('testId', String(test.id))
  }

  return `/api/test-executions?${search.toString()}`
})

const { data: executions, refresh: refreshExecutions } = await useFetch<Array<{ testId: number, status: string, createdAt: string }>>(executionsPath, {
  default: () => [],
  watch: [executionsPath]
})


const latestExecutionByTestId = computed(() => {
  const map = new Map<number, Array<{ status: string, createdAt: string }>>()

  for (const item of executions.value || []) {
    const current = map.get(item.testId) || []
    if (current.length < 10) {
      current.push({ status: item.status, createdAt: item.createdAt })
      map.set(item.testId, current)
    }
  }

  return map
})

watch(data, (value) => {
  tests.value = value || []
}, { immediate: true })

const refreshData = async ()=>{
  await Promise.all([refreshTests(), refreshExecutions()])
}

</script>

<template>
  <UDashboardPanel id="tests">
    <template #header>
      <UDashboardNavbar title="Tests">
        <template #leading>
          <slot name="leading"/>
        </template>
        <template #right>
          <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshData" />
          <UButton
            :label="filtersOpen ? 'Hide Filters' : 'Show Filters'"
            icon="i-lucide-sliders-horizontal"
            variant="outline"
            @click="filtersOpen = !filtersOpen"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <TestsFiltersPanel
        v-model:open="filtersOpen"
        v-model:selected-test-pack-ids="selectedTestPackIdsRef"
        v-model:filter-name="filterName"
        v-model:filter-labels="filterLabels"
        v-model:filter-execution-statuses="filterExecutionStatuses"
        v-model:filter-execution-started-from="filterExecutionStartedFrom"
        v-model:filter-execution-started-to="filterExecutionStartedTo"
        v-model:filter-execution-finished-from="filterExecutionFinishedFrom"
        v-model:filter-execution-finished-to="filterExecutionFinishedTo"
      />

      <TestListTable :tests="tests" :loading="status === 'pending'" :latest-execution-by-test-id="latestExecutionByTestId" />
    </template>
  </UDashboardPanel>
  <div>

  </div>
</template>
