# 🎯 Alpine.js Quick Reference - Audiobook Stalkerr

## 🚀 **Essential Directives**

```html
<!-- Data binding -->
<div x-data="{ name: 'Alpine.js' }">
  <input x-model="name">
  <span x-text="name"></span>
</div>

<!-- Conditional display -->
<div x-show="isVisible" x-transition>Content</div>
<div x-if="shouldRender">Content</div>

<!-- Loops -->
<template x-for="item in items" :key="item.id">
  <div x-text="item.name"></div>
</template>

<!-- Events -->
<button @click="doSomething()">Click</button>
<input @input.debounce.300ms="search()">

<!-- Dynamic attributes -->
<div :class="isActive ? 'active' : ''">
<img :src="imageUrl" :alt="description">
```

## 🎨 **Your Implementation Examples**

### **Search Component:**

```html
<div x-data="{ query: '', results: [] }">
  <input x-model="query" @input.debounce.300ms="search()">
  <div x-text="`${results.length} found`"></div>
</div>
```

### **View Mode Toggle:**

```html
<div x-data="{ mode: 'grid' }">
  <button @click="mode = 'grid'" 
          :class="mode === 'grid' ? 'active' : ''">Grid</button>
  <div x-show="mode === 'grid'" x-transition>Grid content</div>
</div>
```

### **Filter Component:**

```html
<div x-data="{ filters: { author: '', date: '' } }">
  <select x-model="filters.author" @change="applyFilters()">
    <template x-for="author in authors">
      <option :value="author" x-text="author"></option>
    </template>
  </select>
</div>
```

## ⌨️ **Keyboard Shortcuts (Built-in)**

- `Ctrl+F` - Focus search
- `Ctrl+A` - Add author  
- `Ctrl+S` - Save changes
- `V` - Toggle view mode
- `Escape` - Clear search

## 🔧 **Integration Points**

```javascript
// Communicate with existing modules
if (window.core) {
  window.core.emit('view:changed', mode);
}

// Update existing app
if (window.app) {
  window.app.setViewMode(mode);
}
```

## 🎯 **URLs to Test**

- **Main App**: <http://localhost:5005>
- **Test Page**: <http://localhost:8888/alpine_test.html>
- **Upcoming**: <http://localhost:5005/>
- **Authors**: <http://localhost:5005/authors>

## 🏆 **Success Indicators**

✅ Real-time search works  
✅ Filters update instantly  
✅ View modes switch smoothly  
✅ No console errors  
✅ Keyboard shortcuts respond  
✅ Existing functionality intact  

### *Alpine.js is now enhancing your audiobook tracker! 🎉*
