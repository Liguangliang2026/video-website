<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { fetchCatalogEpisodes, fetchCatalogMeta } from '../api/catalog';
import XgVideoPlayer from '../components/XgVideoPlayer.vue';
import VipGateModal from '../components/VipGateModal.vue';
import { extractEpisodeList, resolveCoverUrl } from '../utils/drama';
import { normalizeEpisodes } from '../utils/episodes';
import {
  buildEpisodeRanges,
  rangeIndexForEpisode,
  EP_RANGE_SIZE,
} from '../utils/episodeRanges';
import { useVip } from '../composables/useVip';
import { useAccount } from '../composables/useAccount';
import '../assets/player.css';

const PLACEHOLDER_SYNOPSIS =
  'A chance encounter pulls them into a world of secrets and second chances. ' +
  'As old wounds reopen and new alliances form, every episode reveals another piece of the truth. ' +
  'Who can be trusted when the stakes are this high—and time is running out?';

const route = useRoute();
const { canPlayEpisode, isVipEpisode, openVipModal, needsVipGate, isMember } = useVip();

function showEpisodeVipBadge(epNum) {
  return isVipEpisode(epNum, totalEpisodes.value) && !isMember();
}
const { modalOpen: accountModalOpen } = useAccount();

const resumeAfterAccountModal = ref(false);

const loading = ref(true);
const error = ref('');
const title = ref('');
const meta = ref('');
const intro = ref('');
const logo = ref('');
const episodes = ref([]);
const activeIndex = ref(0);
const rangeIndex = ref(0);
const playerRef = ref(null);
const epStripMobileRef = ref(null);
const epStripRailRef = ref(null);
const synopsisTextRef = ref(null);
const synopsisExpanded = ref(false);
const showSynopsisToggle = ref(false);

const source = computed(() => String(route.params.source ?? '').trim().toLowerCase());
const seriesId = computed(() => String(route.params.id ?? '').trim());

const valid = computed(() => {
  if (source.value === 'r2') return /^[1-9]\d*$/.test(seriesId.value);
  if (source.value === 'drama') return /^\d+$/.test(seriesId.value);
  return false;
});

const totalEpisodes = computed(() => episodes.value.length);
const currentEp = computed(() => episodes.value[activeIndex.value] ?? null);
const currentUrl = computed(() => currentEp.value?.url ?? '');

const episodeRanges = computed(() => buildEpisodeRanges(episodes.value));
const showRangeTabs = computed(() => episodes.value.length > EP_RANGE_SIZE);

const visibleEpisodes = computed(() => {
  if (!showRangeTabs.value) return episodes.value;
  const range = episodeRanges.value[rangeIndex.value];
  if (!range) return episodes.value;
  return episodes.value.slice(range.from, range.to + 1);
});

const vipHint = computed(() =>
  needsVipGate(totalEpisodes.value) && !isMember()
    ? `Episodes 1–9 free · 10–${totalEpisodes.value} VIP`
    : '',
);

const watchStatus = computed(() => {
  if (!currentEp.value) return '';
  return `EP ${String(currentEp.value.num).padStart(2, '0')}`;
});

const synopsisText = computed(() => intro.value.trim() || PLACEHOLDER_SYNOPSIS);

async function updateSynopsisToggle() {
  await nextTick();
  const el = synopsisTextRef.value;
  if (!el) {
    showSynopsisToggle.value = false;
    return;
  }
  if (synopsisExpanded.value) return;
  showSynopsisToggle.value = el.scrollHeight > el.clientHeight + 1;
}

function toggleSynopsis() {
  synopsisExpanded.value = !synopsisExpanded.value;
  if (!synopsisExpanded.value) void updateSynopsisToggle();
}

