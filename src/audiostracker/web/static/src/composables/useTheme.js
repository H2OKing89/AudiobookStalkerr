/**
 * Vue Theme Composable
 * Exactly matching the legacy AudiobookStalkerr theme system
 * Uses browser prefers-color-scheme only, no manual toggle
 */
import { ref, computed, onMounted, watch } from 'vue'

// Global theme state - simplified to just track if dark mode is active
const isDarkMode = ref(false)
const isInitialized = ref(false)

export function useTheme() {
  // Computed properties
  const isDark = computed(() => isDarkMode.value)
  const isLight = computed(() => !isDarkMode.value)
  
  // Initialize theme system based on browser preference only
  const initializeTheme = () => {
    if (isInitialized.value) return
    
    // Check browser preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    // Set initial theme based on browser preference
    setTheme(prefersDark)
    
    // Listen for system theme changes
    setupSystemThemeListener()
    
    isInitialized.value = true
    console.log('🎨 Theme system initialized - Dark mode:', isDarkMode.value)
  }

  // Set theme based on boolean (true = dark, false = light)
  const setTheme = (darkMode) => {
    const previousTheme = isDarkMode.value
    isDarkMode.value = darkMode
    
    // Apply theme to DOM immediately
    applyTheme(darkMode)
    
    // Emit theme change event for other components
    document.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { 
        isDark: darkMode,
        previousTheme: previousTheme
      }
    }))
    
    console.log(`🎨 Theme changed: ${previousTheme ? 'dark' : 'light'} → ${darkMode ? 'dark' : 'light'}`)
  }

  // Apply theme to DOM - exact match to legacy implementation
  const applyTheme = (darkMode) => {
    // Remove existing theme classes
    document.body.classList.remove('dark-theme', 'light-theme')
    
    if (darkMode) {
      // Apply dark theme class - this triggers all the legacy CSS
      document.body.classList.add('dark-theme')
      updateMetaThemeColor('#1a1a1a')
    } else {
      // Apply light theme class (optional, most styles are default)
      document.body.classList.add('light-theme')
      updateMetaThemeColor('#6366f1')
    }

    // Apply comprehensive CSS custom properties to match legacy exactly
    applyCSSCustomProperties(darkMode)
  }

  // Apply CSS custom properties - comprehensive match to legacy themes.css
  const applyCSSCustomProperties = (darkMode) => {
    const root = document.documentElement

    if (darkMode) {
      // Dark theme CSS variables - exact match to legacy themes.css
      root.style.setProperty('--tblr-bg-primary', '#1a1a1a')
      root.style.setProperty('--tblr-bg-secondary', '#2d3748')
      root.style.setProperty('--tblr-bg-light', '#2d3748')
      root.style.setProperty('--tblr-bg-white', '#1a1a1a')
      root.style.setProperty('--tblr-body-bg', '#0f0f0f')
      root.style.setProperty('--tblr-body-color', '#e2e8f0')
      root.style.setProperty('--tblr-border-color', '#2d3748')
      root.style.setProperty('--tblr-text-muted', '#718096')
      
      // Bootstrap variables override - exact match to legacy
      root.style.setProperty('--bs-bg-opacity', '1')
      root.style.setProperty('--bs-body-bg', '#0f0f0f')
      root.style.setProperty('--bs-body-color', '#e2e8f0')
      root.style.setProperty('--bs-border-color', '#2d3748')
      root.style.setProperty('--bs-light', '#2d3748')
      root.style.setProperty('--bs-light-rgb', '45, 55, 72')
      root.style.setProperty('--bs-white', '#1a1a1a')
      root.style.setProperty('--bs-white-rgb', '26, 26, 26')
      
      // Additional custom properties for comprehensive coverage
      root.style.setProperty('--bg-primary', '#1a1a1a')
      root.style.setProperty('--bg-secondary', '#0f1419')
      root.style.setProperty('--text-primary', '#e2e8f0')
      root.style.setProperty('--text-secondary', '#cbd5e1')
      root.style.setProperty('--text-muted', '#718096')
      root.style.setProperty('--border-light', '#2d3748')
      root.style.setProperty('--border-medium', '#4a5568')
      
      // Component-specific overrides for better coverage
      root.style.setProperty('--card-bg', '#1a1a1a')
      root.style.setProperty('--input-bg', '#2d3748')
      root.style.setProperty('--input-border', '#4a5568')
      
    } else {
      // Light theme - remove all dark theme variables to use defaults
      const propsToRemove = [
        '--tblr-bg-primary', '--tblr-bg-secondary', '--tblr-bg-light', '--tblr-bg-white',
        '--tblr-body-bg', '--tblr-body-color', '--tblr-border-color', '--tblr-text-muted',
        '--bs-bg-opacity', '--bs-body-bg', '--bs-body-color', '--bs-border-color',
        '--bs-light', '--bs-light-rgb', '--bs-white', '--bs-white-rgb',
        '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary',
        '--text-muted', '--border-light', '--border-medium',
        '--card-bg', '--input-bg', '--input-border'
      ]
      
      propsToRemove.forEach(prop => root.style.removeProperty(prop))
    }
  }

  // Update meta theme color
  const updateMetaThemeColor = (color) => {
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.content = color
    }
  }

  // Setup system theme change listener - responds to browser preference changes
  const setupSystemThemeListener = () => {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      const handleSystemThemeChange = (e) => {
        // Always follow system preference
        setTheme(e.matches)
        
        // Dispatch event for components that need to react
        document.dispatchEvent(new CustomEvent('system-theme-changed', {
          detail: { 
            prefersDark: e.matches,
            isDark: e.matches
          }
        }))
      }
      
      mediaQuery.addEventListener('change', handleSystemThemeChange)
      
      // Return cleanup function
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }

  // Watch for theme changes and apply them
  watch(isDarkMode, (newValue) => {
    if (isInitialized.value) {
      applyTheme(newValue)
    }
  })

  // Return public API - simplified to match legacy approach
  return {
    // State
    isDark,
    isLight,
    
    // Methods
    initializeTheme,
    
    // For compatibility with existing code
    currentTheme: computed(() => isDarkMode.value ? 'dark' : 'light'),
    themeInfo: computed(() => ({
      name: isDarkMode.value ? 'Dark' : 'Light',
      class: isDarkMode.value ? 'dark-theme' : 'light-theme'
    }))
  }
}
