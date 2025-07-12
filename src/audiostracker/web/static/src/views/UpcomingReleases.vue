<template>
  <div id="vue-app">
    <div v-cloak>    <!-- Control Panel - Static header without card -->
    <section class="mb-4" aria-labelledby="controls-heading">
      <header class="static-controls-header">
        <div class="d-flex justify-content-between align-items-center">
          <h3 id="controls-heading">Search and Filter Controls</h3>
          <div v-show="activeFilters > 0" v-if="activeFilters > 0">
            <button type="button" 
                    class="btn btn-sm btn-outline-danger" 
                    @click="clearAllFilters"
                    aria-label="Clear all filters">
              <i class="fas fa-times me-1" aria-hidden="true"></i>
              Clear All ({{ activeFilters }})
            </button>
          </div>
        </div>
      </header>
      <div class="controls-content">
            <div class="row align-items-center g-3">
              <div class="col-lg-6">
                <label for="search-input" class="form-label">Search</label>
                <div class="input-icon">
                  <span class="input-icon-addon" aria-hidden="true">
                    <i class="fas fa-search"></i>
                  </span>
                  <input type="text" 
                         id="search-input" 
                         class="form-control" 
                         placeholder="Search titles, authors, series, narrators, publishers..."
                         aria-describedby="search-help"
                         v-model="filters.search"
                         @input="debounceApplyFilters"
                         @keydown.esc="clearSearch"
                         @keydown.enter.prevent="applyFilters">
                </div>
                <div id="search-help" class="form-text">
                  Use Ctrl+F to quickly focus the search field • Press Escape to clear
                </div>
              </div>
              <div class="col-lg-3">
                <label for="author-filter" class="form-label">Filter by Author</label>
                <select id="author-filter" 
                        class="form-select" 
                        aria-describedby="author-filter-help"
                        v-model="filters.author"
                        @change="applyFilters">
                  <option value="">All Authors</option>
                  <option v-for="author in availableAuthors" :key="author" :value="author">
                    {{ author }}
                  </option>
                </select>
                <div id="author-filter-help" class="form-text">
                  Filter books by specific author
                </div>
              </div>
              <div class="col-lg-3">
                <label for="date-range-filter" class="form-label">Filter by Date Range</label>
                <select id="date-range-filter" 
                        class="form-select" 
                        aria-describedby="date-filter-help"
                        v-model="filters.dateRange"
                        @change="applyFilters">
                  <option value="">All Dates</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="next-3-months">Next 3 Months</option>
                </select>
                <div id="date-filter-help" class="form-text">
                  Filter by release date range
                </div>
              </div>
            </div>
          </div>
        </section>

    <!-- Books Grid View - Updated to match screenshot layout -->
    <section v-if="viewMode === 'grid'" class="row row-cards" id="books-grid" aria-labelledby="books-grid-heading">
      <h3 class="sr-only" id="books-grid-heading">Audiobook Grid View</h3>
      <div v-for="(book, index) in filteredBooks" :key="book.asin || book.id || index" class="col-lg-4 col-md-6 col-sm-12">
        <article class="card h-100 audiobook-card" 
                 role="article" 
                 :aria-labelledby="`book-title-${index}`"
                 :data-book-id="book.asin || book.id || index">
          
          <!-- Card Header with Author and Badges -->
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0 text-primary">{{ book.author }}</h6>
            <div class="btn-group d-flex gap-2 align-items-center">
              <span v-if="isNewRelease(book.release_date)" class="badge bg-danger">This Week</span>
              <span v-else-if="isComingSoon(book.release_date)" class="badge bg-warning">This Month</span>
            </div>
          </div>
          
          <!-- Card Body with Image and Details -->
          <div class="card-body">
            <div class="row">
              <div class="col-4">
                <div class="audiobook-image-container mb-3">
                  <img :src="getImageSrc(book)" 
                       :alt="`Cover of ${book.title}`" 
                       class="audiobook-image img-fluid rounded"
                       loading="lazy"
                       @error="handleImageError"
                       @load="handleImageLoad"
                       :class="{ 'loading': imageLoading[book.asin || book.id || index] }">
                </div>
              </div>
              <div class="col-8">
                <h5 class="audiobook-title card-title" :id="`book-title-${index}`">{{ book.title }}</h5>
                
                <!-- Series Information -->
                <p v-if="book.series" class="audiobook-series text-muted mb-2">
                  <i class="fas fa-list me-1"></i>
                  {{ book.series }}
                  <span v-if="book.series_sequence || book.series_number"> #{{ book.series_sequence || book.series_number }}</span>
                </p>
                
                <!-- Narrator Information -->
                <p v-if="book.narrator" class="audiobook-narrator text-muted mb-2">
                  <i class="fas fa-microphone me-1"></i>
                  {{ book.narrator }}
                </p>
                
                <!-- Publisher Information -->
                <p v-if="book.publisher_name || book.publisher" class="text-muted mb-2">
                  <i class="fas fa-building me-1"></i>
                  {{ book.publisher_name || book.publisher }}
                </p>
                
                <!-- Release Information -->
                <div class="release-info">
                  <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-calendar-day text-primary me-2"></i>
                    <span class="release-badge">{{ formatDate(book.release_date) }}</span>
                  </div>
                  <div class="d-flex align-items-center">
                    <i class="fas fa-clock text-muted me-2"></i>
                    <span class="text-muted small">{{ getTimeToRelease(book.release_date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Card Footer with Action Buttons -->
          <div class="card-footer bg-light">
            <div class="audiobook-actions d-flex justify-content-center">
              <div class="btn-group-unified">
                  <a v-if="book.link || book.audible_url" 
                     :href="book.link || book.audible_url" 
                     target="_blank" 
                     rel="noopener noreferrer"
                     class="btn btn-outline-primary"
                     :aria-label="`View ${book.title} on Audible`">
                    <i class="fas fa-external-link-alt me-1"></i>
                    <span class="d-none d-md-inline">View</span>
                  </a>
                  <a v-if="book.asin" 
                     :href="`/api/ical/download/${book.asin}`" 
                     download
                     class="btn btn-outline-success"
                     :aria-label="`Download calendar event for ${book.title}`">
                    <i class="fas fa-calendar-plus me-1"></i>
                    <span class="d-none d-md-inline">iCal</span>
                  </a>
                  <button type="button" 
                          class="btn btn-outline-secondary"
                          @click="showBookDetails(book)"
                          :aria-label="`Show details for ${book.title}`">
                    <i class="fas fa-info-circle me-1"></i>
                    <span class="d-none d-md-inline">Details</span>
                  </button>
                </div>
              </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Books List View - Exact match to legacy -->
    <section v-if="viewMode === 'list'" class="card" id="books-list" aria-labelledby="books-list-heading">
      <h3 class="sr-only" id="books-list-heading">Audiobook List View</h3>
      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th>Cover</th>
              <th>Title</th>
              <th>Author</th>
              <th>Series</th>
              <th>Release Date</th>
              <th>Publisher</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(book, index) in filteredBooks" :key="book.asin || index">
              <td>
                <div class="avatar avatar-sm">
                  <img :src="getImageSrc(book)" 
                       :alt="`Cover for ${book.title}`"
                       @error="handleImageError"
                       loading="lazy"
                       class="img-fluid">
                </div>
              </td>
              <td>
                <strong>{{ book.title }}</strong>
                <div class="text-muted" v-if="book.narrator">
                  <i class="fas fa-microphone me-1" aria-hidden="true"></i>
                  {{ book.narrator }}
                </div>
              </td>
              <td>{{ book.author }}</td>
              <td>{{ book.series || '-' }}</td>
              <td>{{ formatDate(book.release_date) }}</td>
              <td>
                <span class="badge bg-primary" v-if="book.publisher">
                  {{ book.publisher }}
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <a :href="book.link || book.audible_url || '#'" 
                   class="btn btn-sm btn-outline-primary"
                   target="_blank" 
                   rel="noopener noreferrer"
                   :aria-label="`View ${book.title} on Audible (opens in new tab)`">
                  <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Empty State - Exact match to legacy -->
    <section v-if="filteredBooks.length === 0" class="empty" id="empty-state" aria-labelledby="empty-heading">
      <div class="empty-icon">
        <i class="fas fa-search"></i>
      </div>
      <p class="empty-title" id="empty-heading">No audiobooks found</p>
      <p class="empty-subtitle text-muted">
        {{ hasActiveFilters ? 'Try adjusting your search criteria or filters' : 'No upcoming audiobooks available at the moment' }}
      </p>
      <div class="empty-action" v-if="hasActiveFilters">
        <button class="btn btn-primary" @click="clearAllFilters">
          <i class="fas fa-times me-2" aria-hidden="true"></i>
          Clear all filters
        </button>
      </div>
    </section>
    </div> <!-- End v-cloak -->
  </div> <!-- End vue-app -->
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// === REACTIVE DATA - EXACT MATCH TO LEGACY ===
const books = ref([])
const isLoading = ref(false)
const imageLoading = ref({})

// Filters - exact match to legacy structure
const filters = ref({
  search: '',
  author: '',
  dateRange: ''
})

// View mode and sorting - exact match to legacy
const viewMode = ref('grid')
const sortBy = ref('release_date')
const sortOrder = ref('asc')

// Search timeout for debouncing
let searchTimeout = null

// === COMPUTED PROPERTIES - EXACT MATCH TO LEGACY ===

// Available authors for filter dropdown
const availableAuthors = computed(() => {
  const authors = [...new Set(books.value.map(book => book.author).filter(Boolean))]
  return authors.sort()
})

// Active filters count
const activeFilters = computed(() => {
  let count = 0
  if (filters.value.search) count++
  if (filters.value.author) count++
  if (filters.value.dateRange) count++
  return count
})

// Check if there are active filters
const hasActiveFilters = computed(() => activeFilters.value > 0)

// Show search results header
const showSearchResults = computed(() => {
  return hasActiveFilters.value || books.value.length > 0
})

// Filtered books based on all filters
const filteredBooks = computed(() => {
  let filtered = [...books.value]
  console.log('🔍 Filtering books - Total:', books.value.length)

  // Search filter
  if (filters.value.search) {
    const searchTerm = filters.value.search.toLowerCase()
    filtered = filtered.filter(book => {
      return (
        book.title?.toLowerCase().includes(searchTerm) ||
        book.author?.toLowerCase().includes(searchTerm) ||
        book.series?.toLowerCase().includes(searchTerm) ||
        book.narrator?.toLowerCase().includes(searchTerm) ||
        book.publisher?.toLowerCase().includes(searchTerm)
      )
    })
    console.log('🔍 After search filter:', filtered.length)
  }

  // Author filter
  if (filters.value.author) {
    filtered = filtered.filter(book => book.author === filters.value.author)
    console.log('🔍 After author filter:', filtered.length)
  }

  // Date range filter
  if (filters.value.dateRange) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    filtered = filtered.filter(book => {
      const releaseDate = new Date(book.release_date)
      
      switch (filters.value.dateRange) {
        case 'this-week':
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          return releaseDate >= today && releaseDate <= weekFromNow
        case 'this-month':
          const monthFromNow = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
          return releaseDate >= today && releaseDate <= monthFromNow
        case 'next-3-months':
          const threeMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
          return releaseDate >= today && releaseDate <= threeMonthsFromNow
        default:
          return true
      }
    })
    console.log('🔍 After date filter:', filtered.length)
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let aValue, bValue
    
    switch (sortBy.value) {
      case 'title':
        aValue = a.title || ''
        bValue = b.title || ''
        break
      case 'author':
        aValue = a.author || ''
        bValue = b.author || ''
        break
      case 'series':
        aValue = a.series || ''
        bValue = b.series || ''
        break
      case 'release_date':
      default:
        aValue = new Date(a.release_date || 0)
        bValue = new Date(b.release_date || 0)
        break
    }

    if (sortBy.value === 'release_date') {
      return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
    } else {
      const result = aValue.localeCompare(bValue)
      return sortOrder.value === 'asc' ? result : -result
    }
  })

  console.log('📊 Final filtered books:', filtered.length)
  return filtered
})

// Statistics - exact match to legacy
const stats = ref({
  upcoming_books: 0,
  total_authors: 0,
  total_publishers: 0,
  recent_additions: 0
})

// Fetch stats separately
const fetchStats = async () => {
  try {
    const response = await fetch('/api/audiobooks')
    if (response.ok) {
      const data = await response.json()
      if (data.stats) {
        stats.value = {
          upcoming_books: data.stats.total_books || 0,
          total_authors: data.stats.total_authors || 0,
          total_publishers: data.stats.total_publishers || 0,
          recent_additions: data.stats.total_books || 0 // Use total as fallback
        }
        console.log('📊 Stats loaded:', stats.value)
      }
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
}

// === METHODS - EXACT MATCH TO LEGACY ===

// Image handling - exact match to legacy with og-image.png fallback
const getImageSrc = (book) => {
  // Check multiple possible image fields
  const imageUrl = book.image_url || book.cover_url || book.thumbnail_url
  if (imageUrl && imageUrl !== 'null' && imageUrl !== '') {
    return imageUrl
  }
  // Fallback to og-image.png - exact match to legacy
  return '/static/images/og-image.png'
}

const handleImageError = (event) => {
  // On error, use og-image.png fallback - exact match to legacy
  event.target.src = '/static/images/og-image.png'
  const bookId = event.target.closest('[data-book-id]')?.dataset.bookId
  if (bookId) {
    imageLoading.value[bookId] = false
  }
}

const handleImageLoad = (event) => {
  const bookId = event.target.closest('[data-book-id]')?.dataset.bookId
  if (bookId) {
    imageLoading.value[bookId] = false
  }
}

// Date formatting - exact match to legacy
const formatDate = (dateString) => {
  if (!dateString) return 'TBD'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'TBD'
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return 'TBD'
  }
}

// Filter and search methods - exact match to legacy
const applyFilters = () => {
  // Filters are computed, so this is mainly for manual triggering
}

const debounceApplyFilters = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 300)
}

