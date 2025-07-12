<template>
  <div class="space-y-6">
    <!-- Welcome Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome to AudioBook Tracker</h1>
      <p class="text-gray-600">Track your audiobook releases, manage your wishlist, and discover new titles.</p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-lg">📚</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ stats.totalBooks }}</p>
            <p class="text-gray-600">Total Books</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-lg">⭐</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ stats.wishlistCount }}</p>
            <p class="text-gray-600">Wishlist Items</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
              <span class="text-white text-lg">🔔</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ stats.upcomingReleases }}</p>
            <p class="text-gray-600">Upcoming</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
              <span class="text-white text-lg">📈</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ stats.newThisWeek }}</p>
            <p class="text-gray-600">New This Week</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow">
        <div class="p-6 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Recent Releases</h2>
        </div>
        <div class="p-6">
          <div v-if="recentReleases.length === 0" class="text-gray-500 text-center py-4">
            No recent releases found
          </div>
          <div v-else class="space-y-4">
            <div v-for="book in recentReleases" :key="book.id" class="flex items-center space-x-4">
              <img :src="book.cover_url" :alt="book.title" class="w-12 h-12 rounded object-cover" />
              <div class="flex-1">
                <h3 class="text-sm font-medium text-gray-900">{{ book.title }}</h3>
                <p class="text-sm text-gray-500">{{ book.author }}</p>
                <p class="text-xs text-gray-400">{{ formatDate(book.release_date) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow">
        <div class="p-6 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div class="p-6 space-y-4">
          <router-link to="/search" class="btn-primary w-full text-center block">
            🔍 Search for Books
          </router-link>
          <router-link to="/wishlist" class="btn-secondary w-full text-center block">
            ⭐ View Wishlist
          </router-link>
          <router-link to="/analytics" class="btn-secondary w-full text-center block">
            📊 View Analytics
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAudiobooksStore } from '@/stores/audiobooks'

const audiobooksStore = useAudiobooksStore()

const stats = ref({
  totalBooks: 0,
  wishlistCount: 0,
  upcomingReleases: 0,
  newThisWeek: 0
})

const recentReleases = ref([])

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

onMounted(async () => {
  // Load initial data
  await loadDashboardData()
})

const loadDashboardData = async () => {
  try {
    // This will be connected to your backend API
    const response = await fetch('/api/dashboard')
    if (response.ok) {
      const data = await response.json()
      stats.value = data.stats
      recentReleases.value = data.recent_releases || []
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error)
    // Fallback to mock data for development
    stats.value = {
      totalBooks: 150,
      wishlistCount: 25,
      upcomingReleases: 8,
      newThisWeek: 3
    }
    recentReleases.value = [
      {
        id: 1,
        title: "The Name of the Wind",
        author: "Patrick Rothfuss",
        release_date: "2024-07-01",
        cover_url: "/static/images/placeholder-book.jpg"
      }
    ]
  }
}
</script>
