<script setup>
import { useRouter } from 'vue-router';
import { seriesRoute } from '../utils/drama';
import CoverImage from './CoverImage.vue';

defineProps({
  dramas: { type: Array, default: () => [] },
  error: { type: String, default: '' },
});

const router = useRouter();

function goDetail(d) {
  router.push(seriesRoute(d));
}
</script>

<template>
  <div v-if="error" class="drama-load-hint drama-load-hint--err">{{ error }}</div>
  <div v-else-if="!dramas.length" class="drama-load-hint">No titles on this page.</div>
  <div v-else class="drama-grid" role="list">
    <button
      v-for="(d, i) in dramas"
      :key="`${d.source}-${d.video_id}`"
      type="button"
      class="drama-card"
      :style="{ '--delay': `${0.08 * i}s` }"
      role="listitem"
      @click="goDetail(d)"
    >
      <div class="drama-card__thumb">
        <CoverImage :src="d.image" :alt="d.title" />
        <span class="drama-card__ep">{{ d.episodes }} episodes</span>
      </div>
      <div class="drama-card__body">
        <span class="drama-card__source">{{ d.sourceLabel }}</span>
        <h3 class="drama-card__title">{{ d.title }}</h3>
        <span class="drama-card__cta">
          Details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  </div>
</template>
