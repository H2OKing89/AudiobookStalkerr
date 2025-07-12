<template>
  <div>
    <!-- Control Panel -->
    <section class="row mb-4">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title">Authors Management</h3>
            <div class="card-actions">
              <button type="button" 
                      class="btn btn-primary"
                      data-bs-toggle="modal" 
                      data-bs-target="#addAuthorModal">
                <i class="fas fa-plus me-1"></i>
                Add Author
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-lg-6">
                <label for="author-search" class="form-label">Search Authors</label>
                <div class="input-icon">
                  <span class="input-icon-addon">
                    <i class="fas fa-search"></i>
                  </span>
                  <input type="text" 
                         id="author-search" 
                         class="form-control" 
                         placeholder="Search by author name..."
                         v-model="searchQuery"
                         @input="filterAuthors">
                </div>
              </div>
              <div class="col-lg-3">
                <label for="sort-select" class="form-label">Sort By</label>
                <select id="sort-select" 
                        class="form-select" 
                        v-model="sortBy"
                        @change="sortAuthors">
                  <option value="name">Author Name</option>
                  <option value="books">Number of Books</option>
                  <option value="recent">Recently Added</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label">Actions</label>
                <div class="btn-group w-100">
                  <button type="button" class="btn btn-outline-success" @click="exportAuthors">
                    <i class="fas fa-download me-1"></i>
                    Export
                  </button>
                  <button type="button" class="btn btn-outline-info" @click="importAuthors">
                    <i class="fas fa-upload me-1"></i>
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics -->
    <section class="row mb-4">
      <div class="col">
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-primary">{{ stats.total_authors }}</div>
                <div class="text-muted">Total Authors</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-success">{{ stats.total_books }}</div>
                <div class="text-muted">Total Books</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-warning">{{ stats.complete_books }}</div>
                <div class="text-muted">Complete Books</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card theme-card">
              <div class="card-body p-3 text-center">
                <div class="text-h1 m-0 text-info">{{ Math.round(stats.completion_percentage) }}%</div>
                <div class="text-muted">Completion</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Authors List -->
    <section class="row">
      <div class="col-12">
        <div class="card theme-card">
          <div class="card-header">
            <h3 class="card-title">
              Authors List
              <span class="badge bg-secondary ms-2">{{ filteredAuthors.length }}</span>
            </h3>
          </div>
          <div class="card-body">
            <div v-if="isLoading" class="text-center py-5">
              <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading authors...</span>
              </div>
              <p class="text-muted">Loading authors...</p>
            </div>
            
            <div v-else-if="filteredAuthors.length === 0" class="text-center py-5">
              <i class="fas fa-users fa-3x text-muted mb-3"></i>
              <h4>No authors found</h4>
              <p class="text-muted">Start by adding authors to track their upcoming releases.</p>
              <button type="button" 
                      class="btn btn-primary"
                      data-bs-toggle="modal" 
                      data-bs-target="#addAuthorModal">
                <i class="fas fa-plus me-1"></i>
                Add Your First Author
              </button>
            </div>
            
            <div v-else class="table-responsive">
              <table class="table table-striped">
                <thead>
                  <tr>
                    <th>Author Name</th>
                    <th>Books</th>
                    <th>Complete</th>
                    <th>Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="author in filteredAuthors" :key="author.name">
                    <td>
                      <strong>{{ author.name }}</strong>
                    </td>
                    <td>
                      <span class="badge bg-primary">{{ author.books.length }}</span>
                    </td>
                    <td>
                      <span class="badge bg-success">{{ getCompleteBooks(author) }}</span>
                    </td>
                    <td>
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar" 
                             :style="{ width: getCompletionPercentage(author) + '%' }"
                             :class="getProgressBarClass(getCompletionPercentage(author))">
                        </div>
                      </div>
                      <small class="text-muted">{{ Math.round(getCompletionPercentage(author)) }}%</small>
                    </td>
                    <td>
                      <div class="btn-group" role="group">
                        <button type="button" 
                                class="btn btn-sm btn-outline-primary"
                                @click="editAuthor(author)"
                                title="Edit author">
                          <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" 
                                class="btn btn-sm btn-outline-info"
                                @click="viewAuthorDetails(author)"
                                title="View details">
                          <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" 
                                class="btn btn-sm btn-outline-danger"
                                @click="confirmDeleteAuthor(author)"
                                title="Delete author">
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Add Author Modal -->
    <div class="modal fade" id="addAuthorModal" tabindex="-1" aria-labelledby="addAuthorModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="addAuthorModalLabel">Add New Author</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="addAuthor">
              <div class="mb-3">
                <label for="author-name" class="form-label">Author Name</label>
                <input type="text" 
                       id="author-name" 
                       class="form-control" 
                       v-model="newAuthorName"
                       placeholder="Enter author name..."
                       required>
                <div class="form-text">Enter the full name of the author to track.</div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" @click="addAuthor" :disabled="!newAuthorName.trim()">
              <i class="fas fa-plus me-1"></i>
              Add Author
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteAuthorModal" tabindex="-1" aria-labelledby="deleteAuthorModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deleteAuthorModalLabel">Confirm Delete</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete <strong>{{ authorToDelete?.name }}</strong>?</p>
            <p class="text-muted">This will remove the author and all their books from your watchlist. This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="deleteAuthor">
              <i class="fas fa-trash me-1"></i>
              Delete Author
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudiobooksStore } from '@/stores/audiobooks'

