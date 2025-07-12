<template>
  <div>
    <!-- Dashboard Stats -->
    <section class="row mb-4">
      <div class="col-12">
        <div class="row g-3">
          <div class="col-6 col-lg-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-primary">{{ analytics.totalAuthors }}</div>
                <div class="text-muted">Authors</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-success">{{ analytics.totalBooks }}</div>
                <div class="text-muted">Total Books</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-warning">{{ analytics.upcomingBooks }}</div>
                <div class="text-muted">Upcoming</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-info">{{ analytics.thisMonthReleases }}</div>
                <div class="text-muted">This Month</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Charts Section -->
    <section class="row mb-4">
      <!-- Release Timeline Chart -->
      <div class="col-lg-8 mb-4">
        <div class="card theme-card h-100">
          <div class="card-header">
            <h3 class="card-title">Release Timeline</h3>
            <div class="card-actions">
              <div class="btn-group" role="group">
                <input type="radio" 
                       class="btn-check" 
                       name="timeline-period" 
                       id="timeline-6m" 
                       value="6m" 
                       v-model="timelinePeriod"
                       @change="loadTimelineData">
                <label class="btn btn-sm btn-outline-primary" for="timeline-6m">6M</label>

                <input type="radio" 
                       class="btn-check" 
                       name="timeline-period" 
                       id="timeline-1y" 
                       value="1y" 
                       v-model="timelinePeriod"
                       @change="loadTimelineData">
                <label class="btn btn-sm btn-outline-primary" for="timeline-1y">1Y</label>

                <input type="radio" 
                       class="btn-check" 
                       name="timeline-period" 
                       id="timeline-all" 
                       value="all" 
                       v-model="timelinePeriod"
                       @change="loadTimelineData"
                       checked>
                <label class="btn btn-sm btn-outline-primary" for="timeline-all">All</label>
              </div>
            </div>
          </div>
          <div class="card-body">
            <canvas ref="timelineChart" style="max-height: 300px;"></canvas>
          </div>
        </div>
      </div>

      <!-- Publisher Distribution -->
      <div class="col-lg-4 mb-4">
        <div class="card theme-card h-100">
          <div class="card-header">
            <h3 class="card-title">Publishers</h3>
          </div>
          <div class="card-body">
            <canvas ref="publisherChart" style="max-height: 300px;"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- Monthly Breakdown & Top Authors -->
    <section class="row mb-4">
      <!-- Monthly Breakdown -->
      <div class="col-lg-6 mb-4">
        <div class="card theme-card h-100">
          <div class="card-header">
            <h3 class="card-title">Monthly Breakdown</h3>
          </div>
          <div class="card-body">
            <canvas ref="monthlyChart" style="max-height: 250px;"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Authors -->
      <div class="col-lg-6 mb-4">
        <div class="card theme-card h-100">
          <div class="card-header">
            <h3 class="card-title">Most Active Authors</h3>
          </div>
          <div class="card-body">
            <div v-if="topAuthors.length === 0" class="text-center py-4">
              <i class="fas fa-chart-bar fa-2x text-muted mb-3"></i>
              <p class="text-muted">No author data available</p>
            </div>
            <div v-else>
              <div v-for="(author, index) in topAuthors" :key="author.name" class="d-flex align-items-center mb-3">
                <div class="flex-shrink-0 me-3">
                  <span class="badge badge-outline text-primary" 
                        :class="index === 0 ? 'text-warning' : index === 1 ? 'text-silver' : index === 2 ? 'text-bronze' : 'text-primary'">
                    #{{ index + 1 }}
                  </span>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">{{ author.name }}</div>
                  <div class="text-muted small">{{ author.bookCount }} books</div>
                  <div class="progress mt-1" style="height: 6px;">
                    <div class="progress-bar bg-primary" 
                         :style="{ width: (author.bookCount / topAuthors[0].bookCount * 100) + '%' }">
                    </div>
                  </div>
                </div>
                <div class="flex-shrink-0 ms-3">
                  <span class="badge bg-primary">{{ author.bookCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Data Export & Analysis Tools -->
    <section class="row">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title">Data Analysis Tools</h3>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="d-grid">
                  <button type="button" class="btn btn-outline-primary" @click="exportAnalytics">
                    <i class="fas fa-download me-2"></i>
                    Export Analytics Data
                  </button>
                </div>
              </div>
              <div class="col-md-6">
                <div class="d-grid">
                  <button type="button" class="btn btn-outline-info" @click="refreshAnalytics">
                    <i class="fas fa-sync-alt me-2"></i>
                    Refresh Analytics
                  </button>
                </div>
              </div>
            </div>
            
            <div class="row g-3 mt-3">
              <div class="col-12">
                <div class="alert alert-info mb-0">
                  <h4 class="alert-heading">Analytics Insights</h4>
                  <p class="mb-2">
                    <strong>Peak Release Period:</strong> {{ analytics.peakMonth || 'No data available' }}
                  </p>
                  <p class="mb-2">
                    <strong>Average Books per Author:</strong> {{ analytics.avgBooksPerAuthor || 0 }}
                  </p>
                  <p class="mb-0">
                    <strong>Most Common Publisher:</strong> {{ analytics.topPublisher || 'No data available' }}
                  </p>
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
import { ref, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'

const analytics = ref({
  totalAuthors: 0,
  totalBooks: 0,
  upcomingBooks: 0,
  thisMonthReleases: 0,
  peakMonth: '',
  avgBooksPerAuthor: 0,
  topPublisher: ''
})

const topAuthors = ref([])
const timelinePeriod = ref('all')

// Chart refs
const timelineChart = ref(null)
const publisherChart = ref(null)
const monthlyChart = ref(null)

// Chart instances
let timelineChartInstance = null
let publisherChartInstance = null
let monthlyChartInstance = null

const loadAnalytics = async () => {
  try {
    const response = await fetch('/api/analytics')
    if (response.ok) {
      const data = await response.json()
      
      // Update analytics data
      analytics.value = {
        totalAuthors: data.total_authors || 0,
        totalBooks: data.total_books || 0,
        upcomingBooks: data.upcoming_books || 0,
        thisMonthReleases: data.this_month_releases || 0,
        peakMonth: data.peak_month || 'No data',
        avgBooksPerAuthor: Math.round((data.total_books / data.total_authors) || 0),
        topPublisher: data.top_publisher || 'No data'
      }

      // Update top authors
      topAuthors.value = (data.top_authors || []).slice(0, 10)

      // Load chart data
      await loadTimelineData()
      await loadPublisherData()
      await loadMonthlyData()
    }
  } catch (error) {
    console.error('Error loading analytics:', error)
  }
}

const loadTimelineData = async () => {
  try {
    const response = await fetch(`/api/analytics/timeline?period=${timelinePeriod.value}`)
    if (response.ok) {
      const data = await response.json()
      updateTimelineChart(data)
    }
  } catch (error) {
    console.error('Error loading timeline data:', error)
  }
}

const loadPublisherData = async () => {
  try {
    const response = await fetch('/api/analytics/publishers')
    if (response.ok) {
      const data = await response.json()
      updatePublisherChart(data)
    }
  } catch (error) {
    console.error('Error loading publisher data:', error)
  }
}

const loadMonthlyData = async () => {
  try {
    const response = await fetch('/api/analytics/monthly')
    if (response.ok) {
      const data = await response.json()
      updateMonthlyChart(data)
    }
  } catch (error) {
    console.error('Error loading monthly data:', error)
  }
}

const updateTimelineChart = (data) => {
  if (timelineChartInstance) {
    timelineChartInstance.destroy()
  }

  const ctx = timelineChart.value.getContext('2d')
  timelineChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels || [],
      datasets: [{
        label: 'Releases',
        data: data.values || [],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        fill: false,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  })
}

const updatePublisherChart = (data) => {
  if (publisherChartInstance) {
    publisherChartInstance.destroy()
  }

  const ctx = publisherChart.value.getContext('2d')
  publisherChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels || [],
      datasets: [{
        data: data.values || [],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4',
          '#84cc16',
          '#f97316'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        }
      }
    }
  })
}

