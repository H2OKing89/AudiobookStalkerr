<template>
  <div id="vue-app">
    <div v-cloak>
      <!-- Welcome Section -->
      <section class="mb-4">
        <div class="card">
          <div class="card-body p-4">
            <h1 class="card-title h2 mb-2">Welcome to AudioBook Tracker</h1>
            <p class="text-muted">Track your audiobook releases, manage your wishlist, and discover new titles.</p>
          </div>
        </div>
      </section>

      <!-- Stats Overview -->
      <section class="row row-deck row-cards mb-4">
        <div class="col-6 col-md-3 mb-3">
          <div class="card">
            <div class="card-body p-3 text-center">
              <div class="text-h1 m-0 text-primary">{{ stats.totalBooks }}</div>
              <div class="text-muted">Total Books</div>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-3 mb-3">
          <div class="card">
            <div class="card-body p-3 text-center">
              <div class="text-h1 m-0 text-success">{{ stats.wishlistCount }}</div>
              <div class="text-muted">Wishlist Items</div>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-3 mb-3">
          <div class="card">
            <div class="card-body p-3 text-center">
              <div class="text-h1 m-0 text-warning">{{ stats.upcomingReleases }}</div>
              <div class="text-muted">Upcoming</div>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-3 mb-3">
          <div class="card">
            <div class="card-body p-3 text-center">
              <div class="text-h1 m-0 text-info">{{ stats.newThisWeek }}</div>
              <div class="text-muted">New This Week</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="row mb-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Quick Actions</h3>
            </div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <router-link to="/upcoming" class="btn btn-primary w-100">
                    <i class="fas fa-clock me-2"></i>
                    View Upcoming Releases
                  </router-link>
                </div>
                <div class="col-md-6">
                  <router-link to="/search" class="btn btn-outline-primary w-100">
                    <i class="fas fa-search me-2"></i>
                    Search for Books
                  </router-link>
                </div>
                <div class="col-md-6">
                  <router-link to="/wishlist" class="btn btn-outline-secondary w-100">
                    <i class="fas fa-heart me-2"></i>
                    Manage Wishlist
                  </router-link>
                </div>
                <div class="col-md-6">
                  <router-link to="/authors" class="btn btn-outline-secondary w-100">
                    <i class="fas fa-users me-2"></i>
                    Manage Authors
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="row">
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Recent Releases</h3>
            </div>
            <div class="card-body">
              <div v-if="recentReleases.length === 0" class="text-center py-4">
                <i class="fas fa-book fa-2x text-muted mb-3"></i>
                <p class="text-muted">No recent releases found</p>
              </div>
              <div v-else>
                <div v-for="book in recentReleases.slice(0, 5)" :key="book.id" class="d-flex align-items-center mb-3">
                  <div class="flex-shrink-0 me-3">
                    <img :src="book.cover_url || getImageSrc(book)" 
                         :alt="book.title" 
                         class="avatar avatar-md rounded"
                         @error="handleImageError">
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-bold">{{ book.title }}</div>
                    <div class="text-muted">{{ book.author }}</div>
                    <div class="text-muted small">{{ formatDate(book.release_date) }}</div>
                  </div>
                  <div class="ms-auto">
                    <a v-if="book.audible_url" 
                       :href="book.audible_url" 
                       target="_blank"
                       rel="noopener noreferrer"
                       class="btn btn-sm btn-outline-primary">
                      <i class="fas fa-external-link-alt"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">System Status</h3>
            </div>
            <div class="card-body">
              <div class="d-flex align-items-center mb-3">
                <div class="flex-shrink-0 me-3">
                  <div class="avatar avatar-sm" 
                       :class="systemStatus.database ? 'bg-success' : 'bg-danger'">
                    <i class="fas fa-database"></i>
                  </div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">Database</div>
                  <div class="text-muted small">{{ systemStatus.database ? 'Connected' : 'Disconnected' }}</div>
                </div>
              </div>
              
              <div class="d-flex align-items-center mb-3">
                <div class="flex-shrink-0 me-3">
                  <div class="avatar avatar-sm" 
                       :class="systemStatus.api ? 'bg-success' : 'bg-danger'">
                    <i class="fas fa-plug"></i>
                  </div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">API Status</div>
                  <div class="text-muted small">{{ systemStatus.api ? 'Online' : 'Offline' }}</div>
                </div>
              </div>
              
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0 me-3">
                  <div class="avatar avatar-sm bg-info">
                    <i class="fas fa-clock"></i>
                  </div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">Last Update</div>
                  <div class="text-muted small">{{ lastUpdate }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div> <!-- End v-cloak -->
  </div> <!-- End vue-app -->
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      stats: {
        totalBooks: 0,
        wishlistCount: 0,
        upcomingReleases: 0,
        newThisWeek: 0
      },
      recentReleases: [],
      systemStatus: {
        database: true,
        api: true
      },
      lastUpdate: 'Never'
    }
  },
  async mounted() {
    await this.loadStats()
    await this.loadRecentReleases()
    await this.checkSystemStatus()
  },
  methods: {
    async loadStats() {
      try {
        const response = await fetch('/api/stats')
        if (response.ok) {
          this.stats = await response.json()
        }
      } catch (error) {
        console.error('Error loading stats:', error)
        this.systemStatus.api = false
        // Fallback data for development
        this.stats = {
          totalBooks: 150,
          wishlistCount: 25,
          upcomingReleases: 8,
          newThisWeek: 3
        }
      }
    },
    async loadRecentReleases() {
      try {
        const response = await fetch('/api/recent-releases?limit=5')
        if (response.ok) {
          this.recentReleases = await response.json()
        }
      } catch (error) {
        console.error('Error loading recent releases:', error)
        // Fallback data for development
        this.recentReleases = [
          {
            id: 1,
            title: "The Name of the Wind",
            author: "Patrick Rothfuss",
            release_date: "2024-07-01",
            cover_url: "/static/images/placeholder-book.jpg"
          }
        ]
      }
    },
    async checkSystemStatus() {
      try {
        const response = await fetch('/api/health')
        if (response.ok) {
          const status = await response.json()
          this.systemStatus = {
            database: status.database || true,
            api: true
          }
          this.lastUpdate = new Date().toLocaleString()
        }
      } catch (error) {
        console.error('Error checking system status:', error)
        this.systemStatus.api = false
      }
    },
    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },
    getImageSrc(book) {
      if (book.cover_url) return book.cover_url
      if (book.cover_image) return book.cover_image
      return '/static/images/default-cover.jpg'
    },
    handleImageError(event) {
      event.target.src = '/static/images/default-cover.jpg'
      event.target.onerror = null
    }
  }
}
</script>