async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const [metaJson, epJson] = await Promise.all([
      fetchCatalogMeta(source.value, seriesId.value),
      fetchCatalogEpisodes(source.value, seriesId.value),
    ]);

    if (metaJson.code !== 0) {
      throw new Error(metaJson.msg || metaJson.error || 'Could not load series');
    }
    if (epJson.code !== 0) {
      throw new Error(epJson.msg || epJson.error || 'Could not load episodes');
    }

    const m = metaJson.data || {};
    title.value = m.video_title || 'Untitled';
    const total = m.video_total ?? extractEpisodeList(epJson).length;
    meta.value =
      total != null && total !== '' ? `${total} episodes` : '';
    logo.value = resolveCoverUrl(
      { ...m, logo_img: m.logo_img || m.cover },
      source.value,
    );
    intro.value = (m.recommendation || m.introduce || m.tagline || '').trim() || '';
    episodes.value = normalizeEpisodes(extractEpisodeList(epJson));
    activeIndex.value = 0;
    rangeIndex.value = 0;

    if (!episodes.value.length) {
      throw new Error('No playable episodes');
    }
  } catch (e) {
    error.value = e.message || 'Failed to load';
  } finally {
    loading.value = false;
    synopsisExpanded.value = false;
    await updateSynopsisToggle();
  }
}

function selectRange(index) {
  rangeIndex.value = index;
  void nextTick(() => scrollActiveChipIntoView());
}

function selectEpisode(index) {
  const ep = episodes.value[index];
  if (!ep) return;
  if (!canPlayEpisode(ep.num, totalEpisodes.value)) {
    openVipModal(ep.num);
    return;
  }
  if (showRangeTabs.value) {
    rangeIndex.value = rangeIndexForEpisode(episodeRanges.value, index);
  }
  activeIndex.value = index;
  playerRef.value?.switchUrl(ep.url);
  void nextTick(() => scrollActiveChipIntoView());
}

