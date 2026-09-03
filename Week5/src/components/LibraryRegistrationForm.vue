<template>
  <div class="container mt-5">
    <div class="row">
      <div class="col-md-8 offset-md-2">
        <h1 class="text-center">User Information Form / Credentials</h1>
        <form @submit.prevent="submitForm">
          <div class="row">
            <div class="col-sm-6">
              <div class="mb-3">
                <label for="username" class="form-label">Username:</label>
                <input
                  type="text"
                  id="username"
                  class="form-control"
                  :class="{ 'is-invalid': errors.username }"
                  v-model="formData.username"
                  @blur="validateUsername(true)"
                  @input="validateUsername(false)"
                >
                <div v-if="errors.username" class="invalid-feedback">
                  {{ errors.username }}
                </div>
              </div>
            </div>

            <div class="col-sm-6">
              <div class="mb-3">
                <label for="password" class="form-label">Password:</label>
                <input
                  type="password"
                  id="password"
                  class="form-control"
                  :class="{ 'is-invalid': errors.password }"
                  v-model="formData.password"
                  @blur="validatePassword(true)"
                  @input="validatePassword(false)"
                >
                <div v-if="errors.password" class="invalid-feedback">
                  {{ errors.password }}
                </div>
              </div>
            </div>
          </div>

          <div class="mb-3 form-check">
            <input
              type="checkbox"
              id="isAustralian"
              class="form-check-input"
              :class="{ 'is-invalid': errors.isAustralian }"
              v-model="formData.isAustralian"
              @change="validateResidency(true)"
            >
            <label for="isAustralian" class="form-check-label">Australian Resident?</label>
            <div v-if="errors.isAustralian" class="invalid-feedback d-block">
              {{ errors.isAustralian }}
            </div>
          </div>

          <div class="mb-3">
            <label for="reason" class="form-label">Reason For Joining:</label>
            <textarea
              id="reason"
              class="form-control"
              :class="{ 'is-invalid': errors.reason }"
              rows="3"
              v-model="formData.reason"
              @blur="validateReason(true)"
              @input="validateReason(false)"
            ></textarea>
            <div v-if="errors.reason" class="invalid-feedback">
              {{ errors.reason }}
            </div>
          </div>

          <div class="mb-3">
            <label for="gender" class="form-label">Gender</label>
            <select
              id="gender"
              class="form-select"
              :class="{ 'is-invalid': errors.gender }"
              v-model="formData.gender"
              @change="validateGender(true)"
            >
              <option disabled value="">Please select a gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
            <div v-if="errors.gender" class="invalid-feedback">
              {{ errors.gender }}
            </div>
          </div>

          <div class="text-center">
            <button type="submit" class="btn btn-primary me-2">Submit</button>
            <button type="button" class="btn btn-secondary" @click="clearForm">Clear</button>
          </div>
        </form>
      </div>
    </div>

    <div class="row mt-5" v-if="submittedUsers.length">
      <div class="col-12">
        <h2 class="mb-3">Submitted User Information</h2>
        <DataTable :value="submittedUsers" stripedRows tableStyle="min-width: 50rem">
          <Column field="username" header="Username" />
          <Column header="Password">
            <template #body>••••••••</template>
          </Column>
          <Column header="Australian Resident">
            <template #body="slotProps">
              {{ slotProps.data.isAustralian ? 'Yes' : 'No' }}
            </template>
          </Column>
          <Column field="gender" header="Gender" />
          <Column field="reason" header="Reason for Joining" />
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const formData = ref({
  username: '',
  password: '',
  isAustralian: false,
  reason: '',
  gender: ''
})

const submittedUsers = ref([])

const errors = ref({
  username: null,
  password: null,
  isAustralian: null,
  reason: null,
  gender: null
})

const validateUsername = (showError) => {
  const username = formData.value.username.trim()

  if (username.length < 3) {
    if (showError) errors.value.username = 'Username must be at least 3 characters.'
    return false
  }

  errors.value.username = null
  return true
}

const validatePassword = (showError) => {
  const password = formData.value.password
  let message = null

  if (password.length < 8) {
    message = 'Password must be at least 8 characters.'
  } else if (!/[A-Z]/.test(password)) {
    message = 'Password must include an uppercase letter.'
  } else if (!/[a-z]/.test(password)) {
    message = 'Password must include a lowercase letter.'
  } else if (!/\d/.test(password)) {
    message = 'Password must include a number.'
  } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    message = 'Password must include a special character.'
  }

  if (message) {
    if (showError) errors.value.password = message
    return false
  }

  errors.value.password = null
  return true
}

const validateResidency = (showError) => {
  if (!formData.value.isAustralian) {
    if (showError) errors.value.isAustralian = 'Please confirm that you are an Australian resident.'
    return false
  }

  errors.value.isAustralian = null
  return true
}

const validateReason = (showError) => {
  const reason = formData.value.reason.trim()

  if (reason.length < 10) {
    if (showError) errors.value.reason = 'Please enter at least 10 characters.'
    return false
  }

  errors.value.reason = null
  return true
}

const validateGender = (showError) => {
  if (!formData.value.gender) {
    if (showError) errors.value.gender = 'Please select a gender.'
    return false
  }

  errors.value.gender = null
  return true
}

const submitForm = () => {
  const usernameIsValid = validateUsername(true)
  const passwordIsValid = validatePassword(true)
  const residencyIsValid = validateResidency(true)
  const reasonIsValid = validateReason(true)
  const genderIsValid = validateGender(true)

  if (
    !usernameIsValid ||
    !passwordIsValid ||
    !residencyIsValid ||
    !reasonIsValid ||
    !genderIsValid
  ) {
    return
  }

  submittedUsers.value.push({ ...formData.value })
  clearForm()
}

const clearForm = () => {
  formData.value = {
    username: '',
    password: '',
    isAustralian: false,
    reason: '',
    gender: ''
  }

  errors.value = {
    username: null,
    password: null,
    isAustralian: null,
    reason: null,
    gender: null
  }
}
</script>
