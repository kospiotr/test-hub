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
  accessorKey: 'path',
  header: 'Path',
  cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, row.original.path)
}, {
  accessorKey: 'nodeId',
  header: 'Node ID',
  cell: ({ row }) => h('span', { class: 'font-mono text-xs break-all' }, row.original.nodeId)
}, {
  accessorKey: 'imageVersion',
  header: 'Image Version'
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
