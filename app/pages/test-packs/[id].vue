<script setup lang="ts">
import * as z from 'zod'
import type { TestPack } from '~/types'

const route = useRoute()
const toast = useToast()

const idSchema = z.coerce.number().int().positive()
const testPackId = idSchema.parse(route.params.id)

  const { data: testPack, status, refresh } = await useFetch<TestPack>(`/api/test-packs/${testPackId}`, {
    default: () => ({
      id: testPackId,
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
      state: {
        adapterId: 'docker-pytest',
        states: []
      },
      operations: [],
      testsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  })

const isSaving = ref(false)

const formValue = computed<Partial<TestPack>>(() => testPack.value)

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
    await $fetch(`/api/test-packs/${testPackId}`, {
      method: 'PATCH',
      body: payload
    })

    toast.add({ title: 'Saved', description: 'Test pack updated.', color: 'success' })
    await refresh()
  } catch {
    toast.add({
      title: 'Save failed',
      description: 'Adapter and configuration must be valid.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

async function saveChanges() {
  const form = document.getElementById('test-packs-edit-form') as HTMLFormElement | null
  form?.requestSubmit()
}
</script>

<template>

  <UDashboardPanel id="test-pack-edit">
    <template #header>
      <UDashboardNavbar :title="testPack.name || 'Test Pack'" :ui="{ right: 'gap-2' }">
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
            label="Save"
            color="primary"
            :loading="isSaving"
            @click="saveChanges"
          />
        </template>
      </UDashboardNavbar>

    </template>

    <template #body>
      <div v-if="status === 'pending'" class="text-sm text-muted">Loading test pack...</div>

      <TestPacksForm
        v-else
        form-id="test-pack-edit-form"
        :value="formValue"
        :loading="isSaving"
        submit-label="Save changes"
        @submit="onSubmit"
      />
    </template>
  </UDashboardPanel>
</template>
