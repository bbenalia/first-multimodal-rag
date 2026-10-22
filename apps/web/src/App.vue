<script setup lang="ts">
import { ref } from "vue";

const health = ref("checking...");
fetch("/api/health")
  .then((r) => r.json())
  .then((j) => (health.value = JSON.stringify(j)))
  .catch(() => (health.value = "api unreachable"));
</script>

<template>
  <main>
    <h1>Multimodal RAG</h1>
    <p>API: {{ health }}</p>
    <!-- M4: SearchView, M5: LabelView, M7: EvalsView -->
  </main>
</template>
