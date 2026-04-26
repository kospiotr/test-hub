<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TestEntity } from '~/types'

defineProps<{
  tests: TestEntity[]
  loading?: boolean
}>()

const columns: TableColumn<TestEntity>[] = [{
  accessorKey: 'id',
  header: 'ID'
}, {
  accessorKey: 'name',
  header: 'Name'
}, {
  accessorKey: 'testPackName',
  header: 'Test Pack'
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
  id: 'run',
  header: 'Run',
  cell: () => h(resolveComponent('UButton'), {
    label: 'Run',
    icon: 'i-lucide-play',
    color: 'success',
    size: 'xs'
  })
}]

const pagination = ref({ pageIndex: 0, pageSize: 10 })
</script>

<template>
  <UTable
    v-model:pagination="pagination"
    :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
    :columns="columns"
    :data="tests"
    :loading="loading"
  />
</template>
