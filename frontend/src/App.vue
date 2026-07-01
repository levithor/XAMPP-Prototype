<template>
  <div v-if="isLoggedIn" style="display:flex; height:100vh; width:100vw; overflow:hidden;">
    <AppSidebar :user="currentUser" @logout="handleLogout" />
    <div class="main">
      <router-view />
    </div>
  </div>

  <router-view v-else />
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import { isAuthenticated, getUser, clearAuth } from './auth.js'

const router = useRouter()
const route  = useRoute()

const isLoggedIn  = ref(isAuthenticated())
const currentUser = ref(getUser())

watch(() => route.path, () => {
  isLoggedIn.value  = isAuthenticated()
  currentUser.value = getUser()
})

function handleLogout() {
  clearAuth()
  isLoggedIn.value = false
  router.push('/login')
}
</script>