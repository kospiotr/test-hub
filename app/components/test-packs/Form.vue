<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TabsItem } from '@nuxt/ui'
import type { AdapterDefinition, TestPack } from '~/types'

const props = withDefaults(defineProps<{
  value?: Partial<TestPack>
  loading?: boolean
  formId?: string
  submitLabel?: string
}>(), {
  value: () => ({}),
  loading: false,
  formId: 'test-packs-form',
  submitLabel: 'Save changes'
})

const emit = defineEmits<{
  submit: [payload: {
    name: string
    labels: string[]
    description: string
    documentation: string
    adapterId: string
    configuration: Record<string, string>
  }]
}>()

const { data: adapters } = await useFetch<AdapterDefinition[]>('/api/adapters', {
  default: () => []
})

const adapterOptions = computed(() => (adapters.value || []).map(adapter => ({
  label: adapter.label,
  value: adapter.id
})))

const selectedAdapter = computed(() => (adapters.value || []).find(item => item.id === state.adapterId) || null)

const tabs = [{
  label: 'Summary',
  value: 'summary',
  icon: 'i-lucide-layout-panel-top'
}, {
  label: 'Documentation',
  value: 'documentation',
  icon: 'i-lucide-book-open-text'
}, {
  label: 'Configuration',
  value: 'configuration',
  icon: 'i-lucide-settings-2'
}] satisfies TabsItem[]

const activeTab = ref<'summary' | 'documentation' | 'configuration'>('summary')

const schema = z.object({
  name: z.string().trim().min(2, 'Too short'),
  labelsInput: z.string().default(''),
  description: z.string().default(''),
  documentation: z.string().default(''),
  adapterId: z.string().trim().min(1, 'Required')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema & { config: Record<string, string> }>({
  name: '',
  labelsInput: '',
  description: '',
  documentation: '',
  adapterId: '',
  config: {}
})

watch(() => props.value, (value) => {
  state.name = value.name || ''
  state.labelsInput = (value.labels || []).join(', ')
  state.description = value.description || ''
  state.documentation = value.documentation || ''
  state.adapterId = value.adapterId || adapterOptions.value[0]?.value || ''

  const config = value.configuration || {}
  state.config = Object.fromEntries(
    Object.entries(config).map(([key, val]) => [key, String(val ?? '')])
  )
}, { immediate: true, deep: true })

watch(selectedAdapter, (adapter) => {
  if (!adapter) {
    return
  }

  for (const field of adapter.configFields) {
    if (typeof state.config[field.key] !== 'string') {
      state.config[field.key] = ''
    }
  }
}, { immediate: true })

function parseLabels(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  const adapter = selectedAdapter.value
  if (!adapter) {
    return
  }

  const configuration = Object.fromEntries(
    adapter.configFields.map(field => [field.key, state.config[field.key] || ''])
  )

  emit('submit', {
    name: event.data.name,
    labels: parseLabels(event.data.labelsInput),
    description: event.data.description,
    documentation: event.data.documentation,
    adapterId: event.data.adapterId,
    configuration
  })
}

const imagePreview = computed(() => {
  if (state.adapterId !== 'docker-pytest') {
    return ''
  }

  const registry = (state.config.imageRegistry || '').trim()
  const imageName = (state.config.imageName || '').trim()
  const imageVersion = (state.config.imageVersion || '').trim()
  if (!registry || !imageName || !imageVersion) {
    return ''
  }

  return `${registry}/${imageName}:${imageVersion}`
})
</script>

<template>
  <UForm
    :id="formId"
    :schema="schema"
    :state="state"
    class="space-y-4 max-w-4xl"
    @submit="onSubmit"
  >
    <UTabs v-model="activeTab" :items="tabs" :content="false" />

    <div v-if="activeTab === 'summary'" class="space-y-4">
      <UFormField label="Name" name="name">
        <UInput v-model="state.name" class="w-full" />
      </UFormField>

      <UFormField label="Labels" description="Comma-separated list" name="labelsInput">
        <UInput v-model="state.labelsInput" class="w-full" placeholder="smoke, regression, api" />
      </UFormField>

      <UFormField label="Description" name="description">
        <UEditor v-model="state.description" content-type="markdown" class="w-full min-h-48 rounded-md border border-muted relative z-1">
          <template #default="{ editor }">
            <UEditorToolbar :editor="editor" />
          </template>
        </UEditor>
      </UFormField>
    </div>

    <div v-if="activeTab === 'documentation'" class="space-y-4">
      <UFormField label="Documentation" name="documentation">
        <UEditor v-model="state.documentation" content-type="markdown" class="w-full min-h-48 rounded-md border border-muted relative z-1">
          <template #default="{ editor }">
            <UEditorToolbar :editor="editor" />
          </template>
        </UEditor>
      </UFormField>
    </div>

    <div v-if="activeTab === 'configuration'" class="space-y-4">
      <UFormField label="Adapter" name="adapterId" required>
        <USelect v-model="state.adapterId" class="w-full" :items="adapterOptions" placeholder="Select adapter" />
      </UFormField>

      <template v-if="selectedAdapter">
        <UFormField
          v-for="field in selectedAdapter.configFields"
          :key="field.key"
          :label="field.label"
          :required="!!field.required"
        >
          <UInput
            v-model="state.config[field.key]"
            class="w-full"
            :placeholder="field.placeholder"
          />
        </UFormField>
      </template>

      <p v-if="imagePreview" class="text-sm text-muted">
        Image reference: <span class="font-mono text-xs">{{ imagePreview }}</span>
      </p>
    </div>

    <div class="flex justify-end">
      <UButton type="submit" icon="i-lucide-save" :label="submitLabel" :loading="loading" />
    </div>
  </UForm>
</template>
