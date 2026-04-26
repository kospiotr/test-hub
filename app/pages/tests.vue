<script setup lang="ts">
import type {TestEntity, TestPack} from '~/types'
import TestListTable from '~/components/tests/TestListTable.vue'

const selectedTestPackIds = ref<number[]>([])

const {data: testPacks} = await useFetch<TestPack[]>('/api/test-packs', {
  default: () => []
})

const testPackOptions = computed(() => (testPacks.value || []).map(testPack => ({
  label: testPack.name,
  value: testPack.id
})))

const testsPath = computed(() => {
  if (!selectedTestPackIds.value.length) {
    return '/api/tests'
  }

  const search = new URLSearchParams()
  for (const id of selectedTestPackIds.value) {
    search.append('testPackId', String(id))
  }

  return `/api/tests?${search.toString()}`
})

const {data: tests, status: testsStatus, refresh: refreshTests} = await useFetch<TestEntity[]>(testsPath, {
  default: () => [],
  watch: [testsPath]
})

async function refreshData() {
  await refreshTests()
}
</script>

<template>
  <UDashboardPanel id="tests">
    <template #header>
      <UDashboardNavbar title="Tests">
        <template #leading>
          <UDashboardSidebarCollapse/>
        </template>
        <template #right>

          <USelectMenu
            v-model="selectedTestPackIds"
            :items="testPackOptions"
            value-key="value"
            class="min-w-96"
            placeholder="All test packs"
            multiple
          />
          <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshData"/>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <TestListTable :tests="tests" :loading="testsStatus === 'pending'"/>
    </template>
  </UDashboardPanel>
</template>
