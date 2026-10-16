<script setup>
import { ref, watch } from 'vue'
import { currentUser } from '../auth'
import { registerInterest } from '../data'
import { errorMessage } from '../errors'

const props = defineProps({
  selectedEvent: {
    type: Object,
    default: null
  }
})

const isSubmitting = ref(false)
const submitError = ref('')

const formData = ref({
  fullName: '',
  email: '',
  participants: 1,
  experienceLevel: '',
  termsAccepted: false
})

const errors = ref({
  fullName: null,
  email: null,
  participants: null,
  experienceLevel: null,
  termsAccepted: null
})

const successMessage = ref('')

const validateFullName = (showError) => {
  const fullName = formData.value.fullName.trim()

  if (fullName.length < 3) {
    if (showError) errors.value.fullName = 'Full name must be at least 3 characters.'
    return false
  }

  if (fullName.length > 50) {
    if (showError) errors.value.fullName = 'Full name must be 50 characters or less.'
    return false
  }

  if (fullName.includes('<') || fullName.includes('>')) {
    if (showError) errors.value.fullName = 'Full name cannot include < or >.'
    return false
  }

  errors.value.fullName = null
  return true
}

const validateEmail = (showError) => {
  const email = formData.value.email.trim()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(email)) {
    if (showError) errors.value.email = 'Enter a valid email address.'
    return false
  }

  if (email.length > 100) {
    if (showError) errors.value.email = 'Email address must be 100 characters or less.'
    return false
  }

  errors.value.email = null
  return true
}

const validateParticipants = (showError) => {
  const participants = formData.value.participants

  if (!Number.isInteger(participants) || participants < 1 || participants > 5) {
    if (showError) errors.value.participants = 'Participants must be between 1 and 5.'
    return false
  }

  errors.value.participants = null
  return true
}

const validateExperience = (showError) => {
  if (!formData.value.experienceLevel) {
    if (showError) errors.value.experienceLevel = 'Select an experience level.'
    return false
  }

  errors.value.experienceLevel = null
  return true
}

const validateTerms = (showError) => {
  if (!formData.value.termsAccepted) {
    if (showError) errors.value.termsAccepted = 'Confirm that the event information is correct.'
    return false
  }

  errors.value.termsAccepted = null
  return true
}

