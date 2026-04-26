<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { TestPack } from '~/types'

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')

const columnFilters = ref([{
  id: 'name',
  value: ''
}])
const columnVisibility = ref({
  id: false
})
const rowSelection = ref<Record<number, boolean>>({})

const { data, status, refresh } = await useFetch<TestPack[]>('/api/test-packs', {
  lazy: true,
  default: () => []
})

function goToCreatePage() {
  return navigateTo('/test-packs/new')
}

async function deleteOne(pack: TestPack) {
  await $fetch(`/api/test-packs/${pack.id}`, { method: 'DELETE' })
  toast.add({ title: 'Deleted', description: `${pack.name} removed.`, color: 'success' })
  await refresh()
}

async function deleteSelected() {
  if (!table.value?.tableApi || !data.value) {
    return
  }

  const selectedIds = table.value.tableApi.getFilteredSelectedRowModel().rows.map(row => row.original.id)
  await Promise.all(selectedIds.map(id => $fetch(`/api/test-packs/${id}`, { method: 'DELETE' })))
  rowSelection.value = {}
  toast.add({ title: 'Deleted', description: `${selectedIds.length} test pack(s) removed.`, color: 'success' })
  await refresh()
}

function stateValue(pack: TestPack, key: string) {
  return pack.state.states.find(item => item.key === key)?.value || '-'
}

function getRowItems(row: Row<TestPack>) {
  const operationIds = new Set((row.original.operations || []).map(op => op.id))

  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'Copy test pack ID',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(row.original.id.toString())
        toast.add({
          title: 'Copied to clipboard',
          description: 'Test pack ID copied'
        })
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Edit test pack',
      icon: 'i-lucide-pencil',
      onSelect() {
        navigateTo(`/test-packs/${row.original.id}`)
      }
    },
    {
      label: 'Pull Image',
      icon: 'i-lucide-download',
      disabled: !operationIds.has('pull-image'),
      async onSelect() {
        await $fetch(`/api/test-packs/${row.original.id}/operations/pull-image`, { method: 'POST' })
        toast.add({ title: 'Image pulled', description: `${row.original.name} image pulled.`, color: 'success' })
        await refresh()
      }
    },
    {
      label: 'Load Tests',
      icon: 'i-lucide-list-checks',
      disabled: !operationIds.has('load-tests'),
      async onSelect() {
        const result = await $fetch<{ jobId?: number }>(`/api/test-packs/${row.original.id}/operations/load-tests`, { method: 'POST' })
        toast.add({ title: 'Job queued', description: `Load tests job #${result.jobId ?? '-'} queued.`, color: 'success' })
      }
    },
    {
      label: 'Delete test pack',
      icon: 'i-lucide-trash',
      color: 'error',
      async onSelect() {
        await deleteOne(row.original)
      }
    }
  ]
}

const columns: TableColumn<TestPack>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        ariaLabel: 'Select row'
      })
  },
  {
    accessorKey: 'id',
    header: 'ID'
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => h('div', { class: 'font-medium text-highlighted' }, row.original.name)
  },
  {
    accessorKey: 'labels',
    header: 'Labels',
    cell: ({ row }) => {
      return h('div', { class: 'flex flex-wrap gap-1' }, row.original.labels.map(label =>
        h(UBadge, { variant: 'subtle', color: 'neutral' }, () => label)
      ))
    }
  },
  {
    accessorKey: 'adapterId',
    header: 'Adapter'
  },
  {
    id: 'imageStatus',
    header: 'Image Status',
    cell: ({ row }) => {
      const status = stateValue(row.original, 'imageStatus')
      const color = status === 'pulled' ? 'success' : 'error'
      return h(UBadge, { variant: 'subtle', color, class: 'capitalize' }, () => status)
    }
  },
  {
    id: 'testsCount',
    header: 'Tests',
    cell: ({ row }) => stateValue(row.original, 'testsCount')
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Updated',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString()
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: { align: 'end' },
            items: getRowItems(row)
          },
          () => h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            class: 'ml-auto'
          })
        )
      )
    }
  }
]

const name = computed({
  get: (): string => {
    return (table.value?.tableApi?.getColumn('name')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('name')?.setFilterValue(value || undefined)
  }
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-1.5">
      <UInput
        v-model="name"
        class="max-w-sm"
        icon="i-lucide-search"
        placeholder="Filter test packs..."
      />

      <div class="flex flex-wrap items-center gap-1.5">
        <UButton label="New test pack" icon="i-lucide-plus" @click="goToCreatePage" />

        <TestPacksDeleteModal
          :count="table?.tableApi?.getFilteredSelectedRowModel().rows.length"
          @confirm="deleteSelected"
        >
          <UButton
            v-if="table?.tableApi?.getFilteredSelectedRowModel().rows.length"
            label="Delete"
            color="error"
            variant="subtle"
            icon="i-lucide-trash"
          >
            <template #trailing>
              <UKbd>{{ table?.tableApi?.getFilteredSelectedRowModel().rows.length }}</UKbd>
            </template>
          </UButton>
        </TestPacksDeleteModal>

        <UDropdownMenu
          :items="
            table?.tableApi
              ?.getAllColumns()
              .filter((column: any) => column.getCanHide())
              .map((column: any) => ({
                label: upperFirst(column.id),
                type: 'checkbox' as const,
                checked: column.getIsVisible(),
                onUpdateChecked(checked: boolean) {
                  table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                },
                onSelect(e?: Event) {
                  e?.preventDefault()
                }
              }))
          "
          :content="{ align: 'end' }"
        >
          <UButton label="Display" color="neutral" variant="outline" trailing-icon="i-lucide-settings-2" />
        </UDropdownMenu>
      </div>
    </div>

    <UTable
      ref="table"
      v-model:column-filters="columnFilters"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      v-model:pagination="pagination"
      :pagination-options="{
        getPaginationRowModel: getPaginationRowModel()
      }"
      class="shrink-0"
      :data="data"
      :columns="columns"
      :loading="status === 'pending'"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    />

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
      <div class="text-sm text-muted">
        {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
        {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
      </div>

      <UPagination
        :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
        :items-per-page="table?.tableApi?.getState().pagination.pageSize"
        :total="table?.tableApi?.getFilteredRowModel().rows.length"
        @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
      />
    </div>
  </div>
</template>