function scrollActiveChipIntoView() {
  const localIdx = visibleEpisodes.value.findIndex((ep) => ep.index === activeIndex.value);
  if (localIdx < 0) return;
  for (const root of [epStripMobileRef.value, epStripRailRef.value]) {
    const chips = root?.querySelectorAll('.ep-chip, .watch-episode-card');
    chips?.[localIdx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function onEnded() {
  const next = activeIndex.value + 1;
  if (next >= episodes.value.length) return;
  const ep = episodes.value[next];
  if (!canPlayEpisode(ep.num, totalEpisodes.value)) {
    openVipModal(ep.num);
    return;
  }
  selectEpisode(next);
}

watch(activeIndex, (idx) => {
  if (!showRangeTabs.value) return;
  const r = rangeIndexForEpisode(episodeRanges.value, idx);
  if (r !== rangeIndex.value) rangeIndex.value = r;
});

watch(
  [source, seriesId],
  () => {
    if (!valid.value) {
      loading.value = false;
      error.value = 'Invalid series link.';
      return;
    }
    void loadDetail();
  },
  { immediate: true },
);

watch(synopsisText, () => {
  if (loading.value) return;
  synopsisExpanded.value = false;
  void updateSynopsisToggle();
});

watch(accountModalOpen, (open) => {
  const player = playerRef.value;
  if (!player) return;
  if (open) {
    resumeAfterAccountModal.value = player.isPlaying?.() ?? false;
    player.pause?.();
    return;
  }
  if (resumeAfterAccountModal.value) {
    resumeAfterAccountModal.value = false;
    player.play?.();
  }
});

function onSynopsisResize() {
  if (!synopsisExpanded.value) void updateSynopsisToggle();
}

onMounted(() => window.addEventListener('resize', onSynopsisResize));
onUnmounted(() => window.removeEventListener('resize', onSynopsisResize));
</script>

<template>
  <main class="watch-page">
    <header class="watch-topbar">
      <RouterLink class="watch-top-link" to="/" aria-label="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </RouterLink>
      <div v-if="watchStatus" class="watch-chip">
        <span class="watch-chip__dot" aria-hidden="true" />
        {{ watchStatus }}
      </div>
    </header>

    <div v-if="loading" class="watch-page__body">
      <div class="hint watch-hint">Loading…</div>
    </div>
    <div v-else-if="error" class="watch-page__body">
      <div class="hint hint--err watch-hint">{{ error }}</div>
    </div>

    <template v-else>
      <div class="watch-page__media">
        <section class="watch-stage" aria-label="Video player">
          <div class="watch-player-wrap">
            <XgVideoPlayer
              ref="playerRef"
              :key="`${source}-${seriesId}`"
              :url="currentUrl"
              @ended="onEnded"
            />
          </div>
        </section>
      </div>

      <div class="watch-page__body">
        <div class="watch-layout">
          <div class="watch-stage-stack">
            <header class="watch-player-panel">
              <h1 class="watch-player-title">{{ title }}</h1>
              <p class="watch-player-meta">
                <span v-if="meta" class="watch-player-pill">{{ meta }}</span>
                <span v-if="vipHint" class="watch-player-pill">{{ vipHint }}</span>
              </p>
            </header>

            <section class="watch-episodes-mobile" aria-label="Episodes">
              <div class="ep-strip-head">
                <h2>Episodes</h2>
                <span v-if="currentEp">Now playing · Ep {{ currentEp.num }}</span>
              </div>

              <div
                v-if="showRangeTabs"
                class="range-tabs"
                role="tablist"
                aria-label="Episode ranges"
              >
                <button
                  v-for="(range, i) in episodeRanges"
                  :key="range.label"
                  type="button"
                  class="range-tab"
                  :class="{ 'is-on': i === rangeIndex }"
                  role="tab"
                  :aria-selected="i === rangeIndex"
                  @click="selectRange(i)"
                >
                  {{ range.label }}
                </button>
              </div>

              <div ref="epStripMobileRef" class="ep-strip" role="list">
                <button
                  v-for="ep in visibleEpisodes"
                  :key="ep.index"
                  type="button"
                  class="ep-chip"
                  :class="{
                    'is-active': ep.index === activeIndex,
                    'is-vip': showEpisodeVipBadge(ep.num),
                  }"
                  role="listitem"
                  :aria-label="`Episode ${ep.num}`"
                  @click="selectEpisode(ep.index)"
                >
                  <span v-if="showEpisodeVipBadge(ep.num)" class="ep-chip__vip">VIP</span>
                  <span class="ep-chip__num">{{ ep.num }}</span>
                </button>
              </div>
            </section>

            <section class="detail-synopsis" aria-label="Synopsis">
              <h2 class="detail-synopsis__title">Synopsis</h2>
              <div class="detail-synopsis__card">
                <p
                  ref="synopsisTextRef"
                  class="detail-synopsis__text"
                  :class="{ 'is-clamped': !synopsisExpanded }"
                >
                  {{ synopsisText }}
                </p>
                <button
                  v-if="showSynopsisToggle"
                  type="button"
                  class="detail-synopsis__toggle"
                  :aria-expanded="synopsisExpanded"
                  @click="toggleSynopsis"
                >
                  {{ synopsisExpanded ? 'Show less' : 'See more' }}
                </button>
              </div>
            </section>
          </div>

          <aside class="watch-rail-panel" aria-label="Episode list">
            <h2 class="watch-rail-head">Episodes</h2>

            <div
              v-if="showRangeTabs"
              class="range-tabs"
              role="tablist"
              aria-label="Episode ranges"
            >
              <button
                v-for="(range, i) in episodeRanges"
                :key="`rail-${range.label}`"
                type="button"
                class="range-tab"
                :class="{ 'is-on': i === rangeIndex }"
                role="tab"
                :aria-selected="i === rangeIndex"
                @click="selectRange(i)"
              >
                {{ range.label }}
              </button>
            </div>

            <div ref="epStripRailRef" class="watch-episode-rail" role="list">
              <button
                v-for="ep in visibleEpisodes"
                :key="`rail-${ep.index}`"
                type="button"
                class="watch-episode-card"
                :class="{
                  'is-active': ep.index === activeIndex,
                  'is-vip': showEpisodeVipBadge(ep.num),
                }"
                role="listitem"
                :aria-label="`Episode ${ep.num}`"
                @click="selectEpisode(ep.index)"
              >
                <span v-if="showEpisodeVipBadge(ep.num)" class="ep-chip__vip">VIP</span>
                <span class="watch-episode-card__number">{{ ep.num }}</span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </template>

    <VipGateModal />
  </main>
</template>
