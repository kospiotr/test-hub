<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { Job } from '~/types'

defineProps<{
  jobs: Job[]
  loading?: boolean
}>()

const table = useTemplateRef('table')
const UBadge = resolveComponent('UBadge')

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
  accessorKey: 'createdAt',
  header: 'Created',
  cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
}, {
  accessorKey: 'updatedAt',
  header: 'Updated',
  cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString()
}]

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

function onRowSelect(event: Event, row: Row<Job>) {
  const target = event?.target as HTMLElement | null
  if (target?.closest('button, a, input, [role="menuitem"], [role="checkbox"]')) {
    return
  }

  void navigateTo(`/jobs/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <UTable
      ref="table"
      v-model:pagination="pagination"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :columns="columns"
      :data="jobs"
      :loading="loading"
      @select="onRowSelect"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    />
  </div>
</template>
