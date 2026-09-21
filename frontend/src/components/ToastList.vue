<template>
  <Teleport to="body">
    <div class="toast-container">
      <Transition
        v-for="toast in toasts"
        :key="toast.id"
        name="toast"
        appear>
        <div class="toast" :class="'toast--' + toast.type">
          <i :class="iconFor(toast.type)" class="toast-icon" />
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../other/useToast.js'

const { toasts } = useToast()

function iconFor(type) {
  if (type === 'success') return 'ti ti-circle-check'
  if (type === 'error')   return 'ti ti-circle-x'
  return 'ti ti-info-circle'
}
</script>

<style>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0,0,0,0.14);
  pointer-events: auto;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.toast--success {
  background: #1a1a1a;
  color: #fff;
}

.toast--error {
  background: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 0.5px solid var(--color-danger, #dc2626);
}

.toast--info {
  background: var(--color-info-bg, #eff6ff);
  color: var(--color-accent, #2563eb);
  border: 0.5px solid var(--color-accent, #2563eb);
}

html.dark .toast--success {
  background: #f0f0ee;
  color: #1a1a1a;
}

html.dark .toast--error {
  background: #2d1a1a;
  color: var(--color-danger);
  border-color: var(--color-danger);
}

html.dark .toast--info {
  background: #1e2d4a;
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.toast-icon { font-size: 16px; flex-shrink: 0; }
.toast-msg  { font-size: 13px; }

/* Enter / leave animation */
.toast-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from   { opacity: 0; transform: translateY(-12px) scale(0.95); }
.toast-leave-to     { opacity: 0; transform: translateY(-8px) scale(0.97); }
</style>