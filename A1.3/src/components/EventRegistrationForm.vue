<script setup>
import { ref } from 'vue'

const props = defineProps({
  selectedEvent: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['registration-submitted'])

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

const submitForm = () => {
  successMessage.value = ''

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

  const registration = {
    id: Date.now(),
    eventTitle: props.selectedEvent.title,
    fullName: formData.value.fullName.trim(),
    email: formData.value.email.trim(),
    participants: formData.value.participants,
    experienceLevel: formData.value.experienceLevel
  }

  emit('registration-submitted', registration)
  clearForm()
  successMessage.value = `Registration submitted for ${props.selectedEvent.title}.`
}

const clearForm = () => {
  formData.value = {
    fullName: '',
    email: '',
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
}
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

    <form novalidate @submit.prevent="submitForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label for="fullName" class="form-label">Full name</label>
          <input
            id="fullName"
            v-model="formData.fullName"
            type="text"
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

      <div class="d-flex flex-wrap gap-2 mt-4">
        <button type="submit" class="btn btn-success">Submit registration</button>
        <button type="button" class="btn btn-outline-secondary" @click="clearForm">
          Clear form
        </button>
      </div>
    </form>
  </div>
</template>
