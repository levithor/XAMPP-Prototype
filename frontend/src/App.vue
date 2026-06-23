<template>
  <div style="display:flex; height:100vh; overflow:hidden;">
    <AppSidebar />
    <div class="main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import AppSidebar from './components/AppSidebar.vue'
</script>