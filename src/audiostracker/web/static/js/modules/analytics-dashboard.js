/* Analytics Dashboard Enhancements */

/* 
  Add these powerful visualization libraries to your project:
  
  1. Chart.js - Easy, beautiful charts
  2. ApexCharts - Modern charting library  
  3. D3.js - Advanced data visualization
  4. Plotly.js - Interactive scientific charts
*/

// Example: Release Timeline Chart
class AnalyticsDashboard {
    constructor() {
        this.charts = {};
    }
    
    // Release timeline by month
    createReleaseTimeline(books) {
        const monthData = this.groupBooksByMonth(books);
        
        const ctx = document.getElementById('releaseTimelineChart');
        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthData.labels,
                datasets: [{
                    label: 'Upcoming Releases',
                    data: monthData.counts,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // Author distribution pie chart
    createAuthorDistribution(books) {
        const authorCounts = books.reduce((acc, book) => {
            acc[book.author] = (acc[book.author] || 0) + 1;
            return acc;
        }, {});
        
        const top10Authors = Object.entries(authorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
            
        const ctx = document.getElementById('authorDistributionChart');
        this.charts.authors = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: top10Authors.map(([author]) => author),
                datasets: [{
                    data: top10Authors.map(([, count]) => count),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
                        '#4BC0C0', '#FF6384'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    groupBooksByMonth(books) {
        // Group books by release month
        const months = {};
        books.forEach(book => {
            const date = new Date(book.release_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months[monthKey] = (months[monthKey] || 0) + 1;
        });
        
        return {
            labels: Object.keys(months).sort(),
            counts: Object.keys(months).sort().map(key => months[key])
        };
    }
}

// Usage in your upcoming module:
// const analytics = new AnalyticsDashboard();
// analytics.createReleaseTimeline(this.audiobooks);
// analytics.createAuthorDistribution(this.audiobooks);
