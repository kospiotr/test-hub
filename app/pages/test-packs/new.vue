<script setup lang="ts">
import type { TestPack } from '~/types'

const toast = useToast()
const isSaving = ref(false)

const initialValue = computed<Partial<TestPack>>(() => ({
  name: '',
  labels: [],
  description: '',
  documentation: '',
  adapterId: 'docker-pytest',
  configuration: {
    imageRegistry: '',
    imageName: '',
    imageVersion: 'latest'
  },
  operations: [],
  state: {
    adapterId: 'docker-pytest',
    states: []
  },
  testsCount: 0
}))

async function onSubmit(payload: {
  name: string
  labels: string[]
  description: string
  documentation: string
  adapterId: string
  configuration: Record<string, string>
}) {
  isSaving.value = true
  try {
    const created = await $fetch<{ id: number }>('/api/test-packs', {
      method: 'POST',
      body: payload
    })

    toast.add({ title: 'Created', description: 'Test pack created successfully.', color: 'success' })
    await navigateTo('/test-packs')
  } catch {
    toast.add({ title: 'Create failed', description: 'Please review the form and try again.', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

function saveChanges() {
  const form = document.getElementById('test-packs-create-form') as HTMLFormElement | null
  form?.requestSubmit()
}
</script>

<template>
  <UDashboardPanel id="test-pack-create">
    <template #header>
      <UDashboardNavbar title="New Test Pack" :ui="{ right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            label="Back"
            color="neutral"
            variant="ghost"
            to="/test-packs"
          />
          <UButton
            icon="i-lucide-save"
            label="Create"
            color="primary"
            :loading="isSaving"
            @click="saveChanges"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <TestPacksForm
        form-id="test-pack-create-form"
        :value="initialValue"
        :loading="isSaving"
        submit-label="Create"
        @submit="onSubmit"
      />
    </template>
  </UDashboardPanel>
</template>
