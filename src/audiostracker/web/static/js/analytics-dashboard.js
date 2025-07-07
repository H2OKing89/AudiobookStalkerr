// Analytics Dashboard Module
class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.initDashboard();
    }

    async initDashboard() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        await this.createReleaseTrendChart();
        await this.createTopAuthorsChart();
        await this.createUpcomingCountChart();
    }

    async createReleaseTrendChart() {
        const ctx = document.getElementById('release-trend-chart');
        if (!ctx) return;

        try {
            const response = await fetch('/api/analytics/release-trends');
            const data = await response.json();

            this.charts.releaseTrend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels || [],
                    datasets: [{
                        label: 'Upcoming Releases',
                        data: data.values || [],
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Release Trends'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load release trend data:', error);
        }
    }

    async createTopAuthorsChart() {
        const ctx = document.getElementById('top-authors-chart');
        if (!ctx) return;

        try {
            const response = await fetch('/api/analytics/top-authors');
            const data = await response.json();

            this.charts.topAuthors = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.labels || [],
                    datasets: [{
                        data: data.values || [],
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF',
                            '#FF9F40'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Top Authors'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load top authors data:', error);
        }
    }

    async createUpcomingCountChart() {
        const ctx = document.getElementById('upcoming-count-chart');
        if (!ctx) return;

        try {
            const response = await fetch('/api/analytics/upcoming-count');
            const data = await response.json();

            this.charts.upcomingCount = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels || [],
                    datasets: [{
                        label: 'Books',
                        data: data.values || [],
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Upcoming Releases by Month'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load upcoming count data:', error);
        }
    }

    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsDashboard = new AnalyticsDashboard();
});
