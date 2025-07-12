<template>
  <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
    <div class="flex items-start space-x-4">
      <img 
        :src="book.cover_url || '/static/images/placeholder-book.jpg'" 
        :alt="book.title"
        class="w-16 h-20 object-cover rounded flex-shrink-0"
        @error="handleImageError"
      />
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 text-sm mb-1 truncate">{{ book.title }}</h3>
        <p class="text-sm text-gray-600 mb-1">{{ book.author }}</p>
        <p v-if="book.series" class="text-xs text-gray-500 mb-2 truncate">{{ book.series }}</p>
        
        <div class="flex items-center space-x-2 mb-2">
          <span 
            v-if="book.status"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="getStatusClass(book.status)"
          >
            {{ book.status }}
          </span>
          <span v-if="book.release_date" class="text-xs text-gray-500">
            {{ formatDate(book.release_date) }}
          </span>
        </div>
        
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <button 
              v-if="showWishlistButton"
              @click="toggleWishlist"
              :disabled="isLoading"
              class="text-xs px-2 py-1 rounded transition-colors"
              :class="book.in_wishlist ? 
                'bg-gray-200 text-gray-500' : 
                'bg-blue-100 text-blue-700 hover:bg-blue-200'"
            >
              {{ book.in_wishlist ? '✓ In Wishlist' : '⭐ Add to Wishlist' }}
            </button>
            
            <button 
              v-if="book.audible_url"
              @click="openAudible"
              class="text-xs text-blue-600 hover:text-blue-800"
            >
              📖 Audible
            </button>
          </div>
          
          <div class="flex items-center space-x-1">
            <button 
              v-if="showRemoveButton"
              @click="$emit('remove', book)"
              class="text-red-600 hover:text-red-800 p-1"
              title="Remove"
            >
              🗑️
            </button>
            <button 
              v-if="showListenedButton && book.status !== 'listened'"
              @click="$emit('markListened', book)"
              class="text-green-600 hover:text-green-800 p-1"
              title="Mark as listened"
            >
              ✓
            </button>
          </div>
        </div>
        
        <p v-if="book.description && showDescription" class="text-xs text-gray-600 mt-2 line-clamp-2">
          {{ book.description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAudiobooksStore } from '@/stores/audiobooks'

const props = defineProps({
  book: {
    type: Object,
    required: true
  },
  showWishlistButton: {
    type: Boolean,
    default: true
  },
  showRemoveButton: {
    type: Boolean,
    default: false
  },
  showListenedButton: {
    type: Boolean,
    default: false
  },
  showDescription: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['remove', 'markListened', 'wishlistToggled'])

const audiobooksStore = useAudiobooksStore()
const isLoading = ref(false)

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const getStatusClass = (status) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800'
    case 'upcoming':
      return 'bg-yellow-100 text-yellow-800'
    case 'preorder':
      return 'bg-blue-100 text-blue-800'
    case 'listened':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const handleImageError = (event) => {
  event.target.src = '/static/images/placeholder-book.jpg'
}

const toggleWishlist = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  try {
    if (props.book.in_wishlist) {
      // For wishlist removal, we need the wishlist item ID
      // This should be handled by the parent component
      emit('remove', props.book)
    } else {
      const success = await audiobooksStore.addToWishlist(props.book.id)
      if (success) {
        props.book.in_wishlist = true
        emit('wishlistToggled', props.book)
      }
    }
  } finally {
    isLoading.value = false
  }
}

const openAudible = () => {
  if (props.book.audible_url) {
    window.open(props.book.audible_url, '_blank')
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
