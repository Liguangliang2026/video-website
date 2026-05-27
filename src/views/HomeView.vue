<script setup>
import { ref, onMounted } from 'vue';
import HeroCarousel from '../components/HeroCarousel.vue';
import DramaGrid from '../components/DramaGrid.vue';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PullRefresh from '../components/PullRefresh.vue';
import { fetchCatalogList } from '../api/catalog';
import { mapCatalogItem } from '../utils/drama';

defineOptions({ name: 'HomeView' });

const BANNER_SIZE = 5;
const LIST_PAGE_SIZE = 5;
const LIST_OFFSET = BANNER_SIZE;

const bannerDramas = ref([]);
const gridDramas = ref([]);
const gridPage = ref(1);
const gridPages = ref(1);
const gridTotal = ref(0);
const gridError = ref('');
const listLoading = ref(false);
const initialLoading = ref(true);
const refreshing = ref(false);

const bannerKeys = ref(new Set());
const hasMore = ref(false);

function itemKey(it) {
  return `${it.source}:${it.video_id}`;
}

function dedupeAppend(existing, incoming) {
  const keys = new Set(existing.map(itemKey));
  const out = [...existing];
  for (const it of incoming) {
    const k = itemKey(it);
    if (bannerKeys.value.has(k) || keys.has(k)) continue;
    keys.add(k);
    out.push(it);
  }
  return out;
}

async function loadBanner() {
  const res = await fetchCatalogList({ page: 1, page_size: BANNER_SIZE, offset: 0 });
  if (res.code !== 0) throw new Error(res.msg || 'Banner API error');
  const list = ((res.data && res.data.list) || []).map((it, i) => mapCatalogItem(it, i));
  bannerDramas.value = list.slice(0, BANNER_SIZE);
  bannerKeys.value = new Set(bannerDramas.value.map(itemKey));
  gridTotal.value = res.data?.total ?? 0;
}

async function loadListPage(page, append) {
  const res = await fetchCatalogList({
    page,
    page_size: LIST_PAGE_SIZE,
    offset: LIST_OFFSET,
  });
  if (res.code !== 0) throw new Error(res.msg || 'List API error');
  gridPage.value = res.data?.page ?? page;
  gridPages.value = res.data?.pages ?? 1;
  gridTotal.value = res.data?.total ?? gridTotal.value;
  const mapped = ((res.data && res.data.list) || []).map((it, i) =>
    mapCatalogItem(it, i + LIST_OFFSET + (page - 1) * LIST_PAGE_SIZE),
  );
  gridDramas.value = append ? dedupeAppend(gridDramas.value, mapped) : dedupeAppend([], mapped);
  hasMore.value = gridPage.value < gridPages.value;
  gridError.value = '';
}

async function loadAll({ showInitial = false } = {}) {
  if (showInitial) initialLoading.value = true;
  try {
    await loadBanner();
    await loadListPage(1, false);
  } catch (e) {
    bannerDramas.value = [];
    gridDramas.value = [];
    gridError.value = e.message || 'Failed to load';
    hasMore.value = false;
  } finally {
    if (showInitial) initialLoading.value = false;
  }
}

async function loadMore() {
  if (listLoading.value || !hasMore.value || refreshing.value) return;
  listLoading.value = true;
  try {
    await loadListPage(gridPage.value + 1, true);
  } catch (e) {
    gridError.value = e.message || 'Failed to load more';
  } finally {
    listLoading.value = false;
  }
}

async function onRefresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  gridPage.value = 1;
  try {
    await loadAll({ showInitial: false });
  } finally {
    refreshing.value = false;
  }
}

onMounted(() => {
  void loadAll({ showInitial: true });
});
</script>

<template>
  <div class="page">
    <HeroCarousel v-if="bannerDramas.length" :dramas="bannerDramas" />

    <div v-if="initialLoading" class="drama-load-hint">Loading…</div>
    <PullRefresh
      v-else
      :refreshing="refreshing"
      :disabled="initialLoading"
      @refresh="onRefresh"
    >
      <div class="section-head">
        <h2>All series</h2>
        <div class="section-head__actions">
          <span v-if="gridTotal" class="section-head__count">{{ gridTotal }} titles</span>
          <button
            type="button"
            class="section-head__refresh"
            :disabled="refreshing"
            aria-label="Refresh list"
            @click="onRefresh"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :class="{ 'is-spinning': refreshing }"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      <DramaGrid :dramas="gridDramas" :error="gridError" />
      <LoadMoreSentinel :loading="listLoading" :has-more="hasMore" @load="loadMore" />
    </PullRefresh>
  </div>
</template>
