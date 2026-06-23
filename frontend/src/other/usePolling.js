import { onMounted, onUnmounted } from 'vue'

/**
 * Calls `fn` immediately on mount, then every `intervalMs`.
 * Clears the interval automatically when the component unmounts.
 */
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
