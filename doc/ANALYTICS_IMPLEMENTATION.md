# 📊 Analytics Dashboard Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing an analytics dashboard in the Audiobook Stalkerr application using Chart.js and modern frontend practices.

## Quick Setup

### 1. Install Dependencies

```bash
# Navigate to your static directory
cd src/audiostracker/web/static

# Install Chart.js and utilities
npm install chart.js chartjs-adapter-date-fns date-fns
npm install -D tailwindcss@latest autoprefixer postcss
```

### 2. Backend Analytics Endpoint

Add this to your `app.py`:

```python
from datetime import datetime, timedelta
from collections import defaultdict
import json

@app.route('/api/analytics/overview')
def analytics_overview():
    """Get overview analytics data"""
    db = get_db()
    
    # Get books added in last 30 days
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    # Daily new books count
    daily_counts = db.execute('''
        SELECT DATE(date_added) as date, COUNT(*) as count
        FROM audiobooks 
        WHERE date_added >= ?
        GROUP BY DATE(date_added)
        ORDER BY date
    ''', (thirty_days_ago,)).fetchall()
    
    # Release date distribution
    upcoming_releases = db.execute('''
        SELECT DATE(release_date) as date, COUNT(*) as count
        FROM audiobooks 
        WHERE release_date >= DATE('now')
        AND release_date <= DATE('now', '+60 days')
        GROUP BY DATE(release_date)
        ORDER BY date
    ''').fetchall()
    
    # Author distribution (top 10)
    author_stats = db.execute('''
        SELECT author, COUNT(*) as count
        FROM audiobooks 
        GROUP BY author
        ORDER BY count DESC
        LIMIT 10
    ''').fetchall()
    
    # Series distribution
    series_stats = db.execute('''
        SELECT series, COUNT(*) as count
        FROM audiobooks 
        WHERE series IS NOT NULL AND series != ''
        GROUP BY series
        ORDER BY count DESC
        LIMIT 10
    ''').fetchall()
    
    return jsonify({
        'daily_additions': [{'date': row['date'], 'count': row['count']} for row in daily_counts],
        'upcoming_releases': [{'date': row['date'], 'count': row['count']} for row in upcoming_releases],
        'top_authors': [{'author': row['author'], 'count': row['count']} for row in author_stats],
        'top_series': [{'series': row['series'], 'count': row['count']} for row in series_stats],
        'total_books': db.execute('SELECT COUNT(*) as count FROM audiobooks').fetchone()['count'],
        'upcoming_count': db.execute('SELECT COUNT(*) as count FROM audiobooks WHERE release_date >= DATE("now")').fetchone()['count']
    })

@app.route('/api/analytics/trends')
def analytics_trends():
    """Get trend data for charts"""
    db = get_db()
    
    # Monthly trends for the last 12 months
    monthly_data = db.execute('''
        SELECT 
            strftime('%Y-%m', date_added) as month,
            COUNT(*) as count
        FROM audiobooks 
        WHERE date_added >= DATE('now', '-12 months')
        GROUP BY strftime('%Y-%m', date_added)
        ORDER BY month
    ''').fetchall()
    
    # Genre distribution
    genre_data = db.execute('''
        SELECT 
            CASE 
                WHEN genre IS NULL OR genre = '' THEN 'Unknown'
                ELSE genre
            END as genre,
            COUNT(*) as count
        FROM audiobooks
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 8
    ''').fetchall()
    
    return jsonify({
        'monthly_trends': [{'month': row['month'], 'count': row['count']} for row in monthly_data],
        'genre_distribution': [{'genre': row['genre'], 'count': row['count']} for row in genre_data]
    })
```

### 3. Frontend Analytics Dashboard

Create `src/audiostracker/web/static/js/analytics-dashboard.js`:

