<template>
  <div>
    <!-- Control Panel -->
    <section class="row mb-4" aria-labelledby="controls-heading">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title" id="controls-heading">Search and Filter Controls</h3>
            <div class="card-actions" v-if="activeFilters > 0">
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
                         @input="filterAudiobooks">
                </div>
                <div id="search-help" class="form-text">Search across all audiobook fields</div>
              </div>
              <div class="col-lg-3">
                <label for="author-filter" class="form-label">Author</label>
                <select id="author-filter" 
                        class="form-select" 
                        v-model="filters.author"
                        @change="filterAudiobooks">
                  <option value="">All Authors</option>
                  <option v-for="author in uniqueAuthors" :key="author" :value="author">
                    {{ author }}
                  </option>
                </select>
              </div>
              <div class="col-lg-3">
                <label for="month-filter" class="form-label">Release Month</label>
                <select id="month-filter" 
                        class="form-select" 
                        v-model="filters.month"
                        @change="filterAudiobooks">
                  <option value="">All Months</option>
                  <option v-for="month in releaseMonths" :key="month.value" :value="month.value">
                    {{ month.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics Cards -->
    <section class="row mb-4" aria-labelledby="stats-heading">
      <div class="col">
        <h3 class="sr-only" id="stats-heading">Collection Statistics</h3>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-primary">{{ stats.upcoming_books }}</div>
                <div class="text-muted">Upcoming Books</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-success">{{ stats.total_authors }}</div>
                <div class="text-muted">Authors</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-warning">{{ stats.total_publishers }}</div>
                <div class="text-muted">Publishers</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-info">{{ stats.recent_additions }}</div>
                <div class="text-muted">New This Week</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Actions -->
    <section class="row mb-4">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title">Quick Actions</h3>
          </div>
          <div class="card-body">
            <div class="row g-2">
              <div class="col-auto">
                <button type="button" class="btn btn-primary" @click="refreshData">
                  <i class="fas fa-sync-alt me-1" :class="{ 'fa-spin': isRefreshing }" aria-hidden="true"></i>
                  {{ isRefreshing ? 'Refreshing...' : 'Refresh Data' }}
                </button>
              </div>
              <div class="col-auto">
                <button type="button" class="btn btn-success" @click="exportIcal" :disabled="filteredAudiobooks.length === 0">
                  <i class="fas fa-calendar-download me-1" aria-hidden="true"></i>
                  Export Calendar
                </button>
              </div>
              <div class="col-auto">
                <router-link to="/authors" class="btn btn-outline-primary">
                  <i class="fas fa-users me-1" aria-hidden="true"></i>
                  Manage Authors
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Audiobooks List -->
    <section class="row" aria-labelledby="audiobooks-heading">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title" id="audiobooks-heading">
              Upcoming Audiobooks
              <span class="badge bg-secondary ms-2">{{ filteredAudiobooks.length }}</span>
            </h3>
          </div>
          <div class="card-body">
            <div v-if="isLoading" class="text-center py-5">
              <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading audiobooks...</span>
              </div>
              <p class="text-muted">Loading upcoming audiobooks...</p>
            </div>
            
            <div v-else-if="filteredAudiobooks.length === 0" class="text-center py-5">
              <i class="fas fa-book-open fa-3x text-muted mb-3"></i>
              <h4>No upcoming audiobooks found</h4>
              <p class="text-muted">Try adjusting your filters or check back later for new releases.</p>
              <router-link to="/authors" class="btn btn-primary">
                <i class="fas fa-plus me-1"></i>
                Add Authors to Track
              </router-link>
            </div>
            
            <div v-else class="row g-3">
              <div v-for="audiobook in filteredAudiobooks" 
                   :key="audiobook.asin" 
                   class="col-12 col-md-6 col-lg-4">
                <div class="card book-card theme-card h-100">
                  <div class="card-body">
                    <div class="row">
                      <div class="col-5">
                        <img :src="getImageSrc(audiobook)" 
                             :alt="audiobook.title"
                             class="audiobook-image w-100 rounded"
                             @error="handleImageError"
                             loading="lazy">
                      </div>
                      <div class="col-7">
                        <h5 class="card-title mb-1" style="font-size: 0.9rem; line-height: 1.2;">
                          {{ audiobook.title }}
                        </h5>
                        <p class="text-muted mb-1" style="font-size: 0.85rem;">
                          <strong>{{ audiobook.author }}</strong>
                        </p>
                        <p v-if="audiobook.series" class="text-muted mb-1" style="font-size: 0.8rem;">
                          {{ audiobook.series }}
                          <span v-if="audiobook.series_number">#{{ audiobook.series_number }}</span>
                        </p>
                        <p class="text-muted mb-2" style="font-size: 0.8rem;">
                          <i class="fas fa-microphone me-1"></i>
                          {{ audiobook.narrator }}
                        </p>
                        <div class="d-flex align-items-center justify-content-between">
                          <span class="badge bg-primary">{{ formatDate(audiobook.release_date) }}</span>
                          <div class="btn-group" role="group">
                            <a v-if="audiobook.link" 
                               :href="audiobook.link" 
                               target="_blank" 
                               class="btn btn-sm btn-outline-primary"
                               title="View on Audible">
                              <i class="fas fa-external-link-alt"></i>
                            </a>
                            <button type="button" 
                                    class="btn btn-sm btn-outline-success"
                                    @click="downloadIcal(audiobook)"
                                    title="Add to calendar">
                              <i class="fas fa-calendar-plus"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const isLoading = ref(false)
const isRefreshing = ref(false)
const audiobooks = ref([])
const stats = ref({
  upcoming_books: 0,
  total_authors: 0,
  total_publishers: 0,
  recent_additions: 0
})

const filters = ref({
  search: '',
  author: '',
  month: ''
})

const filteredAudiobooks = computed(() => {
  let filtered = audiobooks.value

  if (filters.value.search) {
    const searchTerm = filters.value.search.toLowerCase()
    filtered = filtered.filter(book => 
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm) ||
      book.series?.toLowerCase().includes(searchTerm) ||
      book.narrator?.toLowerCase().includes(searchTerm) ||
      book.publisher?.toLowerCase().includes(searchTerm)
    )
  }

  if (filters.value.author) {
    filtered = filtered.filter(book => book.author === filters.value.author)
  }

  if (filters.value.month) {
    filtered = filtered.filter(book => 
      book.release_date && book.release_date.startsWith(filters.value.month)
    )
  }

  return filtered
})

const uniqueAuthors = computed(() => {
  const authors = [...new Set(audiobooks.value.map(book => book.author))]
  return authors.sort()
})

const releaseMonths = computed(() => {
  const months = []
  const now = new Date()
  
  // Get current month and next 11 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    
    months.push({
      value: `${year}-${month}`,
      label: monthName
    })
  }
  
  return months
})

