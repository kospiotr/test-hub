<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TabsItem } from '@nuxt/ui'

definePageMeta({
  layout: false
})

const toast = useToast()

const tab = ref<'login' | 'register'>('login')

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

type LoginSchema = z.output<typeof loginSchema>
type RegisterSchema = z.output<typeof registerSchema>

const loginState = reactive<Partial<LoginSchema>>({
  email: '',
  password: ''
})

const registerState = reactive<Partial<RegisterSchema>>({
  name: '',
  email: '',
  password: ''
})

const tabs = [{
  label: 'Sign in',
  value: 'login'
}, {
  label: 'Create account',
  value: 'register'
}] satisfies TabsItem[]

const loading = ref(false)
const { fetch: fetchUserSession } = useUserSession()

async function onLogin(event: FormSubmitEvent<LoginSchema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: event.data
    })
    await fetchUserSession()
    await navigateTo('/')
  } catch {
    toast.add({
      title: 'Sign in failed',
      description: 'Please check your credentials and try again.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}

async function onRegister(event: FormSubmitEvent<RegisterSchema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: event.data
    })
    await fetchUserSession()
    await navigateTo('/')
  } catch {
    toast.add({
      title: 'Registration failed',
      description: 'The email may already be in use.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-primary-100/40 via-elevated/10 to-default flex items-center justify-center p-4">
    <UCard class="w-full max-w-md" :ui="{ body: 'space-y-6' }">
      <div class="space-y-1">
        <p class="text-sm text-muted">QA Manager</p>
        <h1 class="text-2xl font-semibold text-highlighted">Welcome back</h1>
        <p class="text-sm text-toned">Sign in to access your dashboard and API workspace.</p>
      </div>

      <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

      <UForm
        v-if="tab === 'login'"
        :schema="loginSchema"
        :state="loginState"
        class="space-y-4"
        @submit="onLogin"
      >
        <UFormField label="Email" name="email">
          <UInput v-model="loginState.email" class="w-full" type="email" autocomplete="email" />
        </UFormField>
        <UFormField label="Password" name="password">
          <UInput v-model="loginState.password" class="w-full" type="password" autocomplete="current-password" />
        </UFormField>
        <UButton type="submit" block :loading="loading">Sign in</UButton>
      </UForm>

      <UForm
        v-else
        :schema="registerSchema"
        :state="registerState"
        class="space-y-4"
        @submit="onRegister"
      >
        <UFormField label="Full name" name="name">
          <UInput v-model="registerState.name" class="w-full" autocomplete="name" />
        </UFormField>
        <UFormField label="Email" name="email">
          <UInput v-model="registerState.email" class="w-full" type="email" autocomplete="email" />
        </UFormField>
        <UFormField label="Password" name="password">
          <UInput v-model="registerState.password" class="w-full" type="password" autocomplete="new-password" />
        </UFormField>
        <UButton type="submit" block :loading="loading">Create account</UButton>
      </UForm>
    </UCard>
  </div>
</template>
