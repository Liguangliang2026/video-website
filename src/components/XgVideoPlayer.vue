<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Player from 'xgplayer';
import MobilePreset from 'xgplayer/es/presets/mobile';
import 'xgplayer/dist/index.min.css';
import '../assets/xgplayer-skin.css';

const props = defineProps({
  url: { type: String, default: '' },
});

const emit = defineEmits(['ended']);

const containerId = `xg-${Math.random().toString(36).slice(2, 10)}`;
const rootRef = ref(null);
let player = null;
let resizeObserver = null;

function destroyPlayer() {
  if (player) {
    try {
      player.destroy();
    } catch {
      /* ignore */
    }
    player = null;
  }
}

/** xgplayer resize() may set inline height taller than the box and clip vertical video */
function stabilizeLayout() {
  if (!player?.root) return;
  try {
    player.resize();
  } catch {
    /* ignore */
  }
  player.root.style.width = '100%';
  player.root.style.height = '100%';
  player.root.style.maxHeight = '100%';
}

function createPlayer() {
  if (!props.url || !rootRef.value) return;
  destroyPlayer();
  const el = document.createElement('div');
  el.id = containerId;
  rootRef.value.innerHTML = '';
  rootRef.value.appendChild(el);

  player = new Player({
    id: containerId,
    url: props.url,
    poster: false,
    width: '100%',
    height: '100%',
    fluid: false,
    fitVideoSize: 'fixWidth',
    videoFillMode: 'cover',
    lang: 'en',
    playsinline: true,
    videoInit: true,
    presets: [MobilePreset],
    closeControlsBlur: false,
    closeFocusVideoFocus: false,
    inactive: 2800,
    playbackRate: [0.75, 1, 1.25, 1.5, 2],
    marginControls: false,
    commonStyle: {
      playedColor: '#ff6b35',
      progressColor: 'rgba(255, 255, 255, 0.28)',
      volumeColor: '#ff6b35',
    },
    videoAttributes: {
      playsinline: 'true',
      'webkit-playsinline': 'true',
      'x5-playsinline': 'true',
    },
  });

  player.on('ended', () => emit('ended'));
  player.on('loadedmetadata', () => stabilizeLayout());
  player.on('canplay', () => stabilizeLayout());
  player.on('video_resize', () => stabilizeLayout());

  requestAnimationFrame(() => stabilizeLayout());
}

function switchUrl(url) {
  if (!player || !url) return;
  const p = player.switchURL(url);
  const after = () => {
    stabilizeLayout();
    void player.play().catch(() => {});
  };
  if (p && typeof p.then === 'function') {
    void p.then(after).catch(() => {});
  } else {
    after();
  }
}

function play() {
  void player?.play()?.catch(() => {});
}

function pause() {
  try {
    player?.pause();
  } catch {
    /* ignore */
  }
}

function isPlaying() {
  if (!player) return false;
  return player.paused === false;
}

function resize() {
  stabilizeLayout();
}

watch(
  () => props.url,
  (url) => {
    if (!url) return;
    if (player) switchUrl(url);
    else createPlayer();
  },
);

onMounted(() => {
  createPlayer();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  window.removeEventListener('orientationchange', resize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  destroyPlayer();
});

defineExpose({ switchUrl, play, pause, isPlaying, resize });
</script>

<template>
  <div ref="rootRef" class="xg-video-player" />
</template>

<style scoped>
.xg-video-player {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #0a0a0a;
  border-radius: inherit;
  overflow: hidden;
}
</style>
