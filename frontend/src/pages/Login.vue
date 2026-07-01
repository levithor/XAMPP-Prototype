<template>
  <div class="login-page">
    <div class="login-card">

      <div class="login-logo">
        <div class="logo-icon"><i class="ti ti-grid-dots" /></div>
        <div class="logo-text">
          <div class="name">occuvision</div>
          <div class="sub">cmu · camt</div>
        </div>
      </div>

      <div class="login-heading">
        <h1>admin sign in</h1>
        <p>enter your credentials to access the dashboard.</p>
      </div>

      <div v-if="error" class="login-error">
        <i class="ti ti-alert-circle" />
        {{ error }}
      </div>

      <div class="login-form">
        <div class="field-group">
          <label class="field-label">email</label>
          <div class="field-wrap">
            <i class="ti ti-mail field-icon" />
            <input
              v-model="email"
              type="email"
              class="field-input"
              placeholder="admin@occuvision.com"
              autocomplete="email"
              @keyup.enter="submit"
            />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">password</label>
          <div class="field-wrap">
            <i class="ti ti-lock field-icon" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="field-input"
              placeholder="••••••••"
              autocomplete="current-password"
              @keyup.enter="submit"
            />
            <button class="field-toggle" @click="showPassword = !showPassword" type="button">
              <i :class="showPassword ? 'ti ti-eye-off' : 'ti ti-eye'" />
            </button>
          </div>
        </div>

        <div class="login-row">
          <label class="checkbox-label">
            <input v-model="remember" type="checkbox" class="checkbox-input" />
            <span>keep me signed in</span>
          </label>
        </div>

        <button class="btn-signin" :disabled="loading" @click="submit">
          <span v-if="!loading">sign in <i class="ti ti-arrow-right" /></span>
          <span v-else><i class="ti ti-loader-2 spin" /> signing in…</span>
        </button>
      </div>

      <div class="login-switch">
        don't have an account?
        <router-link to="/register" class="switch-link">create one</router-link>
      </div>

      <div class="login-status">
        <span class="dot dot--green"></span>
        system online · access restricted to facility admins
      </div>

    </div>

    <p class="login-footer-note">
      need an account? <strong>make one</strong>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginAdmin } from '../api.js'
import { saveAuth } from '../auth.js'

const router   = useRouter()
const email    = ref('')
const password = ref('')
const remember = ref(false)
const loading  = ref(false)
const error    = ref('')
const showPassword = ref(false)

async function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = 'please enter your email and password.'
    return
  }
  loading.value = true
  try {
    const { token, admin } = await loginAdmin(email.value, password.value)
    saveAuth(token, admin)
    router.push('/')
  } catch (err) {
    error.value = err.message || 'invalid credentials. please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style>
@import '../assets/auth.css';
</style>