```javascript
import {
    Chart,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
);

class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.data = {};
        this.init();
    }

    async init() {
        await this.loadData();
        this.createCharts();
        this.updateStats();
    }

    async loadData() {
        try {
            const [overviewResponse, trendsResponse] = await Promise.all([
                fetch('/api/analytics/overview'),
                fetch('/api/analytics/trends')
            ]);

            this.data.overview = await overviewResponse.json();
            this.data.trends = await trendsResponse.json();
        } catch (error) {
            console.error('Failed to load analytics data:', error);
        }
    }

    createCharts() {
        this.createDailyAdditionsChart();
        this.createUpcomingReleasesChart();
        this.createMonthlyTrendsChart();
        this.createGenreDistributionChart();
        this.createAuthorChart();
    }

    createDailyAdditionsChart() {
        const ctx = document.getElementById('dailyAdditionsChart');
        if (!ctx) return;

        const data = this.data.overview.daily_additions || [];
        
        this.charts.dailyAdditions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.date),
                datasets: [{
                    label: 'Books Added',
                    data: data.map(item => item.count),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily Book Additions (Last 30 Days)'
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
        });
    }

    createUpcomingReleasesChart() {
        const ctx = document.getElementById('upcomingReleasesChart');
        if (!ctx) return;

        const data = this.data.overview.upcoming_releases || [];
        
        this.charts.upcomingReleases = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.date),
                datasets: [{
                    label: 'Upcoming Releases',
                    data: data.map(item => item.count),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Upcoming Releases (Next 60 Days)'
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
        });
    }

    createMonthlyTrendsChart() {
        const ctx = document.getElementById('monthlyTrendsChart');
        if (!ctx) return;

        const data = this.data.trends.monthly_trends || [];
        
        this.charts.monthlyTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.month),
                datasets: [{
                    label: 'Books Added',
                    data: data.map(item => item.count),
                    borderColor: 'rgb(168, 85, 247)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Trends (Last 12 Months)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createGenreDistributionChart() {
        const ctx = document.getElementById('genreDistributionChart');
        if (!ctx) return;

        const data = this.data.trends.genre_distribution || [];
        const colors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e',
            '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
        ];
        
        this.charts.genreDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.genre),
                datasets: [{
                    data: data.map(item => item.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Genre Distribution'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createAuthorChart() {
        const ctx = document.getElementById('authorChart');
        if (!ctx) return;

        const data = this.data.overview.top_authors || [];
        
        this.charts.authors = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.author),
                datasets: [{
                    label: 'Books',
                    data: data.map(item => item.count),
                    backgroundColor: 'rgba(249, 115, 22, 0.8)',
                    borderColor: 'rgb(249, 115, 22)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Authors by Book Count'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateStats() {
        const overview = this.data.overview;
        
        // Update stat cards
        this.updateStatCard('totalBooks', overview.total_books || 0);
        this.updateStatCard('upcomingBooks', overview.upcoming_count || 0);
        this.updateStatCard('totalAuthors', overview.top_authors?.length || 0);
        this.updateStatCard('totalSeries', overview.top_series?.length || 0);
    }

    updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value.toLocaleString();
        }
    }

    // Refresh all charts and data
    async refresh() {
        await this.loadData();
        
        // Update existing charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};
        
        this.createCharts();
        this.updateStats();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsDashboard = new AnalyticsDashboard();
});

// Export for potential external use
export { AnalyticsDashboard };
```

### 4. Analytics Dashboard HTML Template

Create `src/audiostracker/web/templates/analytics.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics - Audiobook Stalkerr</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/upcoming.css') }}">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="min-h-screen">
        <!-- Header -->
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                            📊 Analytics Dashboard
                        </h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="{{ url_for('upcoming') }}" 
                           class="text-blue-600 hover:text-blue-500 dark:text-blue-400">
                            ← Back to Books
                        </a>
                        <button id="refreshBtn" 
                                class="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                            Refresh Data
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Stats Overview -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="flex items-center">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Books</p>
                            <p class="text-2xl font-semibold text-gray-900 dark:text-white" id="totalBooks">-</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="flex items-center">
                        <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Releases</p>
                            <p class="text-2xl font-semibold text-gray-900 dark:text-white" id="upcomingBooks">-</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="flex items-center">
                        <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Authors</p>
                            <p class="text-2xl font-semibold text-gray-900 dark:text-white" id="totalAuthors">-</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="flex items-center">
                        <div class="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <svg class="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Series</p>
                            <p class="text-2xl font-semibold text-gray-900 dark:text-white" id="totalSeries">-</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Daily Additions Chart -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="h-64">
                        <canvas id="dailyAdditionsChart"></canvas>
                    </div>
                </div>

                <!-- Upcoming Releases Chart -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="h-64">
                        <canvas id="upcomingReleasesChart"></canvas>
                    </div>
                </div>

                <!-- Monthly Trends Chart -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="h-64">
                        <canvas id="monthlyTrendsChart"></canvas>
                    </div>
                </div>

                <!-- Genre Distribution Chart -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="h-64">
                        <canvas id="genreDistributionChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Top Authors Chart -->
            <div class="mt-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <div class="h-80">
                        <canvas id="authorChart"></canvas>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Scripts -->
    <script type="module" src="{{ url_for('static', filename='js/analytics-dashboard.js') }}"></script>
    <script>
        // Add refresh button functionality
        document.getElementById('refreshBtn').addEventListener('click', () => {
            if (window.analyticsDashboard) {
                window.analyticsDashboard.refresh();
            }
        });
    </script>
</body>
</html>
```

### 5. Add Analytics Route

Add this route to your `app.py`:

```python
@app.route('/analytics')
def analytics():
    """Analytics dashboard page"""
    return render_template('analytics.html')
```

### 6. Add Navigation Link

Update your navigation in the main templates to include an analytics link:

```html
<a href="{{ url_for('analytics') }}" 
   class="text-blue-600 hover:text-blue-500 dark:text-blue-400">
    📊 Analytics
</a>
```

## Testing the Implementation

1. **Start your server**: `python start_webui.py`
2. **Navigate to analytics**: `http://localhost:8000/analytics`
3. **Verify charts load**: Check browser console for any errors
4. **Test refresh functionality**: Click the refresh button

## Customization Options

### Adding More Charts

- **Author timeline**: Books per author over time
- **Series completion**: Track which series are complete
- **Price trends**: Average audiobook prices over time
- **Release prediction**: ML model to predict release dates

### Enhanced Features

- **Export functionality**: Download charts as images
- **Date range selectors**: Filter data by custom date ranges
- **Real-time updates**: WebSocket integration for live data
- **Comparative analysis**: Compare current vs. previous periods

This implementation provides a solid foundation for analytics while being easily extensible for additional features and customizations.