// Helper function to get the correct image source
const getImageSrc = (audiobook) => {
  // If there's a valid image URL, use it
  if (audiobook.image_url && audiobook.image_url.trim() && audiobook.image_url !== 'null') {
    return audiobook.image_url
  }
  
  // Check for cover_url as fallback (matching legacy pattern)
  if (audiobook.cover_url && audiobook.cover_url.trim() && audiobook.cover_url !== 'null') {
    return audiobook.cover_url
  }
  
  // Otherwise use the og-image.png as fallback
  return '/static/images/og-image.png'
}

const activeFilters = computed(() => {
  return Object.values(filters.value).filter(Boolean).length
})

const formatDate = (dateString) => {
  if (!dateString) return 'TBD'
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

const handleImageError = (event) => {
  const img = event.target;
  if (img.src !== '/static/images/og-image.png') {
    img.src = '/static/images/og-image.png';
    console.warn('Failed to load book cover, using fallback:', img.alt);
  }
}

const filterAudiobooks = () => {
  // Trigger reactivity (filters are already reactive)
}

const clearAllFilters = () => {
  filters.value.search = ''
  filters.value.author = ''
  filters.value.month = ''
}

const refreshData = async () => {
  isRefreshing.value = true
  try {
    await Promise.all([
      loadAudiobooks(),
      loadStats()
    ])
  } finally {
    isRefreshing.value = false
  }
}

const loadAudiobooks = async () => {
  try {
    const response = await fetch('/api/upcoming')
    if (response.ok) {
      audiobooks.value = await response.json()
    } else {
      console.error('Failed to load audiobooks')
      // Fallback to mock data for development
      audiobooks.value = []
    }
  } catch (error) {
    console.error('Error loading audiobooks:', error)
    audiobooks.value = []
  }
}

const loadStats = async () => {
  try {
    const response = await fetch('/api/database/stats')
    if (response.ok) {
      stats.value = await response.json()
    } else {
      console.error('Failed to load stats')
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const exportIcal = async () => {
  try {
    // Create iCal content for all filtered audiobooks
    // This would need to be implemented on the backend
    alert('iCal export functionality coming soon!')
  } catch (error) {
    console.error('Error exporting calendar:', error)
  }
}

const downloadIcal = async (audiobook) => {
  try {
    const response = await fetch(`/api/ical/download/${audiobook.asin}`)
    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${audiobook.title.replace(/[^a-z0-9]/gi, '_')}_${audiobook.asin}.ics`
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      throw new Error('Failed to download calendar file')
    }
  } catch (error) {
    console.error('Error downloading calendar:', error)
    alert('Error downloading calendar file. Please try again.')
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      loadAudiobooks(),
      loadStats()
    ])
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.book-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.text-h1 {
  font-size: 2rem;
  font-weight: 600;
}

/* Image Loading Improvements */
.audiobook-image {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  transition: opacity 0.3s ease, filter 0.3s ease;
  display: block;
  aspect-ratio: 1;
  object-fit: cover;
  width: 100%;
  height: auto;
  max-width: 240px;
}

.audiobook-image:not([src]),
.audiobook-image[src=""] {
  opacity: 0.7;
  filter: grayscale(100%);
}

.audiobook-image[src]:not([src=""]) {
  opacity: 1;
  filter: none;
}

/* Loading state for images */
.audiobook-image.loading {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Smooth card transitions */
.book-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid var(--border-light, #dee2e6);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-primary, #ffffff);
  position: relative;
}

.book-card::before {
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

.book-card:hover::before {
  opacity: 1;
}

.book-card .card-body {
  position: relative;
  z-index: 2;
}

/* Better responsive image handling */
@media (max-width: 768px) {
  .audiobook-image {
    max-width: 200px;
  }
}

@media (max-width: 576px) {
  .audiobook-image {
    max-width: 160px;
  }
}
</style>
