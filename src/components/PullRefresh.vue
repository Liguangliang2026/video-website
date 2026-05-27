<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
});

const emit = defineEmits(['refresh']);

const THRESHOLD = 72;
const MAX_PULL = 120;

const root = ref(null);
const pullY = ref(0);
let startY = 0;
let canPull = false;

const hintText = computed(() => {
  if (props.refreshing) return 'Refreshing…';
  if (pullY.value >= THRESHOLD) return 'Release to refresh';
  if (pullY.value > 12) return 'Pull to refresh';
  return '';
});

const showIndicator = computed(
  () => props.refreshing || pullY.value > 8,
);

function scrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function onTouchStart(e) {
  if (props.disabled || props.refreshing) return;
  if (scrollTop() > 4) {
    canPull = false;
    return;
  }
  canPull = true;
  startY = e.touches[0].clientY;
}

function onTouchMove(e) {
  if (!canPull || props.disabled || props.refreshing) return;
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0) {
    pullY.value = 0;
    return;
  }
  if (scrollTop() > 4) {
    canPull = false;
    pullY.value = 0;
    return;
  }
  pullY.value = Math.min(dy * 0.55, MAX_PULL);
  if (pullY.value > 8) e.preventDefault();
}

function onTouchEnd() {
  if (!canPull || props.disabled || props.refreshing) {
    resetPull();
    return;
  }
  if (pullY.value >= THRESHOLD) {
    emit('refresh');
  }
  resetPull();
}

function resetPull() {
  canPull = false;
  pullY.value = 0;
}

onMounted(() => {
  const el = root.value;
  if (!el) return;
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', onTouchEnd);
});

onUnmounted(() => {
  const el = root.value;
  if (!el) return;
  el.removeEventListener('touchstart', onTouchStart);
  el.removeEventListener('touchmove', onTouchMove);
  el.removeEventListener('touchend', onTouchEnd);
  el.removeEventListener('touchcancel', onTouchEnd);
});

defineExpose({
  trigger: () => {
    if (!props.disabled && !props.refreshing) emit('refresh');
  },
});
</script>

<template>
  <div ref="root" class="pull-refresh">
    <div
      class="pull-refresh__indicator"
      :class="{
        'is-visible': showIndicator,
        'is-ready': pullY >= THRESHOLD && !refreshing,
      }"
      :style="{ height: `${refreshing ? 44 : pullY}px` }"
    >
      <span
        v-if="showIndicator"
        class="pull-refresh__spinner"
        :class="{ 'is-spinning': refreshing }"
      />
      <span v-if="hintText" class="pull-refresh__hint">{{ hintText }}</span>
    </div>
    <slot />
  </div>
</template>
