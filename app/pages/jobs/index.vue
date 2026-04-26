<script setup lang="ts">
import type { Job } from '~/types'
import JobsTable from '~/components/jobs/JobsTable.vue'

const autoRefresh = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const { data, status, refresh } = await useFetch<Job[]>('/api/jobs', {
  lazy: true,
  default: () => []
})

async function refreshJobs() {
  await refresh()
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

</script>

<template>
  <UDashboardPanel id="jobs">
    <template #header>
      <UDashboardNavbar title="Jobs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UCheckbox v-model="autoRefresh" label="Auto refresh" />
          <UButton label="Refresh" icon="i-lucide-refresh-cw" variant="outline" @click="refreshJobs" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
        <JobsTable :jobs="data" :loading="status === 'pending'" />
    </template>
  </UDashboardPanel>
</template>