const clearSearch = () => {
  filters.value.search = ''
  applyFilters()
}

const clearAllFilters = () => {
  filters.value.search = ''
  filters.value.author = ''
  filters.value.dateRange = ''
  applyFilters()
}

// View mode methods - exact match to legacy
const setViewMode = (mode) => {
  viewMode.value = mode
  localStorage.setItem('audiobooks-view-mode', mode)
}

// Sorting methods - exact match to legacy
const applySorting = () => {
  // Sorting is computed, so this is mainly for manual triggering
}

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// Data fetching - exact match to legacy API structure
const fetchBooks = async () => {
  isLoading.value = true
  
  try {
    console.log('🔄 Fetching audiobooks from /api/upcoming...')
    const response = await fetch('/api/upcoming')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    console.log('📦 Raw API response:', data)
    
    // The /api/upcoming endpoint returns a direct array of books
    books.value = Array.isArray(data) ? data : []
    console.log(`📚 Loaded ${books.value.length} audiobooks`)
    
    if (books.value.length > 0) {
      console.log('📖 Sample book data:', books.value[0])
    }
  } catch (error) {
    console.error('❌ Error fetching audiobooks:', error)
    books.value = []
  } finally {
    isLoading.value = false
  }
}

// Keyboard shortcuts - exact match to legacy
const handleKeydown = (event) => {
  if (event.ctrlKey && event.key === 'f') {
    event.preventDefault()
    document.getElementById('search-input')?.focus()
  }
}

