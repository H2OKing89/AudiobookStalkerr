# 📱 PWA (Progressive Web App) Implementation Guide

## Overview

Transform your Audiobook Stalkerr into a Progressive Web App for mobile-like experience with offline capabilities, push notifications, and app-like installation.

## Quick Implementation

### 1. Web App Manifest

Create `src/audiostracker/web/static/manifest.json`:

```json
{
  "name": "Audiobook Stalkerr",
  "short_name": "AudioStalkerr",
  "description": "Track upcoming audiobook releases",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "orientation": "portrait-primary",
  "categories": ["books", "entertainment", "productivity"],
  "icons": [
    {
      "src": "/static/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/static/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "shortcuts": [
    {
      "name": "View Upcoming",
      "short_name": "Upcoming",
      "description": "View upcoming audiobook releases",
      "url": "/upcoming",
      "icons": [{ "src": "/static/icons/shortcut-upcoming.png", "sizes": "96x96" }]
    },
    {
      "name": "Analytics",
      "short_name": "Analytics",
      "description": "View analytics dashboard",
      "url": "/analytics",
      "icons": [{ "src": "/static/icons/shortcut-analytics.png", "sizes": "96x96" }]
    }
  ]
}
```

### 2. Service Worker

Create `src/audiostracker/web/static/sw.js`:

```javascript
const CACHE_NAME = 'audiobook-stalkerr-v1';
const urlsToCache = [
  '/',
  '/upcoming',
  '/static/css/upcoming.css',
  '/static/js/modules/upcoming-clean.js',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/offline');
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Push notification handler
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New audiobook release available!',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/static/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/static/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Audiobook Stalkerr', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/upcoming')
    );
  }
});

async function doBackgroundSync() {
  // Sync offline actions when connection is restored
  try {
    // Get offline data from IndexedDB
    // Sync with server
    console.log('Background sync completed');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}
```

### 3. PWA JavaScript Module

Create `src/audiostracker/web/static/js/pwa.js`:

