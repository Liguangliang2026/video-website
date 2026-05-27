<script setup>
defineProps({
  page: { type: Number, required: true },
  pages: { type: Number, required: true },
  total: { type: Number, required: true },
  loading: { type: Boolean, default: false },
});

defineEmits(['prev', 'next']);
</script>

<template>
  <div v-if="pages > 1" class="drama-pager">
    <div class="drama-pager__info">Page {{ page }} of {{ pages }} · {{ total }} titles</div>
    <button type="button" class="drama-pager__btn" :disabled="loading || page <= 1" @click="$emit('prev')">
      Previous
    </button>
    <button type="button" class="drama-pager__btn" :disabled="loading || page >= pages" @click="$emit('next')">
      Next
    </button>
  </div>
</template>
