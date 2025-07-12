<template>
  <div id="vue-app">
    <div v-cloak>
      <!-- Search Header -->
      <section class="mb-4" aria-labelledby="search-heading">
        <header class="static-controls-header">
          <div class="d-flex justify-content-between align-items-center">
            <h3 id="search-heading">Search Audiobooks</h3>
          </div>
        </header>
        
        <!-- Search Form -->
        <div class="controls-content">
          <div class="row g-3">
            <div class="col-lg-4">
              <label for="search-title" class="form-label">Title</label>
              <input 
                id="search-title"
                v-model="searchForm.title"
                type="text" 
                placeholder="Enter book title..."
                class="form-control"
                @keyup.enter="performSearch">
            </div>
            <div class="col-lg-4">
              <label for="search-author" class="form-label">Author</label>
              <input 
                id="search-author"
                v-model="searchForm.author"
                type="text" 
                placeholder="Enter author name..."
                class="form-control"
                @keyup.enter="performSearch">
            </div>
            <div class="col-lg-4">
              <label for="search-series" class="form-label">Series</label>
              <input 
                id="search-series"
                v-model="searchForm.series"
                type="text" 
                placeholder="Enter series name..."
                class="form-control"
                @keyup.enter="performSearch">
            </div>
          </div>

          <!-- Search Actions -->
          <div class="d-flex gap-2 mt-3">
            <button 
              @click="performSearch"
              :disabled="isSearching"
              class="btn btn-primary">
              <i class="fas fa-search me-1"></i>
              {{ isSearching ? 'Searching...' : 'Search' }}
            </button>
            <button 
              @click="clearSearch"
              class="btn btn-outline-secondary">
              <i class="fas fa-times me-1"></i>
              Clear
            </button>
          </div>
        </div>
      </section>

      <!-- Search Results -->
      <section v-if="searchPerformed" class="row row-cards" id="search-results" aria-labelledby="search-results-heading">
        <div class="col-12 mb-3">
          <h3 class="h5 mb-0" id="search-results-heading">
            Search Results ({{ searchResults.length }} found)
          </h3>
        </div>
        
        <!-- Loading State -->
        <div v-if="isSearching" class="col-12">
          <div class="card">
            <div class="card-body text-center py-5">
              <div class="spinner-border text-primary mb-3" role="status" aria-hidden="true"></div>
              <p class="text-muted">Searching...</p>
            </div>
          </div>
        </div>
        
        <!-- No Results -->
        <div v-else-if="searchResults.length === 0" class="col-12">
          <div class="empty">
            <div class="empty-icon">
              <i class="fas fa-search"></i>
            </div>
            <p class="empty-title">No books found</p>
            <p class="empty-subtitle text-muted">Try adjusting your search criteria</p>
          </div>
        </div>
        
        <!-- Search Results -->
        <div v-else v-for="book in searchResults" :key="book.id" class="col-lg-4 col-md-6">
          <article class="card h-100 search-result-card">
            <div class="card-body">
              <div class="row">
                <div class="col-4">
                  <div class="search-image-container mb-3">
                    <img :src="book.cover_url || getImageSrc(book)" 
                         :alt="`Cover of ${book.title}`" 
                         class="search-image img-fluid rounded"
                         loading="lazy"
                         @error="handleImageError">
                  </div>
                </div>
                <div class="col-8">
                  <h5 class="search-title card-title">{{ book.title }}</h5>
                  <p class="text-muted mb-2">{{ book.author }}</p>
                  <p v-if="book.series" class="search-series text-muted mb-2">
                    <i class="fas fa-list me-1"></i>
                    {{ book.series }}
                  </p>
                  <p class="text-muted small mb-2">
                    <i class="fas fa-calendar me-1"></i>
                    Release: {{ formatDate(book.release_date) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Card Footer with Actions -->
            <div class="card-footer bg-light">
              <div class="d-flex justify-content-center">
                <div class="btn-group">
                  <button 
                    @click="addToWishlist(book)"
                    :disabled="book.in_wishlist"
                    :class="book.in_wishlist ? 'btn btn-outline-secondary' : 'btn btn-primary'"
                    class="btn btn-sm">
                    <i :class="book.in_wishlist ? 'fas fa-check' : 'fas fa-heart'" class="me-1"></i>
                    {{ book.in_wishlist ? 'In Wishlist' : 'Add to Wishlist' }}
                  </button>
                  <a v-if="book.audible_url"
                     :href="book.audible_url" 
                     target="_blank"
                     rel="noopener noreferrer"
                     class="btn btn-outline-primary btn-sm">
                    <i class="fas fa-external-link-alt me-1"></i>
                    View
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div> <!-- End v-cloak -->
  </div> <!-- End vue-app -->
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
  if (!dateString) return 'TBD'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return 'TBD'
  }
}

// Image handling - exact match to UpcomingReleases
const getImageSrc = (book) => {
  const imageUrl = book.image_url || book.cover_url || book.thumbnail_url
  if (imageUrl && imageUrl !== 'null' && imageUrl !== '') {
    return imageUrl
  }
  return '/static/images/og-image.png'
}

const handleImageError = (event) => {
  event.target.src = '/static/images/og-image.png'
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

<style scoped>
/* Vue specific styles - match UpcomingReleases */
[v-cloak] { 
  display: none !important; 
}

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

/* Search result card styling */
.search-result-card {
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.search-result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.1);
  border-color: var(--primary-200, #c7d2fe);
}

/* Search image container */
.search-image-container {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--secondary-50, #f8fafc) 0%, var(--secondary-100, #f1f5f9) 100%);
}

.search-image {
  transition: all 0.3s ease;
  border-radius: 6px;
  border: 1px solid var(--border-light, #e2e8f0);
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
}

.search-image:hover {
  transform: scale(1.02);
}

/* Enhanced text styling */
.search-title {
  color: var(--text-primary, #0f172a);
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.search-series {
  color: var(--text-secondary, #475569);
  font-size: 0.85rem;
  font-style: italic;
}

/* Empty state styling - match UpcomingReleases */
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

/* Card consistent sizing */
.row-cards .col-lg-4.col-md-6 {
  display: flex;
  margin-bottom: 1.5rem;
}

.search-result-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-footer {
  margin-top: auto;
  padding: 0.75rem 1rem;
  background-color: transparent;
  border-top: 1px solid var(--border-color-light, rgba(0,0,0,0.1));
}

/* Dark theme overrides */
[data-theme="dark"] .search-result-card {
  background: var(--bg-secondary, #1a1a1a);
  border-color: var(--border-medium, #2d3748);
}

[data-theme="dark"] .search-result-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  border-color: var(--primary-400, #818cf8);
}

[data-theme="dark"] .search-title {
  color: var(--text-primary, #e2e8f0);
}

[data-theme="dark"] .card-footer {
  border-top-color: var(--border-color-dark, rgba(255,255,255,0.1));
}
</style>