const updateMonthlyChart = (data) => {
  if (monthlyChartInstance) {
    monthlyChartInstance.destroy()
  }

  const ctx = monthlyChart.value.getContext('2d')
  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels || [],
      datasets: [{
        label: 'Releases',
        data: data.values || [],
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  })
}

const exportAnalytics = async () => {
  try {
    const response = await fetch('/api/analytics/export')
    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      throw new Error('Export failed')
    }
  } catch (error) {
    console.error('Error exporting analytics:', error)
    alert('Error exporting analytics. Please try again.')
  }
}

const refreshAnalytics = async () => {
  await loadAnalytics()
  // Show success feedback
  const button = event.target
  const originalText = button.innerHTML
  button.innerHTML = '<i class="fas fa-check me-2"></i>Refreshed!'
  button.classList.add('btn-success')
  button.classList.remove('btn-outline-info')
  
  setTimeout(() => {
    button.innerHTML = originalText
    button.classList.remove('btn-success')
    button.classList.add('btn-outline-info')
  }, 2000)
}

onMounted(async () => {
  await nextTick()
  await loadAnalytics()
})
</script>

<style scoped>
.text-h1 {
  font-size: 2rem;
  font-weight: 600;
}

.badge-outline {
  border: 1px solid currentColor;
  background: transparent;
}

.text-silver {
  color: #c0c0c0 !important;
}

.text-bronze {
  color: #cd7f32 !important;
}
</style>
