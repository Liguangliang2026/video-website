<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { fetchDramaList, fetchEpisodeList } from '../api/drama';
import {
  coverStyle,
  episodeLabel,
  episodeTitle,
  extractEpisodeList,
  pickPlayUrl,
} from '../utils/drama';
import '../assets/detail.css';

const route = useRoute();
const loading = ref(true);
const error = ref('');
const title = ref('');
const meta = ref('');
const intro = ref('');
const logo = ref('');
const episodes = ref([]);

const videoId = computed(() => String(route.params.videoId ?? '').trim());
const validId = computed(() => /^\d+$/.test(videoId.value));

async function loadDetail(id) {
  loading.value = true;
  error.value = '';
  try {
    const [listJson, epJson] = await Promise.all([
      fetchDramaList({ video_id: id, page: 1, page_size: 1 }),
      fetchEpisodeList(id),
    ]);

    if (epJson.code !== 0) {
      throw new Error(epJson.msg || epJson.error || 'Could not load episodes');
    }

    const item =
      (listJson.code === 0 &&
        listJson.data &&
        Array.isArray(listJson.data.list) &&
        listJson.data.list[0]) ||
      null;

    title.value = item ? item.video_title || 'Untitled' : `Series ${id}`;
    const total = item?.video_total;
    meta.value =
      total != null && total !== ''
        ? `${total} episodes · ID ${id}`
        : `ID ${id}`;
    logo.value = item?.logo_img || '';
    intro.value = (item?.recommendation || item?.introduce || '').trim() || '—';
    episodes.value = extractEpisodeList(epJson);
  } catch (e) {
    error.value = e.message || 'Failed to load';
  } finally {
    loading.value = false;
  }
}

watch(
  videoId,
  (id) => {
    if (!validId.value) {
      loading.value = false;
      error.value = 'Missing or invalid video_id. Open this page from the home grid or banner.';
      return;
    }
    void loadDetail(id);
  },
  { immediate: true },
);
</script>

<template>
  <div class="page page--narrow">
    <div class="back-row">
      <RouterLink class="back-link" to="/">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to discover
      </RouterLink>
    </div>

    <div v-if="loading" class="hint">Loading series…</div>
    <div v-else-if="error" class="hint hint--err">{{ error }}</div>

    <template v-else>
      <div class="detail-hero">
        <div class="detail-hero__media" :style="coverStyle(logo)" />
        <div class="detail-hero__body">
          <h1 class="detail-hero__title">{{ title }}</h1>
          <p class="detail-hero__meta">{{ meta }}</p>
        </div>
      </div>
      <p class="detail-intro">{{ intro }}</p>
      <h2 class="section-title">Episodes</h2>
      <div v-if="!episodes.length" class="hint">No episode rows in the API response.</div>
      <div v-else class="ep-list" role="list">
        <component
          :is="pickPlayUrl(ep) ? 'a' : 'button'"
          v-for="(ep, idx) in episodes"
          :key="idx"
          class="ep-row"
          role="listitem"
          :href="pickPlayUrl(ep) || undefined"
          :target="pickPlayUrl(ep) ? '_blank' : undefined"
          :rel="pickPlayUrl(ep) ? 'noopener noreferrer' : undefined"
          :type="pickPlayUrl(ep) ? undefined : 'button'"
          :disabled="!pickPlayUrl(ep)"
        >
          <span class="ep-row__num">{{ episodeLabel(ep, idx) }}</span>
          <div>
            <p class="ep-row__title">{{ episodeTitle(ep, idx) }}</p>
          </div>
          <span class="ep-row__action">{{ pickPlayUrl(ep) ? 'Open' : 'No URL' }}</span>
        </component>
      </div>
    </template>
  </div>
</template>
