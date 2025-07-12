<template>
  <div id="vue-app">
    <div v-cloak>
    <!-- Control Panel - Exact match to legacy -->
    <section class="row mb-4" aria-labelledby="controls-heading">
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" id="controls-heading">Search and Filter Controls</h3>
            <div class="card-actions" v-show="activeFilters > 0" v-if="activeFilters > 0">
              <button type="button" 
                      class="btn btn-sm btn-outline-danger" 
                      @click="clearAllFilters"
                      aria-label="Clear all filters">
                <i class="fas fa-times me-1" aria-hidden="true"></i>
                Clear All ({{ activeFilters }})
              </button>
            </div>
          </div>
          <div class="card-body">
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
        </div>
      </div>
    </section>

    <!-- Statistics Cards - Exact match to legacy -->
    <section class="row row-deck row-cards mb-4" id="stats-cards" aria-labelledby="stats-heading">
      <h3 class="sr-only" id="stats-heading">Statistics Overview</h3>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-info text-white avatar" aria-hidden="true">
                  <i class="fas fa-calendar-alt"></i>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium" id="upcoming-books" aria-label="Number of upcoming books">
                  {{ stats.upcoming_books }}
                </div>
                <div class="text-muted">
                  Upcoming Books
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-success text-white avatar" aria-hidden="true">
                  <i class="fas fa-users"></i>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium" id="total-authors" aria-label="Number of authors">
                  {{ stats.total_authors }}
                </div>
                <div class="text-muted">
                  Authors
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-warning text-white avatar" aria-hidden="true">
                  <i class="fas fa-building"></i>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium" id="total-publishers" aria-label="Number of publishers">
                  {{ stats.total_publishers }}
                </div>
                <div class="text-muted">
                  Publishers
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-danger text-white avatar" aria-hidden="true">
                  <i class="fas fa-plus-circle"></i>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium" id="recent-additions" aria-label="Books added this week">
                  {{ stats.recent_additions }}
                </div>
                <div class="text-muted">
                  Added This Week
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search Results Header - Exact match to legacy -->
    <section class="search-results-header" id="search-results-header" v-show="showSearchResults" aria-labelledby="results-heading">
      <div class="card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div class="search-results-count">
              <h3 class="h5 mb-0" id="results-heading">
                <span id="results-count" aria-live="polite">{{ filteredBooks.length }}</span> books found
              </h3>
            </div>
            <div class="text-muted small">
              Use the controls below to sort and filter results
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- View Mode Toggle - Exact match to legacy -->
    <section class="mb-3" aria-labelledby="view-mode-heading">
      <h3 class="sr-only" id="view-mode-heading">View Mode Selection</h3>
      <div class="d-flex justify-content-between align-items-center">
        <div class="btn-group" role="group" aria-label="Choose view mode">
          <button type="button" 
                  class="btn"
                  :class="viewMode === 'grid' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setViewMode('grid')" 
                  aria-label="Grid view">
            <i class="fas fa-th" aria-hidden="true"></i>
            <span class="d-none d-md-inline ms-1">Grid</span>
          </button>
          <button type="button" 
                  class="btn"
                  :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setViewMode('list')" 
                  aria-label="List view">
            <i class="fas fa-list" aria-hidden="true"></i>
            <span class="d-none d-md-inline ms-1">List</span>
          </button>
        </div>
        <div class="d-flex align-items-center">
          <label for="main-sort-select" class="form-label me-2 mb-0">Sort by:</label>
          <select id="main-sort-select" 
                  class="form-select form-select-sm" 
                  style="width: auto;" 
                  aria-label="Sort audiobooks by"
                  v-model="sortBy"
                  @change="applySorting">
            <option value="release_date">Release Date</option>
            <option value="author">Author</option>
            <option value="title">Title</option>
            <option value="series">Series</option>
          </select>
          <button type="button" 
                  class="btn btn-sm btn-outline-secondary ms-2" 
                  @click="toggleSortOrder"
                  :aria-label="sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'"
                  :title="sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'">
            <i :class="sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'" 
               aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </section>

    <!-- Books Grid View - Exact match to legacy -->
    <section v-if="viewMode === 'grid'" class="row row-cards" id="books-grid" aria-labelledby="books-grid-heading">
      <h3 class="sr-only" id="books-grid-heading">Audiobook Grid View</h3>
      <div v-for="(book, index) in filteredBooks" :key="book.asin || index" class="col-sm-6 col-lg-4">
        <div class="card card-link card-link-pop" :data-book-id="book.asin || index">
          <div class="card-img-top img-responsive img-responsive-21x9">
            <img :src="getImageSrc(book)" 
                 :alt="`Cover image for ${book.title} by ${book.author}`"
                 class="img-fluid card-cover-image"
                 @error="handleImageError"
                 @load="handleImageLoad"
                 loading="lazy"
                 :class="{ 'loading': imageLoading[book.asin || index] }">
          </div>
          <div class="card-body">
            <h3 class="card-title">
              <a :href="book.link || book.audible_url || '#'" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 :aria-label="`View ${book.title} on Audible (opens in new tab)`">
                {{ book.title }}
                <i class="fas fa-external-link-alt ms-1" aria-hidden="true"></i>
              </a>
            </h3>
            <p class="text-muted">
              <i class="fas fa-user me-1" aria-hidden="true"></i>
              {{ book.author }}
            </p>
            <p class="text-muted" v-if="book.series">
              <i class="fas fa-list me-1" aria-hidden="true"></i>
              {{ book.series }}
            </p>
            <p class="text-muted" v-if="book.narrator">
              <i class="fas fa-microphone me-1" aria-hidden="true"></i>
              {{ book.narrator }}
            </p>
          </div>
          <div class="card-footer">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">
                <i class="fas fa-calendar-alt me-1" aria-hidden="true"></i>
                {{ formatDate(book.release_date) }}
              </span>
              <span class="badge bg-primary" v-if="book.publisher">
                {{ book.publisher }}
              </span>
            </div>
          </div>
        </div>
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
    const response = await fetch('/api/upcoming')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    // The /api/upcoming endpoint returns a direct array of books
    books.value = Array.isArray(data) ? data : []
    console.log(`📚 Loaded ${books.value.length} audiobooks`)
  } catch (error) {
    console.error('Error fetching audiobooks:', error)
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
  margin-top: auto;
  padding: 0.75rem 1rem;
  background-color: transparent;
  border-top: 1px solid var(--border-color-light, rgba(0,0,0,0.1));
}

/* Dark mode footer */
[data-theme="dark"] .card-footer {
  border-top-color: var(--border-color-dark, rgba(255,255,255,0.1));
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
</style>
