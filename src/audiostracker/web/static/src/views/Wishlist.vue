<template>
  <div id="vue-app">
    <div v-cloak>
      <!-- Wishlist Header -->
      <section class="mb-4" aria-labelledby="wishlist-heading">
        <header class="static-controls-header">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h3 id="wishlist-heading">My Wishlist</h3>
              <p class="text-muted mb-0">{{ wishlistItems.length }} books in your wishlist</p>
            </div>
            <div class="d-flex gap-2">
              <button 
                @click="refreshWishlist"
                :disabled="isLoading"
                class="btn btn-outline-secondary btn-sm">
                <i class="fas fa-sync-alt me-1"></i>
                {{ isLoading ? 'Refreshing...' : 'Refresh' }}
              </button>
              <button 
                @click="exportWishlist"
                class="btn btn-primary btn-sm">
                <i class="fas fa-download me-1"></i>
                Export
              </button>
            </div>
          </div>
        </header>
        
        <!-- Filter and Sort -->
        <div class="controls-content">
          <div class="row g-3">
            <div class="col-lg-4">
              <label for="filter-status" class="form-label">Filter by Status</label>
              <select id="filter-status" v-model="filterStatus" class="form-select">
                <option value="">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="available">Available</option>
                <option value="preorder">Pre-order</option>
              </select>
            </div>
            <div class="col-lg-4">
              <label for="sort-by" class="form-label">Sort by</label>
              <select id="sort-by" v-model="sortBy" class="form-select">
                <option value="release_date">Release Date</option>
                <option value="added_date">Date Added</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
              </select>
            </div>
            <div class="col-lg-4">
              <label for="sort-order" class="form-label">Order</label>
              <select id="sort-order" v-model="sortOrder" class="form-select">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- Wishlist Items -->
      <section class="row row-cards" id="wishlist-items" aria-labelledby="wishlist-items-heading">
        <h3 class="sr-only" id="wishlist-items-heading">Wishlist Items</h3>
        
        <!-- Loading State -->
        <div v-if="isLoading" class="col-12">
          <div class="card">
            <div class="card-body text-center py-5">
              <div class="spinner-border text-primary mb-3" role="status" aria-hidden="true"></div>
              <p class="text-muted">Loading wishlist...</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredWishlist.length === 0" class="col-12">
          <div class="empty">
            <div class="empty-icon">
              <i class="fas fa-heart"></i>
            </div>
            <p class="empty-title">No items in your wishlist yet</p>
            <p class="empty-subtitle text-muted">Start building your wishlist by searching for books</p>
            <div class="empty-action">
              <router-link to="/search" class="btn btn-primary">
                <i class="fas fa-search me-2"></i>
                Search for Books
              </router-link>
            </div>
          </div>
        </div>

        <!-- Wishlist Items -->
        <div v-else v-for="item in filteredWishlist" :key="item.id" class="col-lg-6 col-xl-4">
          <article class="card h-100 wishlist-card">
            <div class="card-body">
              <div class="row">
                <div class="col-4">
                  <div class="wishlist-image-container mb-3">
                    <img :src="item.book.cover_url || getImageSrc(item.book)" 
                         :alt="`Cover of ${item.book.title}`" 
                         class="wishlist-image img-fluid rounded"
                         loading="lazy"
                         @error="handleImageError">
                  </div>
                </div>
                <div class="col-8">
                  <h5 class="wishlist-title card-title">{{ item.book.title }}</h5>
                  <p class="text-muted mb-2">{{ item.book.author }}</p>
                  <p v-if="item.book.series" class="wishlist-series text-muted mb-2">
                    <i class="fas fa-list me-1"></i>
                    {{ item.book.series }}
                  </p>
                  
                  <!-- Status Badge -->
                  <span class="badge mb-2" :class="getStatusBadgeClass(item.book.status)">
                    {{ item.book.status || 'Unknown' }}
                  </span>
                  
                  <!-- Book Details -->
                  <div class="wishlist-details">
                    <div class="d-flex justify-content-between text-sm mb-1">
                      <span class="text-muted">Release:</span>
                      <span>{{ formatDate(item.book.release_date) }}</span>
                    </div>
                    <div class="d-flex justify-content-between text-sm mb-1">
                      <span class="text-muted">Added:</span>
                      <span>{{ formatDate(item.added_date) }}</span>
                    </div>
                    <div v-if="item.book.price" class="d-flex justify-content-between text-sm mb-1">
                      <span class="text-muted">Price:</span>
                      <span>${{ item.book.price }}</span>
                    </div>
                    <div v-if="item.book.length" class="d-flex justify-content-between text-sm">
                      <span class="text-muted">Length:</span>
                      <span>{{ item.book.length }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Description -->
              <div v-if="item.book.description" class="mt-3">
                <p class="text-muted small line-clamp-2">{{ item.book.description }}</p>
              </div>
            </div>

            <!-- Card Footer with Actions -->
            <div class="card-footer bg-light">
              <div class="d-flex justify-content-between align-items-center">
                <div class="btn-group btn-group-sm">
                  <a v-if="item.book.audible_url"
                     :href="item.book.audible_url" 
                     target="_blank"
                     rel="noopener noreferrer"
                     class="btn btn-outline-primary">
                    <i class="fas fa-external-link-alt me-1"></i>
                    View
                  </a>
                  <button v-if="item.book.status === 'available'"
                          @click="markAsListened(item.id)"
                          class="btn btn-outline-success">
                    <i class="fas fa-check me-1"></i>
                    Listened
                  </button>
                </div>
                <button @click="removeFromWishlist(item.id)"
                        class="btn btn-outline-danger btn-sm"
                        title="Remove from wishlist">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div> <!-- End v-cloak -->
  </div> <!-- End vue-app -->
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

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'available':
      return 'bg-success'
    case 'upcoming':
      return 'bg-warning'
    case 'preorder':
      return 'bg-info'
    default:
      return 'bg-secondary'
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

/* Wishlist card styling */
.wishlist-card {
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.wishlist-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.1);
  border-color: var(--primary-200, #c7d2fe);
}

/* Wishlist image container */
.wishlist-image-container {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--secondary-50, #f8fafc) 0%, var(--secondary-100, #f1f5f9) 100%);
}

.wishlist-image {
  transition: all 0.3s ease;
  border-radius: 6px;
  border: 1px solid var(--border-light, #e2e8f0);
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
}

.wishlist-image:hover {
  transform: scale(1.02);
}

/* Enhanced text styling */
.wishlist-title {
  color: var(--text-primary, #0f172a);
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.wishlist-series {
  color: var(--text-secondary, #475569);
  font-size: 0.85rem;
  font-style: italic;
}

.wishlist-details {
  font-size: 0.8rem;
  line-height: 1.4;
}

/* Text truncation for descriptions */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
.row-cards .col-lg-6.col-xl-4 {
  display: flex;
  margin-bottom: 1.5rem;
}

.wishlist-card {
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
[data-theme="dark"] .wishlist-card {
  background: var(--bg-secondary, #1a1a1a);
  border-color: var(--border-medium, #2d3748);
}

[data-theme="dark"] .wishlist-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  border-color: var(--primary-400, #818cf8);
}

[data-theme="dark"] .wishlist-title {
  color: var(--text-primary, #e2e8f0);
}

[data-theme="dark"] .card-footer {
  border-top-color: var(--border-color-dark, rgba(255,255,255,0.1));
}
</style>
