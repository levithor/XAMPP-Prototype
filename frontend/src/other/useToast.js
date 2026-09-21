import { ref } from 'vue'

// Module-level singleton — shared across all components
const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'success', duration = 3000) {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  const toast = {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'info'),
  }

  return { toasts, toast }
}