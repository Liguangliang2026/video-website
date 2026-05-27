<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
});

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div class="cover-image">
    <img
      v-if="src && !failed"
      class="cover-image__img"
      :src="src"
      :alt="alt"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
  </div>
</template>

<style scoped>
.cover-image {
  position: absolute;
  inset: 0;
}

.cover-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