// Additional helper methods for audiobook cards
const getTimeToRelease = (dateString) => {
  if (!dateString) return 'Date TBD'
  
  try {
    const releaseDate = new Date(dateString)
    if (isNaN(releaseDate.getTime())) return 'Date TBD'
    
    const now = new Date()
    const diffTime = releaseDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return 'Already released'
    } else if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Less than a day'
    } else if (isThisWeek(releaseDate)) {
      return 'This week'
    } else if (isThisMonth(releaseDate)) {
      return 'This month'
    } else if (diffDays <= 30) {
      return 'Next month'
    } else if (diffDays <= 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''}`
    } else {
      const years = Math.floor(diffDays / 365)
      return `${years} year${years > 1 ? 's' : ''}`
    }
  } catch (error) {
    return 'Date TBD'
  }
}

const isThisWeek = (releaseDate) => {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Start of this week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // End of this week (Saturday)
  endOfWeek.setHours(23, 59, 59, 999)
  
  return releaseDate >= startOfWeek && releaseDate <= endOfWeek
}

const isThisMonth = (releaseDate) => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  
  return releaseDate >= startOfMonth && releaseDate <= endOfMonth
}

const isNewRelease = (dateString) => {
  if (!dateString) return false
  
  try {
    const releaseDate = new Date(dateString)
    if (isNaN(releaseDate.getTime())) return false
    
    const now = new Date()
    const diffTime = releaseDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // "This Week" badge for releases within 7 days
    return diffDays >= 0 && diffDays <= 7
  } catch (error) {
    return false
  }
}

const isComingSoon = (dateString) => {
  if (!dateString) return false
  
  try {
    const releaseDate = new Date(dateString)
    if (isNaN(releaseDate.getTime())) return false
    
    const now = new Date()
    const diffTime = releaseDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // "This Month" badge for releases within 8-30 days
    return diffDays >= 8 && diffDays <= 30
  } catch (error) {
    return false
  }
}

const showBookDetails = (book) => {
  // Create a detailed view of the book information
  const detailsContent = `
    <div class="book-details-modal">
      <div class="row">
        <div class="col-md-4">
          <img src="${book.cover_url || book.image_url || '/static/images/og-image.png'}" 
               alt="Cover of ${book.title}" 
               class="img-fluid rounded">
        </div>
        <div class="col-md-8">
          <h3>${book.title}</h3>
          <p class="text-muted mb-3">by ${book.author}</p>
          
          ${book.series ? `<p><strong>Series:</strong> ${book.series}${book.series_sequence || book.series_number ? ` #${book.series_sequence || book.series_number}` : ''}</p>` : ''}
          ${book.narrator ? `<p><strong>Narrator:</strong> ${book.narrator}</p>` : ''}
          ${book.publisher_name || book.publisher ? `<p><strong>Publisher:</strong> ${book.publisher_name || book.publisher}</p>` : ''}
          <p><strong>Release Date:</strong> ${formatDate(book.release_date)} (${getTimeToRelease(book.release_date)})</p>
          ${book.asin ? `<p><strong>ASIN:</strong> ${book.asin}</p>` : ''}
          ${book.last_checked ? `<p><strong>Last Updated:</strong> ${formatDate(book.last_checked)}</p>` : ''}
          
          ${book.merchandising_summary || book.description ? `<div class="mt-3"><h5>Description</h5><p>${book.merchandising_summary || book.description}</p></div>` : ''}
          
          <div class="mt-4">
            ${book.link || book.audible_url ? `<a href="${book.link || book.audible_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary me-2">View on Audible</a>` : ''}
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `
  
  // For now, use alert as fallback - this can be enhanced with a proper modal later
  const simpleDetails = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    book.series ? `Series: ${book.series}${book.series_sequence || book.series_number ? ` #${book.series_sequence || book.series_number}` : ''}` : '',
    book.narrator ? `Narrator: ${book.narrator}` : '',
    book.publisher_name || book.publisher ? `Publisher: ${book.publisher_name || book.publisher}` : '',
    `Release Date: ${formatDate(book.release_date)} (${getTimeToRelease(book.release_date)})`,
    book.merchandising_summary || book.description ? `\nDescription: ${book.merchandising_summary || book.description}` : ''
  ].filter(Boolean).join('\n')
  
  alert(simpleDetails)
}

// === LIFECYCLE - EXACT MATCH TO LEGACY ===
onMounted(() => {
  console.log('🔧 UpcomingReleases component mounted')
  
  // Load saved view mode
  const savedViewMode = localStorage.getItem('audiobooks-view-mode')
  if (savedViewMode) {
    viewMode.value = savedViewMode
    console.log('📱 Loaded saved view mode:', savedViewMode)
  }

  // Add keyboard event listener
  document.addEventListener('keydown', handleKeydown)

  // Listen for refresh events
  window.addEventListener('refresh-data', fetchBooks)

  // Initial data fetch
  fetchBooks()
  fetchStats()
})

onUnmounted(() => {
  console.log('🔧 UpcomingReleases component unmounted')
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('refresh-data', fetchBooks)
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})
</script>

<style scoped>
/* Vue specific styles - exact match to legacy upcoming.html */
[v-cloak] { 
  display: none !important; 
}

/* Ensure smooth view mode transitions - exact match to legacy */
.row-cards,
.list-group {
  transition: opacity 250ms ease-in-out;
}

/* Filter badge transitions - exact match to legacy */
.card-actions {
  transition: opacity 250ms ease-in-out, transform 250ms ease-in-out;
}

/* Image loading states - exact match to legacy */
.img-fluid.loading {
  opacity: 0.6;
}

/* Card hover effects - exact match to legacy */
.card-link-pop:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Avatar styling for list view */
.avatar-sm {
  width: 2rem;
  height: 2rem;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Input icon positioning - exact match to legacy */
.input-icon {
  position: relative;
}

.input-icon-addon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  z-index: 3;
}

.input-icon .form-control {
  padding-left: 2.5rem;
}

/* Background image card styling - improved for book covers */
.img-responsive {
  background-color: var(--card-bg, #f8f9fa);
  border-bottom: 1px solid var(--border-color-light, rgba(0,0,0,0.1));
  overflow: hidden;
}

.img-responsive-21x9 {
  height: 200px; /* Fixed height for cover area */
  min-height: 200px;
  max-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem; /* Small padding around image */
}

.card-cover-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* Show full image without cropping */
  object-position: center;
  transition: transform 0.2s ease;
  border-radius: 0.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card:hover .card-cover-image {
  transform: scale(1.02);
}

/* Dark mode image container */
[data-theme="dark"] .img-responsive {
  background-color: var(--card-bg-dark, #2d3748);
  border-bottom-color: var(--border-color-dark, rgba(255,255,255,0.1));
}

/* Mobile responsive improvements - exact match to legacy */
@media (max-width: 768px) {
  .mobile-view .card-img-top {
    height: 150px !important;
  }
  
  .mobile-layout .btn-group {
    display: flex;
    flex-direction: column;
  }
  
  .mobile-layout .btn-group .btn {
    margin-bottom: 0.25rem;
  }
}

/* Stat cards styling to match legacy */
.font-weight-medium {
  font-weight: 600;
  font-size: 1.25rem;
}

.avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Empty state styling - exact match to legacy */
.empty {
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-subtitle {
  margin-bottom: 1.5rem;
}

/* Card consistent sizing - ensure all cards are same height */
.row-cards {
  display: flex;
  flex-wrap: wrap;
}

.row-cards .col-sm-6.col-lg-4 {
  display: flex;
  margin-bottom: 1.5rem;
}

.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  min-height: 140px; /* Consistent minimum height for content */
}

.card-title {
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  line-height: 1.3;
  height: 2.6rem; /* Fixed height for 2 lines */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-body p {
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.card-body p:last-of-type {
  margin-bottom: auto; /* Push footer to bottom */
}

.card-footer {
  background: var(--bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  position: relative;
  z-index: 2;
  padding: 0.5rem 1rem;
  min-height: unset;
}

/* Dark mode footer */
[data-theme="dark"] .card-footer {
  border-top-color: var(--border-color-dark, rgba(255,255,255,0.1));
  font-size: 1rem;

/* Author, series, narrator info consistent spacing */
.card-body .text-muted {
  font-size: 0.9rem;
  line-height: 1.3;
  margin-bottom: 0.4rem;
  min-height: 1.3em; /* Reserve space even when empty */
}

/* Ensure all badges are same size */
.badge {
  font-size: 0.75rem;
  padding: 0.25em 0.5em;
  white-space: nowrap;
.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  border-radius: 8px;
  margin-bottom: 1rem;
}
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

  padding: 0.75rem 1rem;
  min-height: 110px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 0;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}
.card-footer {
  margin-top: auto;
  padding: 0.5rem 1rem;
  background-color: transparent;
  border-top: 1px solid var(--border-color-light, rgba(0,0,0,0.1));
}

.audiobook-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.02) 0%, rgba(99, 102, 241, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
  pointer-events: none;
}

.audiobook-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
  border-color: var(--primary-200, #c7d2fe);
}

.audiobook-card:hover::before {
  opacity: 1;
}

/* Book image container */
.audiobook-image-container {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--secondary-50, #f8fafc) 0%, var(--secondary-100, #f1f5f9) 100%);
}

.audiobook-image {
  transition: all 0.3s ease;
  border-radius: 6px;
  border: 1px solid var(--border-light, #e2e8f0);
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
}

.audiobook-image:hover {
  transform: scale(1.02);
}

/* Enhanced text styling */
.audiobook-title {
  color: var(--text-primary, #0f172a);
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.audiobook-author {
  color: var(--primary-600, #4f46e5);
  font-weight: 500;
  font-size: 0.9rem;
}

.audiobook-series {
  color: var(--text-secondary, #475569);
  font-size: 0.85rem;
  font-style: italic;
}

.audiobook-narrator {
  color: var(--text-muted, #64748b);
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.audiobook-narrator i {
  color: var(--accent-amber, #d97706);
}

/* Release date badges */
.release-badge {
  background: linear-gradient(135deg, var(--primary-500, #6366f1) 0%, var(--primary-600, #4f46e5) 100%);
  color: white;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Action buttons */
.audiobook-actions {
  position: relative;
  z-index: 2;
}

.btn-group-unified {
  display: flex;
  gap: 0.25rem;
}

.btn-group-unified .btn {
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-group-unified .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn-group-unified .btn i {
  font-size: 0.8rem;
}

/* Harmonize button colors for better visual cohesion */
.btn-group-unified .btn-outline-primary {
  border-color: #4f46e5;
  color: #4f46e5;
}

.btn-group-unified .btn-outline-primary:hover {
  background-color: #4f46e5;
  border-color: #4f46e5;
}

.btn-group-unified .btn-outline-success {
  border-color: #059669;
  color: #059669;
}

.btn-group-unified .btn-outline-success:hover {
  background-color: #059669;
  border-color: #059669;
}

.btn-group-unified .btn-outline-secondary {
  border-color: #6b7280;
  color: #6b7280;
}

.btn-group-unified .btn-outline-secondary:hover {
  background-color: #6b7280;
  border-color: #6b7280;
}

/* Card header and footer improvements */
.card-header {
  background: var(--bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  position: relative;
  z-index: 2;
}

/* Ensure iCal button always has a green outline */
.btn-outline-success {
  border-color: #198754 !important;
  color: #198754 !important;
  background-color: transparent !important;
}
.btn-outline-success:hover, .btn-outline-success:focus {
  background-color: #198754 !important;
  color: #fff !important;
  border-color: #198754 !important;
}

.card-footer {
  background: var(--bg-secondary, #f8fafc);
  border-top: 1px solid var(--border-light, #e2e8f0);
  position: relative;
  z-index: 2;
}

/* Fix double arrow (vvv) on .form-select and .form-select-sm */
select.form-select, select.form-select-sm {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' class='feather feather-chevron-down' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25em 1.25em;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 2.5rem;
}

.card-body {
  position: relative;
  z-index: 2;
}

/* Dark theme overrides for audiobook cards */
body.dark-theme .audiobook-card,
[data-theme="dark"] .audiobook-card {
  background: var(--bg-secondary, #1a1a1a);
  border-color: var(--border-medium, #2d3748);
}

body.dark-theme .audiobook-card:hover,
[data-theme="dark"] .audiobook-card:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  border-color: var(--primary-400, #818cf8);
}

body.dark-theme .audiobook-title,
[data-theme="dark"] .audiobook-title {
  color: var(--text-primary, #e2e8f0);
}

body.dark-theme .card-header,
body.dark-theme .card-footer,
[data-theme="dark"] .card-header,
[data-theme="dark"] .card-footer {
  background: var(--bg-tertiary, #2d3748);
  border-color: var(--border-medium, #4a5568);
}

/* Legacy header styling options - Choose one by uncommenting */

/* Static controls header - clean and minimal */
.static-controls-header {
  padding: 1rem 0 0.75rem 0;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
}

.static-controls-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.controls-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
}

/* Dark mode support for controls header and content */
[data-theme="dark"] .static-controls-header,
.dark-theme .static-controls-header {
  border-bottom: 1px solid #374151;
}

[data-theme="dark"] .static-controls-header h3,
.dark-theme .static-controls-header h3 {
  color: #e5e7eb;
}

[data-theme="dark"] .controls-content,
.dark-theme .controls-content {
  background: #23272f;
  border: 1px solid #374151;
}

/* Option 1: Minimal flat header (currently active) */
.legacy-header {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
}

/* Option 2: Subtle accent header (uncomment to use) */
/*
.legacy-header {
  background: #f1f5f9;
  border-left: 3px solid #6366f1;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.6rem 1rem;
  font-weight: 600;
  font-size: 0.9rem;
}
*/

/* Option 3: Clean modern header (uncomment to use) */
/*
.legacy-header {
  background: transparent;
  border-bottom: 2px solid #f1f5f9;
  padding: 0.5rem 0;
  font-weight: 600;
  font-size: 0.9rem;
  color: #475569;
}
*/

/* Option 4: Badge-style compact header (uncomment to use) */
/*
.legacy-header {
  background: #6366f1;
  color: white;
  padding: 0.4rem 1rem;
  font-weight: 500;
  font-size: 0.85rem;
  border-radius: 6px 6px 0 0;
  border: none;
}
*/
</style>