const audiobooksStore = useAudiobooksStore()

const isLoading = ref(false)
const authors = ref([])
const searchQuery = ref('')
const sortBy = ref('name')
const newAuthorName = ref('')
const authorToDelete = ref(null)

const stats = computed(() => {
  const totalAuthors = authors.value.length
  const totalBooks = authors.value.reduce((sum, author) => sum + author.books.length, 0)
  const completeBooks = authors.value.reduce((sum, author) => sum + getCompleteBooks(author), 0)
  const completionPercentage = totalBooks > 0 ? (completeBooks / totalBooks) * 100 : 0

  return {
    total_authors: totalAuthors,
    total_books: totalBooks,
    complete_books: completeBooks,
    completion_percentage: completionPercentage
  }
})

const filteredAuthors = computed(() => {
  let filtered = authors.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(author => 
      author.name.toLowerCase().includes(query)
    )
  }

  // Sort authors
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'books':
        return b.books.length - a.books.length
      case 'recent':
        // For now, sort by name as we don't have date added
        return a.name.localeCompare(b.name)
      default: // name
        return a.name.localeCompare(b.name)
    }
  })

  return filtered
})

const filterAuthors = () => {
  // Trigger reactivity (searchQuery is already reactive)
}

const sortAuthors = () => {
  // Trigger reactivity (sortBy is already reactive)
}

const getCompleteBooks = (author) => {
  return author.books.filter(book => isBookComplete(book)).length
}

const getCompletionPercentage = (author) => {
  const complete = getCompleteBooks(author)
  const total = author.books.length
  return total > 0 ? (complete / total) * 100 : 0
}

const getProgressBarClass = (percentage) => {
  if (percentage >= 80) return 'bg-success'
  if (percentage >= 50) return 'bg-warning'
  return 'bg-danger'
}

const isBookComplete = (book) => {
  return Boolean(
    book.title &&
    book.series &&
    book.publisher &&
    book.narrator &&
    Array.isArray(book.narrator) &&
    book.narrator.length > 0 &&
    book.narrator.every(n => n && n.trim())
  )
}

const loadAuthors = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/audiobooks')
    if (response.ok) {
      const data = await response.json()
      authors.value = data.data || []
    } else {
      console.error('Failed to load authors')
    }
  } catch (error) {
    console.error('Error loading authors:', error)
  } finally {
    isLoading.value = false
  }
}

const addAuthor = async () => {
  if (!newAuthorName.value.trim()) return

  try {
    const formData = new FormData()
    formData.append('author_name', newAuthorName.value.trim())

    const response = await fetch('/api/authors', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      newAuthorName.value = ''
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('addAuthorModal'))
      modal.hide()
      // Reload authors
      await loadAuthors()
    } else {
      const error = await response.json()
      alert(error.detail || 'Failed to add author')
    }
  } catch (error) {
    console.error('Error adding author:', error)
    alert('Error adding author. Please try again.')
  }
}

const confirmDeleteAuthor = (author) => {
  authorToDelete.value = author
  const modal = new bootstrap.Modal(document.getElementById('deleteAuthorModal'))
  modal.show()
}

const deleteAuthor = async () => {
  if (!authorToDelete.value) return

  try {
    const response = await fetch(`/api/authors/${encodeURIComponent(authorToDelete.value.name)}`, {
      method: 'DELETE'
    })

    if (response.ok) {
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAuthorModal'))
      modal.hide()
      // Reload authors
      await loadAuthors()
      authorToDelete.value = null
    } else {
      const error = await response.json()
      alert(error.detail || 'Failed to delete author')
    }
  } catch (error) {
    console.error('Error deleting author:', error)
    alert('Error deleting author. Please try again.')
  }
}

const editAuthor = (author) => {
  // Navigate to author detail page or open edit modal
  alert(`Edit functionality for ${author.name} coming soon!`)
}

const viewAuthorDetails = (author) => {
  // Navigate to author detail page
  window.location.href = `/authors/${encodeURIComponent(author.name)}`
}

const exportAuthors = async () => {
  try {
    const response = await fetch('/api/export', {
      method: 'POST'
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `authors_export_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      throw new Error('Export failed')
    }
  } catch (error) {
    console.error('Error exporting authors:', error)
    alert('Error exporting authors. Please try again.')
  }
}

const importAuthors = () => {
  alert('Import functionality coming soon!')
}

onMounted(() => {
  loadAuthors()
})
</script>

<style scoped>
.text-h1 {
  font-size: 2rem;
  font-weight: 600;
}

.progress {
  background-color: #f8f9fa;
}
</style>