<style scoped>
/* Bootstrap/Tabler customizations for dark mode and enhanced styling */
[data-bs-theme="dark"] .card {
  background-color: var(--tblr-bg-surface);
  border-color: var(--tblr-border-color);
}

[data-bs-theme="dark"] .text-muted {
  color: var(--tblr-text-muted-dark) !important;
}

[data-bs-theme="dark"] .card-title {
  color: var(--tblr-body-color);
}

/* Enhanced card hover effects */
.card:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease-in-out;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Stat cards special styling */
.text-h1 {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
}

/* Avatar enhancements */
.avatar img {
  object-fit: cover;
}

/* Button group styling */
.btn-group-actions .btn {
  margin: 0.25rem;
}

/* Status indicators */
.avatar.bg-success {
  background-color: var(--tblr-success) !important;
}

.avatar.bg-danger {
  background-color: var(--tblr-danger) !important;
}

.avatar.bg-info {
  background-color: var(--tblr-info) !important;
}

/* Dark mode avatar text */
[data-bs-theme="dark"] .avatar {
  color: var(--tblr-body-bg);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .text-h1 {
    font-size: 1.5rem;
  }
  
  .card-body.p-4 {
    padding: 1rem !important;
  }
  
  .card-body.p-3 {
    padding: 0.75rem !important;
  }
}
</style>
