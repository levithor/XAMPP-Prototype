<template>
  <div class="upload-page">
    <header class="upload-header">
      <h1>upload image</h1>
      <p>add a camera snapshot or reference photo to this room</p>
    </header>

    <!-- Dropzone / preview -->
    <div
      class="dropzone"
      :class="{ 'dropzone--active': isDragging, 'dropzone--has-preview': previewUrl }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragEnter"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      @click="!previewUrl && openFileDialog()"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="onFileSelect"
      />

      <template v-if="!previewUrl">
        <div class="dropzone-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p class="dropzone-title">
          <span v-if="isDragging">drop to select</span>
          <span v-else>drag &amp; drop an image, or <span class="link-text">browse</span></span>
        </p>
        <p class="dropzone-sub">png, jpg, or webp — up to 10&nbsp;MB</p>
      </template>

      <template v-else>
        <div class="preview-wrap">
          <img :src="previewUrl" :alt="selectedFile?.name" class="preview-img" />
          <button class="preview-remove" title="remove" @click.stop="clearSelection">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="preview-meta">
          <span class="file-name">{{ selectedFile?.name }}</span>
          <span class="file-size">{{ formatSize(selectedFile?.size) }}</span>
        </div>
      </template>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <!-- Actions -->
    <div v-if="previewUrl" class="upload-footer">
      <span class="footer-status" :class="`footer-status--${status}`">
        <template v-if="status === 'saving'">saving…</template>
        <template v-else-if="status === 'done'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          saved
        </template>
        <template v-else-if="status === 'error'">save failed</template>
      </span>
      <div class="footer-actions">
        <button class="btn btn--ghost" :disabled="status === 'saving'" @click="clearSelection">cancel</button>
        <button
          class="btn btn--primary"
          :disabled="status === 'saving' || status === 'done'"
          @click="uploadImage"
        >
          {{ status === 'saving' ? 'saving…' : status === 'error' ? 'retry' : 'save image' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// Point this at your real endpoint.
const UPLOAD_ENDPOINT = '/api/images'

const selectedFile = ref(null)
const previewUrl = ref(null)
const isDragging = ref(false)
const errorMessage = ref('')
const status = ref('idle') // idle | saving | done | error
const fileInput = ref(null)
let dragCounter = 0

function openFileDialog() {
  fileInput.value?.click()
}

function onDragEnter() {
  dragCounter++
  isDragging.value = true
}
function onDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}
function onDrop(e) {
  dragCounter = 0
  isDragging.value = false
  handleFile(e.dataTransfer.files?.[0])
}
function onFileSelect(e) {
  handleFile(e.target.files?.[0])
  e.target.value = ''
}

function handleFile(raw) {
  errorMessage.value = ''
  if (!raw) return

  if (!ACCEPTED_TYPES.includes(raw.type)) {
    errorMessage.value = `"${raw.name}" isn't a supported image type.`
    return
  }
  if (raw.size > MAX_SIZE) {
    errorMessage.value = `"${raw.name}" is over the 10 MB limit.`
    return
  }

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  selectedFile.value = raw
  previewUrl.value = URL.createObjectURL(raw)
  status.value = 'idle'
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadImage() {
  if (!selectedFile.value) return
  status.value = 'saving'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('image', selectedFile.value)

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`)
    }

    status.value = 'done'
    // If your API returns the saved record, you can read it here:
    // const saved = await response.json()
  } catch (err) {
    status.value = 'error'
    errorMessage.value = 'Could not save the image. Check your connection and try again.'
  }
}

function clearSelection() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  selectedFile.value = null
  previewUrl.value = null
  status.value = 'idle'
  errorMessage.value = ''
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
:root {
  --ov-bg: #f4f3f1;
  --ov-panel: #ffffff;
  --ov-border: #e7e5e1;
  --ov-text: #2b2a28;
  --ov-text-muted: #8c8a85;
  --ov-accent: #1f1e1c;
  --ov-red: #e0433a;
  --ov-green: #3f9b6e;
}

.upload-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 40px 24px 64px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif;
  color: var(--ov-text, #2b2a28);
}

.upload-header h1 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ov-text, #2b2a28);
}
.upload-header p {
  margin: 0 0 28px;
  font-size: 13.5px;
  color: var(--ov-text-muted, #8c8a85);
}

/* Dropzone */
.dropzone {
  border: 1.5px dashed var(--ov-border, #e7e5e1);
  background: var(--ov-panel, #fff);
  border-radius: 14px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.dropzone:hover {
  border-color: #c9c6c0;
}
.dropzone--active {
  border-color: var(--ov-accent, #1f1e1c);
  background: #fafaf9;
}
.dropzone--has-preview {
  padding: 16px;
  cursor: default;
}

.hidden-input {
  display: none;
}

.dropzone-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 10px;
  background: var(--ov-bg, #f4f3f1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ov-text-muted, #8c8a85);
}

.dropzone-title {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--ov-text, #2b2a28);
}
.link-text {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dropzone-sub {
  margin: 0;
  font-size: 12px;
  color: var(--ov-text-muted, #8c8a85);
}

/* Preview */
.preview-wrap {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ov-bg, #f4f3f1);
}
.preview-img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  background: var(--ov-bg, #f4f3f1);
}
.preview-remove {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ov-text, #2b2a28);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.preview-remove:hover {
  background: #fff;
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 4px 2px;
}
.file-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ov-text, #2b2a28);
}
.file-size {
  font-size: 11.5px;
  color: var(--ov-text-muted, #8c8a85);
  flex-shrink: 0;
}

.error-text {
  margin: 10px 2px 0;
  font-size: 12.5px;
  color: var(--ov-red, #e0433a);
}

/* Footer */
.upload-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
.footer-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--ov-text-muted, #8c8a85);
}
.footer-status--done {
  color: var(--ov-green, #3f9b6e);
}
.footer-status--error {
  color: var(--ov-red, #e0433a);
}

.footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn {
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.btn--ghost {
  background: transparent;
  border-color: var(--ov-border, #e7e5e1);
  color: var(--ov-text, #2b2a28);
}
.btn--ghost:hover {
  background: var(--ov-bg, #f4f3f1);
}
.btn--primary {
  background: var(--ov-accent, #1f1e1c);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  opacity: 0.88;
}
.btn--primary:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
