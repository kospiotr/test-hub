<script setup lang="ts">
import type { TestPack } from '~/types'

const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit'
  testPack?: TestPack | null
  open?: boolean
  showTrigger?: boolean
}>(), {
  mode: 'create',
  testPack: null,
  open: undefined,
  showTrigger: true
})

const emit = defineEmits<{
  saved: []
  'update:open': [value: boolean]
}>()

const localOpen = ref(false)
const loading = ref(false)
const toast = useToast()

const isControlled = computed(() => typeof props.open === 'boolean')
const open = computed({
  get: () => isControlled.value ? !!props.open : localOpen.value,
  set: (value: boolean) => {
    if (isControlled.value) {
      emit('update:open', value)
      return
    }

    localOpen.value = value
  }
})

const formValue = computed<Partial<TestPack>>(() => {
  if (props.mode === 'edit' && props.testPack) {
    return props.testPack
  }

  return {
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
  }
})

async function onSubmit(payload: {
  name: string
  labels: string[]
  description: string
  documentation: string
  adapterId: string
  configuration: Record<string, string>
}) {
  loading.value = true
  try {
    if (props.mode === 'edit' && props.testPack) {
      await $fetch(`/api/test-packs/${props.testPack.id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Updated', description: 'Test pack updated successfully.', color: 'success' })
    } else {
      await $fetch('/api/test-packs', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Created', description: 'New test pack created.', color: 'success' })
    }

    open.value = false
    emit('saved')
  } catch {
    toast.add({
      title: 'Save failed',
      description: 'Please review the form and try again.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="mode === 'edit' ? 'Edit test pack' : 'New test pack'"
    description="Create or update a reusable QA test pack."
  >
    <slot v-if="showTrigger">
      <UButton :label="mode === 'edit' ? 'Edit' : 'New test pack'" :icon="mode === 'edit' ? 'i-lucide-pencil' : 'i-lucide-plus'" />
    </slot>

    <template #body>
      <TestPacksForm
        form-id="test-pack-modal-form"
        :value="formValue"
        :loading="loading"
        :submit-label="mode === 'edit' ? 'Save' : 'Create'"
        @submit="onSubmit"
      />

      <div class="mt-4 flex justify-end">
        <UButton label="Cancel" color="neutral" variant="subtle" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
