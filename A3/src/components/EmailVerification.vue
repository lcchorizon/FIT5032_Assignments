<script setup>
// Let members request a verification link and refresh their account after opening it.
import { ref, watch } from 'vue'
import { currentUser, refreshEmailVerification, verifyAccountEmail } from '../auth'
import { errorMessage } from '../errors'

const busy = ref(false)
const message = ref('')
const error = ref('')
// This short UI cooldown avoids repeated clicks. Firebase also applies its own email request limits.
const nextSend = ref(0)
watch(() => currentUser.value?.id, () => { message.value = ''; error.value = ''; nextSend.value = 0 })
const run = async (check) => {
  if (busy.value) return
  const uid = currentUser.value?.id
  busy.value = true
  message.value = ''; error.value = ''
  try {
    if (check) {
      // Opening the link in another tab does not immediately refresh this component's account state.
      const verified = await refreshEmailVerification()
      if (currentUser.value?.id === uid) message.value = verified ? 'Your email is verified. You can now request booking emails.' : 'The email is not verified yet. Open the link in the verification email, then check again.'
    } else {
      if (Date.now() < nextSend.value) {
        error.value = 'Wait one minute before requesting another verification email.'
        return
      }
      await verifyAccountEmail()
      if (currentUser.value?.id === uid) {
        nextSend.value = Date.now() + 60000
        message.value = 'A verification email was requested. Check your inbox and spam folder, then open the link.'
      }
    }
  } catch (failure) {
    if (currentUser.value?.id === uid) error.value = errorMessage(failure)
  } finally { busy.value = false }
}
</script>

<template>
  <div v-if="currentUser" class="mt-3">
    <p v-if="currentUser.emailVerified" class="text-success">Email verified</p>
    <template v-else>
      <p>Verify {{ currentUser.email }} to receive booking confirmations with a PDF attachment.</p>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-success" type="button" :disabled="busy" @click="run(false)">Send verification email</button>
        <button class="btn btn-outline-secondary" type="button" :disabled="busy" @click="run(true)">I have verified my email</button>
      </div>
    </template>
    <p v-if="message" class="alert alert-success mt-3" role="status">{{ message }}</p>
    <p v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</p>
  </div>
</template>
