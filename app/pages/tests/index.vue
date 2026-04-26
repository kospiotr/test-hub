<script setup lang="ts">
import TestListTableWithFilters from '~/components/tests/TestListTableWithFilters.vue'

</script>

<template>
  <test-list-table-with-filters>
    <template #leading>
      <UDashboardSidebarCollapse />
    </template>
  </test-list-table-with-filters>
</template>
