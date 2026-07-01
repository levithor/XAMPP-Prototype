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
        <h1>create account</h1>
        <p>register to access the occuvision dashboard.</p>
      </div>

      <div v-if="error" class="login-error">
        <i class="ti ti-alert-circle" />
        {{ error }}
      </div>

      <div v-if="success" class="login-success">
        <i class="ti ti-circle-check" />
        account created! redirecting to sign in…
      </div>

      <div class="login-form">

        <div class="field-group">
          <label class="field-label">username</label>
          <div class="field-wrap" :class="{ 'field-wrap--error': fieldError('username') }">
            <i class="ti ti-user field-icon" />
            <input
              v-model="form.username"
              type="text"
              class="field-input"
              placeholder="e.g. manager_mario"
              autocomplete="username"
              @keyup.enter="submit"
            />
          </div>
          <span v-if="fieldError('username')" class="field-hint">{{ fieldError('username') }}</span>
        </div>

        <div class="field-group">
          <label class="field-label">email</label>
          <div class="field-wrap" :class="{ 'field-wrap--error': fieldError('email') }">
            <i class="ti ti-mail field-icon" />
            <input
              v-model="form.email"
              type="email"
              class="field-input"
              placeholder="admin@occuvision.com"
              autocomplete="email"
              @keyup.enter="submit"
            />
          </div>
          <span v-if="fieldError('email')" class="field-hint">{{ fieldError('email') }}</span>
        </div>

        <div class="field-group">
          <label class="field-label">password</label>
          <div class="field-wrap" :class="{ 'field-wrap--error': fieldError('password') }">
            <i class="ti ti-lock field-icon" />
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              class="field-input"
              placeholder="min. 8 characters"
              autocomplete="new-password"
              @keyup.enter="submit"
            />
            <button class="field-toggle" type="button" @click="showPassword = !showPassword">
              <i :class="showPassword ? 'ti ti-eye-off' : 'ti ti-eye'" />
            </button>
          </div>
          <span v-if="fieldError('password')" class="field-hint">{{ fieldError('password') }}</span>

          <div v-if="form.password" class="strength-row">
            <div class="strength-bar">
              <div class="strength-fill" :class="strength.cls" :style="{ width: strength.pct + '%' }" />
            </div>
            <span class="strength-label" :class="strength.cls">{{ strength.label }}</span>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">confirm password</label>
          <div class="field-wrap" :class="{ 'field-wrap--error': fieldError('confirm') }">
            <i class="ti ti-lock-check field-icon" />
            <input
              v-model="form.confirm"
              :type="showConfirm ? 'text' : 'password'"
              class="field-input"
              placeholder="repeat your password"
              autocomplete="new-password"
              @keyup.enter="submit"
            />
            <button class="field-toggle" type="button" @click="showConfirm = !showConfirm">
              <i :class="showConfirm ? 'ti ti-eye-off' : 'ti ti-eye'" />
            </button>
          </div>
          <span v-if="fieldError('confirm')" class="field-hint">{{ fieldError('confirm') }}</span>
        </div>

        <button class="btn-signin" :disabled="loading || success" @click="submit">
          <span v-if="!loading">create account <i class="ti ti-arrow-right" /></span>
          <span v-else><i class="ti ti-loader-2 spin" /> creating account…</span>
        </button>

      </div>

      <div class="login-switch">
        already have an account?
        <router-link to="/login" class="switch-link">sign in</router-link>
      </div>

    </div>

    <p class="login-footer-note">
      need help? <strong>contact your system administrator</strong>
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { registerAdmin } from '../api.js'

const router = useRouter()

const form = ref({
  username: '',
  email:    '',
  password: '',
  confirm:  '',
})

const showPassword = ref(false)
const showConfirm  = ref(false)
const loading      = ref(false)
const error        = ref('')
const success      = ref(false)
const fieldErrors  = ref({})

const strength = computed(() => {
  const p = form.value.password
  if (!p) return { pct: 0, label: '', cls: '' }
  let score = 0
  if (p.length >= 8)              score++
  if (p.length >= 12)             score++
  if (/[A-Z]/.test(p))           score++
  if (/[0-9]/.test(p))           score++
  if (/[^A-Za-z0-9]/.test(p))   score++
  if (score <= 1) return { pct: 25,  label: 'weak',   cls: 'str-weak' }
  if (score <= 2) return { pct: 50,  label: 'fair',   cls: 'str-fair' }
  if (score <= 3) return { pct: 75,  label: 'good',   cls: 'str-good' }
  return               { pct: 100, label: 'strong', cls: 'str-strong' }
})

function validate() {
  const errs = {}
  if (!form.value.username.trim())
    errs.username = 'username is required'
  if (!form.value.email.trim())
    errs.email = 'email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
    errs.email = 'please enter a valid email'
  if (!form.value.password)
    errs.password = 'password is required'
  else if (form.value.password.length < 8)
    errs.password = 'password must be at least 8 characters'
  if (!form.value.confirm)
    errs.confirm = 'please confirm your password'
  else if (form.value.password !== form.value.confirm)
    errs.confirm = 'passwords do not match'
  return errs
}

function fieldError(key) {
  return fieldErrors.value[key] || ''
}

async function submit() {
  error.value       = ''
  fieldErrors.value = {}

  const errs = validate()
  if (Object.keys(errs).length) {
    fieldErrors.value = errs
    return
  }

  loading.value = true
  try {
    await registerAdmin({
      username: form.value.username.trim(),
      email:    form.value.email.trim(),
      password: form.value.password,
    })
    success.value = true
    setTimeout(() => router.push('/login'), 1800)
  } catch (err) {
    error.value = err.message || 'registration failed. please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style>
@import '../assets/auth.css';
</style>