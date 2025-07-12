import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAudiobooksStore = defineStore('audiobooks', () => {
  // State
  const books = ref([])
  const wishlist = ref([])
  const searchResults = ref([])
  const analytics = ref({
    totalBooks: 0,
    listenedBooks: 0,
    totalHours: 0,
    thisMonthBooks: 0
  })
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const totalBooks = computed(() => books.value.length)
  const wishlistCount = computed(() => wishlist.value.length)
  const upcomingReleases = computed(() => 
    books.value.filter(book => 
      new Date(book.release_date) > new Date() && 
      book.status === 'upcoming'
    ).length
  )
  const recentReleases = computed(() => 
    books.value
      .filter(book => {
        const releaseDate = new Date(book.release_date)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return releaseDate >= weekAgo && releaseDate <= new Date()
      })
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
  )

  // Actions
  const fetchBooks = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/books')
      if (!response.ok) throw new Error('Failed to fetch books')
      
      const data = await response.json()
      books.value = data.books || []
    } catch (err) {
      error.value = err.message
      console.error('Error fetching books:', err)
    } finally {
      isLoading.value = false
    }
  }

  const fetchWishlist = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/wishlist')
      if (!response.ok) throw new Error('Failed to fetch wishlist')
      
      const data = await response.json()
      wishlist.value = data.items || []
    } catch (err) {
      error.value = err.message
      console.error('Error fetching wishlist:', err)
    } finally {
      isLoading.value = false
    }
  }

  const searchBooks = async (searchParams) => {
    isLoading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key]) {
          params.append(key, searchParams[key])
        }
      })

      const response = await fetch(`/api/search?${params}`)
      if (!response.ok) throw new Error('Search failed')
      
      const data = await response.json()
      searchResults.value = data.results || []
      return data.results || []
    } catch (err) {
      error.value = err.message
      console.error('Error searching books:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  const addToWishlist = async (bookId) => {
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId })
      })

      if (!response.ok) throw new Error('Failed to add to wishlist')
      
      const data = await response.json()
      
      // Update local state
      if (data.item) {
        wishlist.value.push(data.item)
      }
      
      // Update search results if the book is there
      const searchResultIndex = searchResults.value.findIndex(book => book.id === bookId)
      if (searchResultIndex !== -1) {
        searchResults.value[searchResultIndex].in_wishlist = true
      }
      
      return true
    } catch (err) {
      error.value = err.message
      console.error('Error adding to wishlist:', err)
      return false
    }
  }

  const removeFromWishlist = async (itemId) => {
    try {
      const response = await fetch(`/api/wishlist/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove from wishlist')
      
      // Update local state
      wishlist.value = wishlist.value.filter(item => item.id !== itemId)
      
      return true
    } catch (err) {
      error.value = err.message
      console.error('Error removing from wishlist:', err)
      return false
    }
  }

  const markAsListened = async (bookId) => {
    try {
      const response = await fetch(`/api/books/${bookId}/listened`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to mark as listened')
      
      // Update local state
      const bookIndex = books.value.findIndex(book => book.id === bookId)
      if (bookIndex !== -1) {
        books.value[bookIndex].status = 'listened'
      }
      
      const wishlistIndex = wishlist.value.findIndex(item => item.book.id === bookId)
      if (wishlistIndex !== -1) {
        wishlist.value[wishlistIndex].book.status = 'listened'
      }
      
      return true
    } catch (err) {
      error.value = err.message
      console.error('Error marking as listened:', err)
      return false
    }
  }

  const fetchAnalytics = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/analytics')
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const data = await response.json()
      analytics.value = data.summary || {}
      return data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching analytics:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  // Return everything that should be available
  return {
    // State
    books,
    wishlist,
    searchResults,
    analytics,
    isLoading,
    error,
    
    // Getters
    totalBooks,
    wishlistCount,
    upcomingReleases,
    recentReleases,
    
    // Actions
    fetchBooks,
    fetchWishlist,
    searchBooks,
    addToWishlist,
    removeFromWishlist,
    markAsListened,
    fetchAnalytics,
    clearError
  }
})
