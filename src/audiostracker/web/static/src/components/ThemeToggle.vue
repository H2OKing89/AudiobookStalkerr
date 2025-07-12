<template>
  <div class="theme-controls">
    <!-- Theme Toggle Button -->
    <button
      type="button"
      class="theme-toggle-btn"
      :class="{ 'theme-auto-indicator': currentTheme === 'auto' }"
      @click="toggleTheme"
      :title="`Switch to ${getNextThemeName()} theme`"
      :aria-label="`Current theme: ${themeInfo.name}. Click to switch to ${getNextThemeName()}`"
    >
      <i :class="themeInfo.icon" aria-hidden="true"></i>
      <span class="visually-hidden">{{ themeInfo.name }} theme</span>
    </button>

    <!-- Theme Dropdown (optional, for three-way selection) -->
    <div v-if="showDropdown" class="dropdown theme-dropdown">
      <button
        class="btn btn-outline-secondary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        :title="`Current theme: ${themeInfo.name}`"
      >
        <i :class="themeInfo.icon" class="me-1" aria-hidden="true"></i>
        {{ themeInfo.name }}
      </button>
      <ul class="dropdown-menu">
        <li v-for="(theme, key) in themes" :key="key">
          <button
            type="button"
            class="dropdown-item"
            :class="{ active: currentTheme === key }"
            @click="setTheme(key)"
          >
            <i :class="theme.icon" class="me-2" aria-hidden="true"></i>
            {{ theme.name }}
            <span v-if="key === 'auto'" class="badge bg-info ms-2">Auto</span>
            <span v-if="currentTheme === key" class="ms-auto">
              <i class="fas fa-check" aria-hidden="true"></i>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Props
defineProps({
  showDropdown: {
    type: Boolean,
    default: false
  }
})

// Theme composable
const {
  currentTheme,
  themeInfo,
  themes,
  initializeTheme,
  setTheme,
  toggleTheme,
  cycleTheme
} = useTheme()

// Computed properties
const getNextThemeName = () => {
  if (currentTheme.value === 'light') return 'dark'
  if (currentTheme.value === 'dark') return 'auto'
  return 'light'
}

// Initialize theme on component mount
onMounted(() => {
  initializeTheme()
})

// Expose methods for parent components
defineExpose({
  setTheme,
  toggleTheme,
  cycleTheme,
  currentTheme,
  themeInfo
})
</script>

<style scoped>
.theme-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: var(--bg-primary);
  color: var(--text-color);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.theme-toggle-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.theme-toggle-btn:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.theme-toggle-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.theme-toggle-btn i {
  font-size: 1rem;
  transition: transform 0.3s ease;
}

.theme-toggle-btn:hover i {
  transform: rotate(15deg);
}

/* Auto theme indicator */
.theme-auto-indicator {
  position: relative;
}

.theme-auto-indicator::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: var(--info-color);
  border-radius: 50%;
  border: 2px solid var(--bg-primary);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

/* Dropdown styles */
.theme-dropdown .dropdown-menu {
  min-width: 8rem;
}

.theme-dropdown .dropdown-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  transition: all 0.2s ease;
}

.theme-dropdown .dropdown-item:hover {
  background: var(--bg-secondary);
}

.theme-dropdown .dropdown-item.active {
  background: var(--primary-color);
  color: white;
}

.theme-dropdown .dropdown-item i {
  width: 1rem;
  text-align: center;
}

/* Dark theme adjustments */
body.dark-theme .theme-toggle-btn {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

body.dark-theme .theme-toggle-btn:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  .theme-toggle-btn,
  .theme-toggle-btn i,
  .theme-dropdown .dropdown-item {
    transition: none !important;
  }
  
  .theme-toggle-btn:hover {
    transform: none !important;
  }
  
  .theme-toggle-btn:hover i {
    transform: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .theme-toggle-btn {
    border: 2px solid var(--text-color);
  }
  
  .theme-auto-indicator::after {
    border: 2px solid var(--text-color);
  }
}
</style>
