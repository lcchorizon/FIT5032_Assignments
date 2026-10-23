<template>
  <header class="border-bottom bg-light">
    <nav class="container d-flex align-items-center gap-4 py-3" aria-label="Main navigation">
      <RouterLink class="navbar-brand fw-bold" to="/">HL Library</RouterLink>
      <RouterLink class="nav-link" active-class="text-primary" to="/">Home</RouterLink>
      <RouterLink class="nav-link" active-class="text-primary" to="/WeatherCheck">Get Weather</RouterLink>
    </nav>
  </header>
</template>
