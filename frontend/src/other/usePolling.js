import { onMounted, onUnmounted } from 'vue'

export function usePolling(fn, intervalMs = 5000) {
  let timer = null

  onMounted(async () => {
    await fn()
    timer = setInterval(fn, intervalMs)
  })

  onUnmounted(() => {
    clearInterval(timer)
  })
}
