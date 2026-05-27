<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
});

const emit = defineEmits(['load']);

const root = ref(null);
let observer = null;

function tryLoad() {
  if (props.loading || !props.hasMore) return;
  emit('load');
}

function setupObserver() {
  observer?.disconnect();
  if (!props.hasMore || !root.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return;
      tryLoad();
    },
    { root: null, rootMargin: '200px', threshold: 0.01 },
  );
  observer.observe(root.value);
}

watch(
  () => props.hasMore,
  () => {
    void nextTick(() => setupObserver());
  },
);

onMounted(() => {
  setupObserver();
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <div ref="root" class="load-more-sentinel">
    <p v-if="loading" class="load-more-sentinel__text">Loading…</p>
    <button
      v-else-if="hasMore"
      type="button"
      class="load-more-sentinel__btn"
      @click="tryLoad"
    >
      Load more
    </button>
    <p v-else class="load-more-sentinel__text load-more-sentinel__text--muted">
      No more titles
    </p>
  </div>
</template>

<style scoped>
.load-more-sentinel {
  padding: 20px 16px 32px;
  text-align: center;
  min-height: 56px;
}

.load-more-sentinel__text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--accent);
  font-weight: 600;
}

.load-more-sentinel__text--muted {
  color: var(--muted);
  font-weight: 500;
}

.load-more-sentinel__btn {
  margin: 0;
  padding: 10px 22px;
  border-radius: 999px;
  border: 1px solid rgba(255, 107, 53, 0.45);
  background: rgba(255, 107, 53, 0.12);
  color: var(--accent);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.load-more-sentinel__btn:hover {
  background: rgba(255, 107, 53, 0.2);
}
</style>
