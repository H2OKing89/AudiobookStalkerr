<template>
  <div id="app">
    <!-- Skip to main content link for accessibility - exact match to legacy -->
    <a href="#main-content" class="skip-to-content">Skip to main content</a>
    
    <!-- Header Navigation - exact match to legacy -->
    <header class="navbar navbar-expand-md navbar-light d-print-none" role="banner">
      <div class="container-xl">
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu" 
                aria-controls="navbar-menu" aria-expanded="false" aria-label="Toggle navigation menu">
          <span class="navbar-toggler-icon"></span>
        </button>
        <h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <router-link to="/" class="text-decoration-none" aria-label="Audiobook Stalkerr - Go to home page">
            <i class="fas fa-headphones text-primary me-2" aria-hidden="true"></i>
            Audiobook Stalkerr
          </router-link>
        </h1>
        <div class="navbar-nav flex-row order-md-last">
          <!-- Refresh Button - exact match to legacy -->
          <button type="button" class="nav-link px-0 hide-theme-dark btn btn-link" 
                  @click="refreshData"
                  :disabled="isLoading"
                  aria-label="Refresh upcoming audiobooks data">
            <i class="fas fa-sync-alt me-1" :class="{ 'fa-spin': isLoading }" aria-hidden="true"></i>
            <span class="d-none d-md-inline">{{ isLoading ? 'Refreshing...' : 'Refresh' }}</span>
          </button>
        </div>
        <nav class="collapse navbar-collapse" id="navbar-menu" aria-label="Main navigation">
          <div class="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
            <ul class="navbar-nav" role="menubar">
              <li class="nav-item" role="none">
                <router-link 
                  to="/" 
                  class="nav-link" 
                  role="menuitem"
                  :class="{ 'active': $route.name === 'Home' }"
                  :aria-current="$route.name === 'Home' ? 'page' : null"
                >
                  <span class="nav-link-icon d-md-none d-lg-inline-block" aria-hidden="true">
                    <i class="fas fa-calendar-alt"></i>
                  </span>
                  <span class="nav-link-title">Upcoming Releases</span>
                </router-link>
              </li>
              <li class="nav-item" role="none">
                <router-link 
                  to="/analytics" 
                  class="nav-link" 
                  role="menuitem"
                  :class="{ 'active': $route.name === 'Analytics' }"
                  :aria-current="$route.name === 'Analytics' ? 'page' : null"
                >
                  <span class="nav-link-icon d-md-none d-lg-inline-block" aria-hidden="true">
                    <i class="fas fa-chart-line"></i>
                  </span>
                  <span class="nav-link-title">Analytics</span>
                </router-link>
              </li>
              <li class="nav-item" role="none">
                <router-link 
                  to="/authors" 
                  class="nav-link" 
                  role="menuitem"
                  :class="{ 'active': $route.name === 'Authors' }"
                  :aria-current="$route.name === 'Authors' ? 'page' : null"
                >
                  <span class="nav-link-icon d-md-none d-lg-inline-block" aria-hidden="true">
                    <i class="fas fa-users"></i>
                  </span>
                  <span class="nav-link-title">Authors</span>
                </router-link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </header>

    <!-- Main Content - exact match to legacy page-wrapper structure -->
    <div class="page-wrapper">
      <!-- Page Header -->
      <div class="page-header d-print-none">
        <div class="container-xl">
          <div class="row g-2 align-items-center">
            <div class="col">
              <div class="page-pretitle">
                {{ getPagePretitle() }}
              </div>
              <h2 class="page-title" id="main-content">
                <i :class="getPageIcon()" class="text-primary me-3" aria-hidden="true"></i>
                {{ getPageTitle() }}
              </h2>
              <div class="text-muted mt-1">
                {{ getPageDescription() }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Page Body -->
      <div class="page-body">
        <div class="container-xl" v-cloak>
          <router-view />
        </div>
      </div>
    </div>

    <!-- Loading Overlay - exact match to legacy -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="text-center">
        <div class="spinner-border text-primary mb-3" role="status" aria-label="Loading">
          <span class="sr-only">Loading...</span>
        </div>
        <p class="text-muted">Loading...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAudiobooksStore } from '@/stores/audiobooks'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const audiobooksStore = useAudiobooksStore()
const isLoading = ref(false)

// Initialize theme on app mount
const { initializeTheme } = useTheme()

onMounted(() => {
  initializeTheme()
})

const getPagePretitle = () => {
  switch (route.name) {
    case 'Home':
      return 'Release Calendar'
    case 'Analytics':
      return 'Data Insights'
    case 'Authors':
      return 'Watchlist Management'
    default:
      return 'Audiobook Stalkerr'
  }
}

const getPageTitle = () => {
  switch (route.name) {
    case 'Home':
      return 'Upcoming Audiobook Releases'
    case 'Analytics':
      return 'Analytics Dashboard'
    case 'Authors':
      return 'Authors Management'
    default:
      return 'Audiobook Stalkerr'
  }
}

const getPageDescription = () => {
  switch (route.name) {
    case 'Home':
      return 'Upcoming audiobooks found from your watchlist searches'
    case 'Analytics':
      return 'Insights about your audiobook collection and listening habits'
    case 'Authors':
      return 'Manage your audiobook authors and track upcoming releases'
    default:
      return 'Track your favorite audiobook releases'
  }
}

const getPageIcon = () => {
  switch (route.name) {
    case 'Home':
      return 'fas fa-calendar-alt'
    case 'Analytics':
      return 'fas fa-chart-line'
    case 'Authors':
      return 'fas fa-users'
    default:
      return 'fas fa-headphones'
  }
}

const refreshData = async () => {
  isLoading.value = true
  try {
    // Refresh data based on current route
    switch (route.name) {
      case 'Home':
        // Refresh upcoming releases
        break
      case 'Analytics':
        await audiobooksStore.fetchAnalytics()
        break
      case 'Authors':
        await audiobooksStore.fetchBooks()
        break
    }
  } catch (error) {
    console.error('Error refreshing data:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Component-specific styles - exact match to legacy */
.navbar-brand a {
  color: inherit;
}

.nav-link.active {
  background-color: rgba(var(--tblr-primary-rgb), 0.1);
  color: var(--tblr-primary);
}

.page-wrapper {
  flex: 1;
}

/* Vue specific styles - exact match to legacy upcoming.html */
[v-cloak] { 
  display: none !important; 
}

/* Vue transition classes - exact match to legacy */
.v-enter-active,
.v-leave-active {
  transition: opacity 300ms ease-in-out, transform 300ms ease-in-out;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.v-enter-to,
.v-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* Loading states for Vue - exact match to legacy */
[v-show] {
  transition: opacity 300ms ease-in-out, transform 300ms ease-in-out;
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

/* Loading overlay positioning - exact match to legacy */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* Dark mode loading overlay */
@media (prefers-color-scheme: dark) {
  .loading-overlay {
    background: rgba(15, 15, 15, 0.9);
  }
}
</style>
