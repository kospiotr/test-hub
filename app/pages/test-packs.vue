<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const links = [[{
  label: 'General',
  icon: 'i-lucide-package-open',
  to: '/test-packs',
  exact: true
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="test-packs-group" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Test Packs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
