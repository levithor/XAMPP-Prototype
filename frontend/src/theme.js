import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'occuvision_theme'


const isDark = ref(localStorage.getItem(STORAGE_KEY) === 'dark')


watchEffect(() => {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem(STORAGE_KEY, 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem(STORAGE_KEY, 'light')
  }
})

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
  }
  return { isDark, toggleTheme }
}