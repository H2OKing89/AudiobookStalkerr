<template>
  <div>
    <!-- Welcome Section -->
    <section class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-body p-4">
            <h1 class="card-title h2 mb-2">Welcome to AudioBook Tracker</h1>
            <p class="text-muted">Track your audiobook releases, manage your wishlist, and discover new titles.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Overview -->
    <section class="row mb-4">
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
            <div class="text-h1 m-0 text-info">{{ stats.totalAuthors }}</div>
            <div class="text-muted">Authors</div>
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
                <router-link to="/authors" class="btn btn-outline-primary w-100">
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
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity</h3>
          </div>
          <div class="card-body">
            <div v-if="recentActivity.length === 0" class="text-center py-4">
              <i class="fas fa-history fa-2x text-muted mb-3"></i>
              <p class="text-muted">No recent activity</p>
            </div>
            <div v-else>
              <div v-for="activity in recentActivity.slice(0, 5)" :key="activity.id" class="d-flex align-items-center mb-3">
                <div class="flex-shrink-0 me-3">
                  <div class="avatar avatar-sm" 
                       :class="getActivityColor(activity.type)">
                    <i :class="getActivityIcon(activity.type)"></i>
                  </div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">{{ activity.description }}</div>
                  <div class="text-muted small">{{ formatDate(activity.timestamp) }}</div>
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
import { ref, onMounted } from 'vue'

const stats = ref({
  totalBooks: 0,
  wishlistCount: 0,
  upcomingReleases: 0,
  totalAuthors: 0
})

const recentActivity = ref([])

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const getActivityColor = (type) => {
  switch (type) {
    case 'added':
      return 'bg-blue'
    case 'released':
      return 'bg-green'
    case 'updated':
      return 'bg-yellow'
    default:
      return 'bg-secondary'
  }
}

const getActivityIcon = (type) => {
  switch (type) {
    case 'added':
      return 'fas fa-plus'
    case 'released':
      return 'fas fa-calendar-check'
    case 'updated':
      return 'fas fa-edit'
    default:
      return 'fas fa-info'
  }
}

const loadStats = async () => {
  try {
    const response = await fetch('/api/database/stats')
    if (response.ok) {
      const data = await response.json()
      stats.value = {
        totalBooks: data.total_books || 0,
        wishlistCount: data.wishlist_count || 0,
        upcomingReleases: data.upcoming_releases || 0,
        totalAuthors: data.total_authors || 0
      }
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const loadRecentActivity = async () => {
  try {
    const response = await fetch('/api/recent-activity')
    if (response.ok) {
      const data = await response.json()
      recentActivity.value = data || []
    }
  } catch (error) {
    console.error('Error loading recent activity:', error)
    // Mock data for development
    recentActivity.value = [
      {
        id: 1,
        type: 'added',
        description: 'Added new author: Brandon Sanderson',
        timestamp: '2025-07-11T12:00:00Z'
      },
      {
        id: 2,
        type: 'released',
        description: 'New release: The Way of Kings',
        timestamp: '2025-07-10T15:30:00Z'
      },
      {
        id: 3,
        type: 'updated',
        description: 'Updated book details for Mistborn',
        timestamp: '2025-07-09T09:15:00Z'
      }
    ]
  }
}

onMounted(async () => {
  await loadStats()
  await loadRecentActivity()
})
</script>

<style scoped>
.text-h1 {
  font-size: 2rem;
  font-weight: 600;
}
</style>
