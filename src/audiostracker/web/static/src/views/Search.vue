<template>
  <div class="space-y-6">
    <!-- Search Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Search Audiobooks</h1>
      
      <!-- Search Form -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input 
            v-model="searchForm.title"
            type="text" 
            placeholder="Enter book title..."
            class="input-field"
            @keyup.enter="performSearch"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Author</label>
          <input 
            v-model="searchForm.author"
            type="text" 
            placeholder="Enter author name..."
            class="input-field"
            @keyup.enter="performSearch"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Series</label>
          <input 
            v-model="searchForm.series"
            type="text" 
            placeholder="Enter series name..."
            class="input-field"
            @keyup.enter="performSearch"
          />
        </div>
      </div>

      <!-- Search Actions -->
      <div class="flex items-center space-x-4 mt-4">
        <button 
          @click="performSearch"
          :disabled="isSearching"
          class="btn-primary"
        >
          {{ isSearching ? 'Searching...' : '🔍 Search' }}
        </button>
        <button 
          @click="clearSearch"
          class="btn-secondary"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchPerformed" class="bg-white rounded-lg shadow">
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">
          Search Results ({{ searchResults.length }} found)
        </h2>
      </div>
      
      <div class="p-6">
        <div v-if="isSearching" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="mt-2 text-gray-600">Searching...</p>
        </div>
        
        <div v-else-if="searchResults.length === 0" class="text-center py-8">
          <p class="text-gray-500">No books found matching your criteria.</p>
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            v-for="book in searchResults" 
            :key="book.id"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start space-x-4">
              <img 
                :src="book.cover_url || '/static/images/placeholder-book.jpg'" 
                :alt="book.title"
                class="w-16 h-20 object-cover rounded"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 text-sm mb-1">{{ book.title }}</h3>
                <p class="text-sm text-gray-600 mb-1">{{ book.author }}</p>
                <p v-if="book.series" class="text-xs text-gray-500 mb-2">{{ book.series }}</p>
                <p class="text-xs text-gray-500 mb-2">Release: {{ formatDate(book.release_date) }}</p>
                
                <div class="flex items-center space-x-2">
                  <button 
                    @click="addToWishlist(book)"
                    :disabled="book.in_wishlist"
                    class="text-xs px-2 py-1 rounded"
                    :class="book.in_wishlist ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'"
                  >
                    {{ book.in_wishlist ? '✓ In Wishlist' : '⭐ Add to Wishlist' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useAudiobooksStore } from '@/stores/audiobooks'

const audiobooksStore = useAudiobooksStore()

const isSearching = ref(false)
const searchPerformed = ref(false)
const searchResults = ref([])

const searchForm = reactive({
  title: '',
  author: '',
  series: ''
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const performSearch = async () => {
  if (!searchForm.title && !searchForm.author && !searchForm.series) {
    alert('Please enter at least one search criteria')
    return
  }

  isSearching.value = true
  searchPerformed.value = true

  try {
    const params = new URLSearchParams()
    if (searchForm.title) params.append('title', searchForm.title)
    if (searchForm.author) params.append('author', searchForm.author)
    if (searchForm.series) params.append('series', searchForm.series)

    const response = await fetch(`/api/search?${params}`)
    if (response.ok) {
      const data = await response.json()
      searchResults.value = data.results || []
    } else {
      throw new Error('Search failed')
    }
  } catch (error) {
    console.error('Search error:', error)
    // Mock data for development
    searchResults.value = [
      {
        id: 1,
        title: "The Way of Kings",
        author: "Brandon Sanderson",
        series: "The Stormlight Archive",
        release_date: "2024-08-15",
        cover_url: null,
        in_wishlist: false
      },
      {
        id: 2,
        title: "The Name of the Wind",
        author: "Patrick Rothfuss",
        series: "The Kingkiller Chronicle",
        release_date: "2024-09-01",
        cover_url: null,
        in_wishlist: true
      }
    ]
  } finally {
    isSearching.value = false
  }
}

const clearSearch = () => {
  searchForm.title = ''
  searchForm.author = ''
  searchForm.series = ''
  searchResults.value = []
  searchPerformed.value = false
}

const addToWishlist = async (book) => {
  try {
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ book_id: book.id })
    })

    if (response.ok) {
      book.in_wishlist = true
      // You could also update the store here
    }
  } catch (error) {
    console.error('Error adding to wishlist:', error)
    // For development, just update the UI
    book.in_wishlist = true
  }
}
</script>
