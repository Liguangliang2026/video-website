<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { seriesRoute } from '../utils/drama';
import CoverImage from './CoverImage.vue';

const props = defineProps({
  dramas: { type: Array, default: () => [] },
});

const router = useRouter();
const AUTO_MS = 6000;
const index = ref(0);
const progressRef = ref(null);
let timer = null;
let touchX = null;

const slides = computed(() =>
  props.dramas.length
    ? props.dramas
    : [
        {
          source: 'drama',
          video_id: 0,
          title: 'No series',
          tagline: 'Check /api/catalog/list',
          episodes: 0,
          image: '',
          tint: 'linear-gradient(135deg, #ff6b35, #7c5cff)',
        },
      ],
);

function goDetail(item) {
  if (!item?.video_id) return;
  router.push(
    seriesRoute({
      source: item.source || 'drama',
      video_id: item.video_id,
    }),
  );
}

function resetProgress() {
  const el = progressRef.value;
  if (!el) return;
  el.classList.remove('is-ticking');
  void el.offsetWidth;
  el.style.setProperty('--tick-duration', `${AUTO_MS / 1000}s`);
  el.classList.add('is-ticking');
}

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  clearTimer();
  if (slides.value.length < 2) return;
  resetProgress();
  const n = slides.value.length;
  timer = setInterval(() => setSlide((index.value + 1) % n, false), AUTO_MS);
}

function setSlide(i, userIntent) {
  const n = slides.value.length;
  index.value = ((i % n) + n) % n;
  if (userIntent) startTimer();
  else resetProgress();
}

function onVisibility() {
  if (document.hidden) clearTimer();
  else startTimer();
}

watch(
  () => props.dramas,
  () => {
    index.value = 0;
    if (props.dramas.length > 1) startTimer();
    else clearTimer();
  },
  { deep: true },
);

onMounted(() => {
  if (props.dramas.length > 1) startTimer();
  document.addEventListener('visibilitychange', onVisibility);
});

onUnmounted(() => {
  clearTimer();
  document.removeEventListener('visibilitychange', onVisibility);
});

function onTouchStart(e) {
  touchX = e.changedTouches[0].screenX;
}

function onTouchEnd(e) {
  if (touchX == null) return;
  const dx = e.changedTouches[0].screenX - touchX;
  touchX = null;
  if (Math.abs(dx) < 48) return;
  if (dx < 0) setSlide(index.value + 1, true);
  else setSlide(index.value - 1, true);
  startTimer();
}
</script>

<template>
  <header class="hero" role="region" aria-roledescription="carousel" aria-label="Featured dramas">
    <div class="hero__slides" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <article
        v-for="(d, i) in slides"
        :key="d.video_id ?? i"
        class="hero-slide"
        :class="{
          'is-active': i === index,
          'hero-slide--clickable': !!d.video_id,
        }"
        :aria-hidden="i !== index"
        :style="{ '--slide-tint': d.tint }"
        @click="goDetail(d)"
      >
        <div class="hero-slide__media">
          <CoverImage :src="d.image" :alt="d.title" />
        </div>
        <div class="hero-slide__shade" />
        <div class="hero-slide__accent" />
        <div class="hero-slide__content">
          <span class="hero-slide__tag">Spotlight</span>
          <h3 class="hero-slide__title">{{ d.title }}</h3>
          <p class="hero-slide__meta">{{ d.episodes }} episodes</p>
        </div>
      </article>
    </div>
    <div class="hero__shine" aria-hidden="true" />
    <div class="hero__progress" aria-hidden="true">
      <div ref="progressRef" class="hero__progress-bar" />
    </div>
    <div class="hero__controls">
      <button
        type="button"
        class="hero__nav"
        aria-label="Previous slide"
        @click="setSlide(index - 1, true); startTimer()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="hero__dots" role="tablist" aria-label="Slides">
        <button
          v-for="(d, i) in slides"
          :key="'dot-' + (d.video_id ?? i)"
          type="button"
          class="hero__dot"
          :class="{ 'is-active': i === index }"
          role="tab"
          :aria-selected="i === index"
          :aria-label="`Show ${d.title}`"
          @click="setSlide(i, true)"
        />
      </div>
      <button
        type="button"
        class="hero__nav"
        aria-label="Next slide"
        @click="setSlide(index + 1, true); startTimer()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.hero-slide--clickable {
  cursor: pointer;
}
</style>