```javascript
class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.init();
    }

    async init() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful');
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    this.showUpdateAvailable();
                });
            } catch (error) {
                console.log('ServiceWorker registration failed: ', error);
            }
        }

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });

        // Handle app installed
        window.addEventListener('appinstalled', (evt) => {
            console.log('App was installed');
            this.isInstalled = true;
            this.hideInstallPrompt();
        });

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true) {
            this.isInstalled = true;
        }

        // Request notification permission
        this.requestNotificationPermission();
    }

    showInstallPrompt() {
        if (this.isInstalled) return;

        const installBanner = this.createInstallBanner();
        document.body.appendChild(installBanner);
    }

    createInstallBanner() {
        const banner = document.createElement('div');
        banner.id = 'install-banner';
        banner.className = `
            fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg
            transform transition-transform duration-300 translate-y-full z-50
        `.trim();
        
        banner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                    </svg>
                    <div>
                        <p class="font-medium">Install Audiobook Stalkerr</p>
                        <p class="text-sm opacity-90">Get quick access from your home screen</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button id="install-app" class="bg-white text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100">
                        Install
                    </button>
                    <button id="dismiss-install" class="text-white opacity-70 hover:opacity-100">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Show banner after a delay
        setTimeout(() => {
            banner.classList.remove('translate-y-full');
        }, 1000);

        // Add event listeners
        banner.querySelector('#install-app').addEventListener('click', () => {
            this.installApp();
        });

        banner.querySelector('#dismiss-install').addEventListener('click', () => {
            this.hideInstallPrompt();
        });

        return banner;
    }

    async installApp() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    hideInstallPrompt() {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.classList.add('translate-y-full');
            setTimeout(() => banner.remove(), 300);
        }
    }

    showUpdateAvailable() {
        const updateBanner = document.createElement('div');
        updateBanner.className = `
            fixed top-4 left-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg z-50
        `.trim();
        
        updateBanner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                    </svg>
                    <div>
                        <p class="font-medium">Update Available</p>
                        <p class="text-sm opacity-90">Reload to get the latest features</p>
                    </div>
                </div>
                <button id="reload-app" class="bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100">
                    Reload
                </button>
            </div>
        `;

        updateBanner.querySelector('#reload-app').addEventListener('click', () => {
            window.location.reload();
        });

        document.body.appendChild(updateBanner);

        // Auto-remove after 10 seconds
        setTimeout(() => updateBanner.remove(), 10000);
    }

    async requestNotificationPermission() {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('Notification permission granted');
                // Subscribe to push notifications
                this.subscribeToPush();
            }
        }
    }

    async subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY') // Replace with your VAPID key
            });

            // Send subscription to server
            await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscription)
            });

            console.log('Push subscription successful');
        } catch (error) {
            console.error('Push subscription failed:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Check network status
    updateNetworkStatus() {
        const updateOnlineStatus = () => {
            const condition = navigator.onLine ? 'online' : 'offline';
            document.body.className = document.body.className.replace(/\b(online|offline)\b/g, '');
            document.body.classList.add(condition);
            
            if (condition === 'offline') {
                this.showOfflineMessage();
            } else {
                this.hideOfflineMessage();
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
    }

    showOfflineMessage() {
        const offlineMessage = document.createElement('div');
        offlineMessage.id = 'offline-message';
        offlineMessage.className = `
            fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center z-50
            transform transition-transform duration-300
        `.trim();
        
        offlineMessage.innerHTML = `
            <div class="flex items-center justify-center">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                You are offline. Some features may not be available.
            </div>
        `;

        document.body.appendChild(offlineMessage);
    }

    hideOfflineMessage() {
        const offlineMessage = document.getElementById('offline-message');
        if (offlineMessage) {
            offlineMessage.remove();
        }
    }
}

// Initialize PWA when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

export { PWAManager };
```

### 4. Update HTML Templates

Add these meta tags and links to your HTML templates:

```html
<!-- In <head> section -->
<meta name="theme-color" content="#3b82f6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="AudioStalkerr">
<meta name="msapplication-TileImage" content="/static/icons/icon-144x144.png">
<meta name="msapplication-TileColor" content="#3b82f6">

<link rel="manifest" href="/static/manifest.json">
<link rel="apple-touch-icon" href="/static/icons/icon-152x152.png">

<!-- Before closing </body> -->
<script type="module" src="{{ url_for('static', filename='js/pwa.js') }}"></script>
```

### 5. Backend Support

Add these routes to your `app.py`:

```python
from flask import send_from_directory

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    response = send_from_directory('static', 'sw.js')
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/offline')
def offline():
    return render_template('offline.html')

@app.route('/api/push-subscribe', methods=['POST'])
def push_subscribe():
    """Handle push notification subscription"""
    subscription = request.get_json()
    
    # Store subscription in database
    # You can implement notification sending logic here
    
    return jsonify({'success': True})
```

### 6. Create Icons

You'll need to create app icons in various sizes. You can use online tools like:

- **PWA Builder**: <https://www.pwabuilder.com/imageGenerator>
- **Favicon Generator**: <https://favicon.io/>
- **App Icon Generator**: <https://appicon.co/>

Place icons in `src/audiostracker/web/static/icons/` directory.

### 7. Offline Page

Create `src/audiostracker/web/templates/offline.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - Audiobook Stalkerr</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="text-center">
        <svg class="mx-auto h-24 w-24 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 3v3m6 6h3m-6 6v3m-6-6H3"/>
        </svg>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">You're Offline</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
            Check your internet connection and try again.
        </p>
        <button onclick="window.location.reload()" 
                class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Try Again
        </button>
    </div>
</body>
</html>
```

## Testing Your PWA

1. **Install the app**: Open in Chrome and look for the install prompt
2. **Test offline**: Disable network in DevTools and verify offline functionality
3. **Check lighthouse**: Use Chrome DevTools Lighthouse to audit PWA score
4. **Test on mobile**: Install and test on actual mobile devices

## Advanced Features

### Push Notifications

- Set up VAPID keys for web push
- Implement notification scheduling
- Add notification preferences

### Background Sync

- Queue actions when offline
- Sync when connection restored
- Handle failed requests gracefully

### Advanced Caching

- Cache strategies (Cache First, Network First, etc.)
- Cache audiobook covers
- Implement cache invalidation

This PWA implementation will make your audiobook tracker feel like a native mobile app while providing offline capabilities and improved user engagement!
