<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          <button 
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div class="mb-6">
          <slot></slot>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            @click="$emit('close')"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button 
            @click="$emit('confirm')"
            class="btn-primary"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Confirm Action'
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  }
})

defineEmits(['close', 'confirm'])
</script>
