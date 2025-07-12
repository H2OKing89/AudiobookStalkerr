<template>
  <div class="space-y-6">
    <!-- Wishlist Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">My Wishlist</h1>
          <p class="text-gray-600">{{ wishlistItems.length }} books in your wishlist</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            @click="refreshWishlist"
            :disabled="isLoading"
            class="btn-secondary"
          >
            {{ isLoading ? 'Refreshing...' : '🔄 Refresh' }}
          </button>
          <button 
            @click="exportWishlist"
            class="btn-primary"
          >
            📥 Export
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Sort -->
    <div class="bg-white rounded-lg shadow p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
          <select v-model="filterStatus" class="input-field">
            <option value="">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="available">Available</option>
            <option value="preorder">Pre-order</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
          <select v-model="sortBy" class="input-field">
            <option value="release_date">Release Date</option>
            <option value="added_date">Date Added</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Order</label>
          <select v-model="sortOrder" class="input-field">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Wishlist Items -->
    <div class="bg-white rounded-lg shadow">
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-2 text-gray-600">Loading wishlist...</p>
      </div>

      <div v-else-if="filteredWishlist.length === 0" class="p-8 text-center">
        <p class="text-gray-500">No items in your wishlist yet.</p>
        <router-link to="/search" class="btn-primary mt-4 inline-block">
          🔍 Search for Books
        </router-link>
      </div>

      <div v-else class="divide-y divide-gray-200">
        <div 
          v-for="item in filteredWishlist" 
          :key="item.id"
          class="p-6 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-start space-x-4">
            <img 
              :src="item.book.cover_url || '/static/images/placeholder-book.jpg'" 
              :alt="item.book.title"
              class="w-20 h-24 object-cover rounded"
            />
            <div class="flex-1">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">{{ item.book.title }}</h3>
                  <p class="text-gray-600">{{ item.book.author }}</p>
                  <p v-if="item.book.series" class="text-sm text-gray-500">{{ item.book.series }}</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span 
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getStatusClass(item.book.status)"
                  >
                    {{ item.book.status || 'Unknown' }}
                  </span>
                  <button 
                    @click="removeFromWishlist(item.id)"
                    class="text-red-600 hover:text-red-800 p-1"
                    title="Remove from wishlist"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-gray-500">Release Date:</span>
                  <p class="font-medium">{{ formatDate(item.book.release_date) }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Added:</span>
                  <p class="font-medium">{{ formatDate(item.added_date) }}</p>
                </div>
                <div v-if="item.book.price">
                  <span class="text-gray-500">Price:</span>
                  <p class="font-medium">${{ item.book.price }}</p>
                </div>
                <div v-if="item.book.length">
                  <span class="text-gray-500">Length:</span>
                  <p class="font-medium">{{ item.book.length }}</p>
                </div>
              </div>

              <div v-if="item.book.description" class="mt-3">
                <p class="text-sm text-gray-600 line-clamp-2">{{ item.book.description }}</p>
              </div>

              <div class="mt-3 flex items-center space-x-3">
                <a 
                  v-if="item.book.audible_url"
                  :href="item.book.audible_url" 
                  target="_blank"
                  class="text-blue-600 hover:text-blue-800 text-sm"
                >
                  📖 View on Audible
                </a>
                <button 
                  v-if="item.book.status === 'available'"
                  @click="markAsListened(item.id)"
                  class="text-green-600 hover:text-green-800 text-sm"
                >
                  ✓ Mark as Listened
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudiobooksStore } from '@/stores/audiobooks'

const audiobooksStore = useAudiobooksStore()

const isLoading = ref(false)
const wishlistItems = ref([])
const filterStatus = ref('')
const sortBy = ref('release_date')
const sortOrder = ref('asc')

const filteredWishlist = computed(() => {
  let filtered = wishlistItems.value

  // Apply status filter
  if (filterStatus.value) {
    filtered = filtered.filter(item => item.book.status === filterStatus.value)
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let aVal, bVal
    
    switch (sortBy.value) {
      case 'release_date':
        aVal = new Date(a.book.release_date)
        bVal = new Date(b.book.release_date)
        break
      case 'added_date':
        aVal = new Date(a.added_date)
        bVal = new Date(b.added_date)
        break
      case 'title':
        aVal = a.book.title.toLowerCase()
        bVal = b.book.title.toLowerCase()
        break
      case 'author':
        aVal = a.book.author.toLowerCase()
        bVal = b.book.author.toLowerCase()
        break
      default:
        return 0
    }

    if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })

  return filtered
})

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
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const refreshWishlist = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/wishlist')
    if (response.ok) {
      const data = await response.json()
      wishlistItems.value = data.items || []
    }
  } catch (error) {
    console.error('Error loading wishlist:', error)
    // Mock data for development
    wishlistItems.value = [
      {
        id: 1,
        added_date: '2024-07-01',
        book: {
          id: 1,
          title: "The Way of Kings",
          author: "Brandon Sanderson",
          series: "The Stormlight Archive",
          release_date: "2024-08-15",
          status: "upcoming",
          price: "29.95",
          length: "45h 30m",
          description: "An epic fantasy novel...",
          cover_url: null,
          audible_url: "https://audible.com/example"
        }
      }
    ]
  } finally {
    isLoading.value = false
  }
}

const removeFromWishlist = async (itemId) => {
  if (!confirm('Are you sure you want to remove this book from your wishlist?')) {
    return
  }

  try {
    const response = await fetch(`/api/wishlist/${itemId}`, {
      method: 'DELETE'
    })

    if (response.ok) {
      wishlistItems.value = wishlistItems.value.filter(item => item.id !== itemId)
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error)
    // For development, just update the UI
    wishlistItems.value = wishlistItems.value.filter(item => item.id !== itemId)
  }
}

const markAsListened = async (itemId) => {
  try {
    const response = await fetch(`/api/wishlist/${itemId}/listened`, {
      method: 'POST'
    })

    if (response.ok) {
      const item = wishlistItems.value.find(item => item.id === itemId)
      if (item) {
        item.book.status = 'listened'
      }
    }
  } catch (error) {
    console.error('Error marking as listened:', error)
  }
}

const exportWishlist = async () => {
  try {
    const response = await fetch('/api/wishlist/export')
    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'wishlist.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Error exporting wishlist:', error)
  }
}

onMounted(() => {
  refreshWishlist()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
