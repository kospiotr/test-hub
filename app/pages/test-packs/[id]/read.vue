<script setup lang="ts">
import * as z from 'zod'
import type { TabsItem } from '@nuxt/ui'
import type { Job, TestEntity, TestPack } from '~/types'
import TestListTable from '~/components/tests/TestListTable.vue'
import JobsTable from '~/components/jobs/JobsTable.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const idSchema = z.coerce.number().int().positive()
const testPackId = idSchema.parse(route.params.id)

const activeTab = ref<'summary' | 'operations' | 'tests'>('summary')
const selectedOperationId = ref<string | 'all'>('all')

function parseTabHash(hash: string) {
  const value = hash.replace(/^#/, '')
  if (value === 'summary' || value === 'operations' || value === 'tests') {
    return value
  }

  return null
}

watch(() => route.query.tab, (tab) => {
  if (tab === 'summary' || tab === 'operations' || tab === 'tests') {
    activeTab.value = tab
  }
}, { immediate: true })

watch(() => route.hash, (hash) => {
  const tab = parseTabHash(hash)
  if (tab) {
    activeTab.value = tab
  }
}, { immediate: true })

watch(activeTab, async (tab) => {
  const nextHash = `#${tab}`
  if (route.hash === nextHash) {
    return
  }

  await router.push({
    path: route.path,
    query: route.query,
    hash: nextHash
  })
})

watch(() => route.query.operationId, (operationId) => {
  if (typeof operationId === 'string' && operationId.trim()) {
    selectedOperationId.value = operationId
    activeTab.value = 'operations'
  }
}, { immediate: true })

const { data: testPack, status: testPackStatus, refresh: refreshTestPack } = await useFetch<TestPack>(`/api/test-packs/${testPackId}`, {
  default: () => ({
    id: testPackId,
    name: '',
    labels: [],
    description: '',
    documentation: '',
    adapterId: '',
    configuration: {},
    state: {
      adapterId: '',
      validationChecks: [],
      states: []
    },
    operations: [],
    testsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
})

const testPackOperations = computed(() => (testPack.value.operations || []).filter(op => op.scope === 'test-pack'))

const tabs = computed(() => [{
  label: 'Summary',
  value: 'summary',
  icon: 'i-lucide-file-text'
}, {
  label: 'Operations',
  value: 'operations',
  icon: 'i-lucide-wrench',
  badge: testPackOperations.value.length
}, {
  label: 'Tests',
  value: 'tests',
  icon: 'i-lucide-list-checks',
  badge: testPack.value.testsCount
}] satisfies TabsItem[])

const operationFilterOptions = computed(() => [
  { label: 'All operations', value: 'all' },
  ...testPackOperations.value.map(op => ({ label: op.label, value: op.id }))
])

watch([testPackOperations, selectedOperationId], ([operations, selected]) => {
  if (selected === 'all') {
    return
  }

  const exists = operations.some(op => op.id === selected)
  if (!exists) {
    selectedOperationId.value = 'all'
  }
}, { immediate: true })

const jobsPath = computed(() => {
  const search = new URLSearchParams({ testPackId: String(testPackId) })
  if (selectedOperationId.value !== 'all') {
    search.set('operationId', selectedOperationId.value)
  }

  return `/api/jobs?${search.toString()}`
})

const { data: jobs, status: jobsStatus, refresh: refreshJobs } = await useFetch<Job[]>(jobsPath, {
  default: () => [],
  watch: [jobsPath]
})

const { data: tests, status: testsStatus, refresh: refreshTests } = await useFetch<TestEntity[]>(`/api/tests?testPackId=${testPackId}`, {
  default: () => []
})

const selectedOperationModel = computed<string>({
  get: () => selectedOperationId.value,
  set: (value) => {
    selectedOperationId.value = value as string | 'all'
  }
})

const summaryRows = computed(() => [
  { label: 'Name', value: testPack.value.name },
  { label: 'Adapter', value: testPack.value.adapterId },
  { label: 'Created', value: new Date(testPack.value.createdAt).toLocaleString() },
  { label: 'Updated', value: new Date(testPack.value.updatedAt).toLocaleString() }
])

const configurationEntries = computed(() => Object.entries(testPack.value.configuration || {}))

async function refreshOperationsJobs() {
  await refreshJobs()
}

async function refreshAssociatedTests() {
  await refreshTests()
}

async function runOperation(operationId: string, operationLabel: string) {
  const result = await $fetch<{ message?: string }>(`/api/test-packs/${testPackId}/operations/${operationId}`, {
    method: 'POST'
  })

  toast.add({
    title: operationLabel,
    description: result.message || `${operationLabel} triggered.`,
    color: 'success'
  })

  await Promise.all([refreshTestPack(), refreshJobs(), refreshTests()])
}
</script>

<template>
  <UDashboardPanel id="test-pack-read">
    <template #header>
      <UDashboardNavbar :title="`Test Pack: ${testPack.name}`" :ui="{ right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-pencil"
            label="Edit"
            color="neutral"
            variant="outline"
            :to="`/test-packs/${testPackId}/edit`"
          />
          <UButton
            icon="i-lucide-flask-conical"
            label="Test Packs"
            color="neutral"
            variant="ghost"
            to="/test-packs"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="testPackStatus === 'pending'" class="text-sm text-muted">Loading test pack...</div>

      <div v-else class="space-y-6">
        <UTabs v-model="activeTab" :items="tabs" />

        <div v-if="activeTab === 'summary'" class="space-y-6">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div v-for="item in summaryRows" :key="item.label" class="rounded-md border border-default p-3">
              <div class="text-xs text-muted">{{ item.label }}</div>
              <div class="font-medium">{{ item.value || '-' }}</div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="font-semibold text-highlighted">Labels</h3>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="label in testPack.labels" :key="label" variant="subtle" color="neutral">{{ label }}</UBadge>
              <span v-if="!testPack.labels.length" class="text-sm text-muted">No labels</span>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="font-semibold text-highlighted">Configuration</h3>
            <div class="rounded-md border border-default divide-y divide-default">
              <div v-for="entry in configurationEntries" :key="entry[0]" class="grid grid-cols-3 gap-3 p-3">
                <div class="text-sm text-muted">{{ entry[0] }}</div>
                <div class="col-span-2 font-mono text-xs break-all">{{ String(entry[1]) }}</div>
              </div>
              <div v-if="!configurationEntries.length" class="p-3 text-sm text-muted">No configuration values</div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="font-semibold text-highlighted">Validation Checks</h3>
            <div class="rounded-md border border-default divide-y divide-default">
              <div v-for="item in testPack.state.validationChecks" :key="item.key" class="grid grid-cols-4 gap-3 p-3">
                <div class="col-span-3 text-sm">{{ item.description }}</div>
                <div class="flex justify-end">
                  <UBadge :color="item.status === 'ok' ? 'success' : 'error'" variant="subtle" class="capitalize">
                    {{ item.status }}
                  </UBadge>
                </div>
              </div>
              <div v-if="!testPack.state.validationChecks.length" class="p-3 text-sm text-muted">No validation checks</div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="font-semibold text-highlighted">Adapter State</h3>
            <div class="rounded-md border border-default divide-y divide-default">
              <div v-for="item in testPack.state.states" :key="item.key" class="grid grid-cols-3 gap-3 p-3">
                <div class="text-sm text-muted">{{ item.label }}</div>
                <div class="col-span-2 font-medium">{{ item.value }}</div>
              </div>
              <div v-if="!testPack.state.states.length" class="p-3 text-sm text-muted">No state values</div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'operations'" class="space-y-6">
          <div class="space-y-3">
            <h3 class="font-semibold text-highlighted">Operations</h3>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-for="operation in testPackOperations"
                :key="operation.id"
                :label="operation.label"
                icon="i-lucide-play"
                @click="runOperation(operation.id, operation.label)"
              />
              <span v-if="!testPackOperations.length" class="text-sm text-muted">No operations for this adapter.</span>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-highlighted">Jobs</h3>
              <div class="flex items-center gap-2">
                <USelect v-model="selectedOperationModel" :items="operationFilterOptions" class="min-w-64" />
                <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshOperationsJobs" />
              </div>
            </div>

            <JobsTable :jobs="jobs" :loading="jobsStatus === 'pending'" />
          </div>
        </div>

        <div v-if="activeTab === 'tests'" class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-highlighted">Associated Tests</h3>
            <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshAssociatedTests" />
          </div>

          <TestListTable :tests="tests" :loading="testsStatus === 'pending'" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
