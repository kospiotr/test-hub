<script setup lang="ts">
import type { TestPack } from '~/types'

const open = defineModel<boolean>('open', { default: false })
const selectedTestPackIds = defineModel<number[]>('selectedTestPackIds', { default: () => [] })
const filterName = defineModel<string>('filterName', { default: '' })
const filterLabels = defineModel<string[]>('filterLabels', { default: () => [] })
const filterExecutionStatuses = defineModel<string[]>('filterExecutionStatuses', { default: () => [] })
const filterExecutionStartedFrom = defineModel<string>('filterExecutionStartedFrom', { default: '' })
const filterExecutionStartedTo = defineModel<string>('filterExecutionStartedTo', { default: '' })
const filterExecutionFinishedFrom = defineModel<string>('filterExecutionFinishedFrom', { default: '' })
const filterExecutionFinishedTo = defineModel<string>('filterExecutionFinishedTo', { default: '' })

const { data: testPacks } = await useFetch<TestPack[]>('/api/test-packs', {
  default: () => []
})

const testPackOptions = computed(() => (testPacks.value || []).map(testPack => ({
  label: testPack.name,
  value: testPack.id
})))

const labelOptions = computed(() => {
  const labels = new Set<string>()
  for (const pack of testPacks.value || []) {
    for (const label of pack.labels || []) {
      labels.add(label)
    }
  }

  return Array.from(labels).sort().map(label => ({ label, value: label }))
})

const executionStatusOptions = [
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Running', value: 'running' }
]

function clearAdvancedFilters() {
  selectedTestPackIds.value = []
  filterName.value = ''
  filterLabels.value = []
  filterExecutionStatuses.value = []
  filterExecutionStartedFrom.value = ''
  filterExecutionStartedTo.value = ''
  filterExecutionFinishedFrom.value = ''
  filterExecutionFinishedTo.value = ''
}
</script>

<template>
  <UCollapsible v-model:open="open">
    <template #content>
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-medium text-highlighted">Advanced Filters</h3>
          <UButton label="Clear" variant="outline" size="xs" icon="i-lucide-eraser" @click="clearAdvancedFilters" />
        </div>
      </template>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UFormField label="Test Packs">
          <USelectMenu
            v-model="selectedTestPackIds"
            :items="testPackOptions"
            value-key="value"
            class="w-full"
            placeholder="All test packs"
            multiple
          />
        </UFormField>

        <UFormField label="Name">
          <UInput v-model="filterName" placeholder="Search by test name" class="w-full" />
        </UFormField>

        <UFormField label="Labels">
          <USelectMenu
            v-model="filterLabels"
            :items="labelOptions"
            value-key="value"
            class="w-full"
            placeholder="Any labels"
            multiple
          />
        </UFormField>

        <UFormField label="Execution Status">
          <USelectMenu
            v-model="filterExecutionStatuses"
            :items="executionStatusOptions"
            value-key="value"
            class="w-full"
            placeholder="Any status"
            multiple
          />
        </UFormField>

        <UFormField label="Execution Start Time From">
          <UInput v-model="filterExecutionStartedFrom" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Execution Start Time To">
          <UInput v-model="filterExecutionStartedTo" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Execution End Time From">
          <UInput v-model="filterExecutionFinishedFrom" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Execution End Time To">
          <UInput v-model="filterExecutionFinishedTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UCard>
    </template>
  </UCollapsible>
</template>
