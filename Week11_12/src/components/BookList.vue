<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { collection, deleteDoc, doc, getDocs, onSnapshot, limit, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

const books = ref([])
const message = ref('')
const editingId = ref('')
const editingName = ref('')

const loadBooks = async () => {
  const snapshot = await getDocs(collection(db, 'books'))
  books.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  message.value = 'Loaded all books.'
}

const runQuery = async (type) => {
  let booksQuery
  if (type === 'where') booksQuery = query(collection(db, 'books'), where('isbn', '>', 1000))
  if (type === 'orderBy') booksQuery = query(collection(db, 'books'), orderBy('isbn', 'desc'))
  if (type === 'limit') booksQuery = query(collection(db, 'books'), orderBy('isbn', 'desc'), limit(2))
  const snapshot = await getDocs(booksQuery)
  books.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  message.value = `Query completed: ${type}.`
}

const startUpdate = (book) => {
  editingId.value = book.id
  editingName.value = book.name
}

const updateBook = async (book) => {
  if (!editingName.value.trim()) return
  await updateDoc(doc(db, 'books', book.id), { name: editingName.value.trim() })
  await loadBooks()
  message.value = `Updated ${book.isbn}.`
  editingId.value = ''
  editingName.value = ''
}

const removeBook = async (book) => {
  await deleteDoc(doc(db, 'books', book.id))
  await loadBooks()
  message.value = `Deleted ${book.isbn}.`
}

let unsubscribe
onMounted(() => {
  unsubscribe = onSnapshot(collection(db, 'books'), (snapshot) => {
    books.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }, (error) => { message.value = error.message })
})
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <section class="mt-4">
    <h2>Book list</h2>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <button class="btn btn-outline-primary" type="button" @click="loadBooks">All books</button>
      <button class="btn btn-outline-primary" type="button" @click="runQuery('where')">where ISBN &gt; 1000</button>
      <button class="btn btn-outline-primary" type="button" @click="runQuery('orderBy')">orderBy ISBN</button>
      <button class="btn btn-outline-primary" type="button" @click="runQuery('limit')">limit 2</button>
    </div>
    <p v-if="message" class="text-success">{{ message }}</p>
    <table class="table" v-if="books.length">
      <thead><tr><th>ISBN</th><th>Name</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="book in books" :key="book.id">
          <td>{{ book.isbn }}</td>
          <td>
            <input v-if="editingId === book.id" v-model="editingName" class="form-control form-control-sm" aria-label="Updated book name">
            <span v-else>{{ book.name }}</span>
          </td>
          <td>
            <button v-if="editingId === book.id" class="btn btn-sm btn-success me-2" type="button" @click="updateBook(book)">Save</button>
            <button v-else class="btn btn-sm btn-warning me-2" type="button" @click="startUpdate(book)">Update</button>
            <button class="btn btn-sm btn-danger" type="button" @click="removeBook(book)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>No books found for this query.</p>
  </section>
</template>
