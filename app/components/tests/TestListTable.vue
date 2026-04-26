<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import type { TestEntity } from '~/types'

const {tests, latestExecutionByTestId} = defineProps<{
  tests: TestEntity[],
  latestExecutionByTestId: Map<number, Array<{ status: string, createdAt: string }>>,
  loading?: boolean
}>()

const toast = useToast()

async function runSingleTest(test: TestEntity) {
  try {
    const result = await $fetch<{ jobId?: number, message?: string }>('/api/tests/operations/run-tests', {
      method: 'POST',
      body: {
        testIds: [test.id]
      }
    })

    toast.add({
      title: 'Run queued',
      description: result.message || `Run-tests job #${result.jobId ?? '-'} queued.`,
      color: 'success'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue run.'
    toast.add({
      title: 'Run failed',
      description: message,
      color: 'error'
    })
  }
}

const columns: TableColumn<TestEntity>[] = [{
  accessorKey: 'name',
  header: 'Name'
}, {
  id: 'lastExecutionTime',
  header: 'Last Execution Time',
  cell: ({ row }) => {
    const latest = latestExecutionByTestId.get(row.original.id)?.[0]
    return latest?.createdAt ? new Date(latest.createdAt).toLocaleString() : '-'
  }
}, {
  accessorKey: 'testPackLabels',
  header: 'Labels',
  cell: ({ row }) => {
    const labels = row.original.testPackLabels || []
    if (!labels.length) {
      return '-'
    }

    return h('div', { class: 'flex flex-wrap gap-1' }, labels.map(label =>
      h(resolveComponent('UBadge'), { variant: 'subtle', color: 'neutral' }, () => label)
    ))
  }
}, {
  id: 'latestExecutions',
  header: 'Latest Executions',
  cell: ({ row }) => {
    const items = latestExecutionByTestId.get(row.original.id) || []
    if (!items.length) {
      return '-'
    }

    return h('div', { class: 'flex items-center gap-1.5' }, items.map((item, index) => {
      const icon = item.status === 'passed'
        ? 'i-lucide-circle-check-big'
        : item.status === 'failed'
          ? 'i-lucide-circle-x'
          : item.status === 'skipped'
            ? 'i-lucide-circle-dot'
            : 'i-lucide-circle'

      const colorClass = item.status === 'passed'
        ? 'text-success'
        : item.status === 'failed'
          ? 'text-error'
          : item.status === 'skipped'
            ? 'text-warning'
            : 'text-muted'

      return h(resolveComponent('UTooltip'), { text: `${item.status} • ${new Date(item.createdAt).toLocaleString()}` }, {
        default: () => h(resolveComponent('UIcon'), {
          key: `${row.original.id}-${index}`,
          name: icon,
          class: `size-4 ${colorClass}`
        })
      })
    }))
  }
}, {
  id: 'run',
  header: 'Run',
  cell: ({ row }) => h(resolveComponent('UButton'), {
    label: 'Run',
    icon: 'i-lucide-play',
    color: 'primary',
    size: 'xs',
    onClick: () => runSingleTest(row.original)
  })
}]

function onRowSelect(event: Event, row: Row<TestEntity>) {
  const target = event?.target as HTMLElement | null
  if (target?.closest('button, a, input, [role="menuitem"], [role="checkbox"]')) {
    return
  }

  void navigateTo(`/tests/${row.original.id}`)
}

</script>

<template>
  <UTable
    :columns="columns"
    :data="tests"
    :loading="loading"
    @select="onRowSelect"
  />
</template>
