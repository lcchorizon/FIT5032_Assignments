<script setup>
// Chart.js owns the canvas only. The parent supplies the same values to accessible tables and controls.
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  type: { type: String, default: 'line' },
  labels: { type: Array, required: true },
  datasets: { type: Array, required: true },
  label: { type: String, required: true },
  describedby: { type: String, required: true },
  horizontal: { type: Boolean, default: false },
})
const element = ref(null)
let chart
const chartData = () => ({
  labels: [...props.labels],
  datasets: props.datasets.map((dataset) => ({ ...dataset, data: [...dataset.data] })),
})
onMounted(() => {
  chart = new Chart(element.value, {
    type: props.type,
    data: chartData(),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: props.horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: props.horizontal
        ? {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: {
              ticks: {
                autoSkip: false,
                // Keep long activity names from taking all the plot width on a phone. The table keeps the full name.
                callback(value) {
                  const label = this.getLabelForValue(value)
                  const limit = this.chart.width < 450 ? 18 : 32
                  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label
                },
              },
            },
          }
        : {
            x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
    },
  })
})
// Reuse the chart instance when filters change and release it when the page closes.
watch(
  () => [props.labels, props.datasets],
  () => {
    if (!chart) return
    chart.data = chartData()
    chart.update('none')
  },
  { deep: true },
)
onScopeDispose(() => {
  chart?.destroy()
  chart = null
})
</script>

<template>
  <div class="dashboard-chart">
    <canvas ref="element" role="img" :aria-label="label" :aria-describedby="describedby"
      >The data for this chart is available in the table below.</canvas
    >
  </div>
</template>