const submitForm = async () => {
  successMessage.value = ''
  submitError.value = ''
  if (!currentUser.value || !props.selectedEvent || isSubmitting.value) return

  const fullNameIsValid = validateFullName(true)
  const emailIsValid = validateEmail(true)
  const participantsAreValid = validateParticipants(true)
  const experienceIsValid = validateExperience(true)
  const termsAreValid = validateTerms(true)

  if (
    !fullNameIsValid ||
    !emailIsValid ||
    !participantsAreValid ||
    !experienceIsValid ||
    !termsAreValid
  ) {
    return
  }

  isSubmitting.value = true
  try {
    await registerInterest({
      eventId: props.selectedEvent.id,
      fullName: formData.value.fullName.trim(),
      participants: formData.value.participants,
      experienceLevel: formData.value.experienceLevel,
      termsAccepted: formData.value.termsAccepted,
    })
    clearForm()
    successMessage.value = `Your interest in ${props.selectedEvent.title} was saved. A place has not been reserved yet.`
  } catch (error) {
    submitError.value = errorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

const clearForm = () => {
  formData.value = {
    fullName: currentUser.value?.fullName || '',
    email: currentUser.value?.email || '',
    participants: 1,
    experienceLevel: '',
    termsAccepted: false
  }

  errors.value = {
    fullName: null,
    email: null,
    participants: null,
    experienceLevel: null,
    termsAccepted: null
  }

  successMessage.value = ''
  submitError.value = ''
}

watch([() => currentUser.value?.id, () => currentUser.value?.fullName], clearForm, { immediate: true })
watch(() => props.selectedEvent?.id, () => {
  successMessage.value = ''
  submitError.value = ''
})
</script>

<template>
  <div v-if="!selectedEvent" class="content-panel">
    <div class="row align-items-center g-3">
      <div class="col-md-8">
        <h3 class="h5 fw-semibold mb-2">Register your interest</h3>
        <p class="text-secondary mb-0">Select an activity above to begin registration.</p>
      </div>
      <div class="col-md-4 text-md-end">
        <span class="status-badge">No event selected</span>
      </div>
    </div>
  </div>

  <div v-else class="content-panel">
    <div class="registration-heading mb-4">
      <div>
        <h3 class="h5 fw-semibold mb-2">{{ selectedEvent.title }}</h3>
        <p class="text-secondary mb-0">
          {{ selectedEvent.date }} at {{ selectedEvent.location }}
        </p>
      </div>
      <span class="status-badge">Event selected</span>
    </div>

    <p v-if="!currentUser" class="alert alert-info">Please log in above to register your interest.</p>
    <p class="text-secondary">This saves your interest only. It does not reserve a place.</p>
    <form v-if="currentUser" novalidate @submit.prevent="submitForm">
      <fieldset :disabled="isSubmitting">
        <legend class="visually-hidden">Registration details</legend>
      <div class="row g-3">
        <div class="col-md-6">
          <label for="fullName" class="form-label">Full name</label>
          <input
            id="fullName"
            v-model="formData.fullName"
            type="text"
            maxlength="50"
            class="form-control"
            :class="{ 'is-invalid': errors.fullName }"
            @blur="validateFullName(true)"
            @input="validateFullName(false)"
          >
          <div v-if="errors.fullName" class="invalid-feedback">{{ errors.fullName }}</div>
        </div>

        <div class="col-md-6">
          <label for="email" class="form-label">Email address</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            readonly
            maxlength="100"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
            @blur="validateEmail(true)"
            @input="validateEmail(false)"
          >
          <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
        </div>

        <div class="col-md-6">
          <label for="participants" class="form-label">Number of participants</label>
          <input
            id="participants"
            v-model.number="formData.participants"
            type="number"
            min="1"
            max="5"
            class="form-control"
            :class="{ 'is-invalid': errors.participants }"
            @blur="validateParticipants(true)"
            @input="validateParticipants(false)"
          >
          <div v-if="errors.participants" class="invalid-feedback">
            {{ errors.participants }}
          </div>
        </div>

        <div class="col-md-6">
          <label for="experienceLevel" class="form-label">Experience level</label>
          <select
            id="experienceLevel"
            v-model="formData.experienceLevel"
            class="form-select"
            :class="{ 'is-invalid': errors.experienceLevel }"
            @change="validateExperience(true)"
          >
            <option disabled value="">Select an experience level</option>
            <option value="Beginner">Beginner</option>
            <option value="Some experience">Some experience</option>
            <option value="Experienced">Experienced</option>
          </select>
          <div v-if="errors.experienceLevel" class="invalid-feedback">
            {{ errors.experienceLevel }}
          </div>
        </div>

        <div class="col-12">
          <div class="form-check">
            <input
              id="termsAccepted"
              v-model="formData.termsAccepted"
              type="checkbox"
              class="form-check-input"
              :class="{ 'is-invalid': errors.termsAccepted }"
              @change="validateTerms(true)"
            >
            <label for="termsAccepted" class="form-check-label">
              I confirm that I have checked the event date and location.
            </label>
            <div v-if="errors.termsAccepted" class="invalid-feedback d-block">
              {{ errors.termsAccepted }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="successMessage" class="alert alert-success mt-4 mb-0" role="alert">
        {{ successMessage }}
      </div>

      <p v-if="submitError" class="alert alert-danger mt-3" role="alert">{{ submitError }}</p>
      <div class="d-flex flex-wrap gap-2 mt-4">
        <button type="submit" class="btn btn-success">{{ isSubmitting ? 'Saving…' : 'Register interest' }}</button>
        <button type="button" class="btn btn-outline-secondary" @click="clearForm">
          Clear form
        </button>
      </div>
      </fieldset>
    </form>
  </div>
</template>
