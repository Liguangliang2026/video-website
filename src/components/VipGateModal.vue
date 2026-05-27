<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useVip } from '../composables/useVip';

const route = useRoute();
const { vipModalOpen, vipModalEpisode, closeVipModal } = useVip();

const vipLink = computed(() => ({
  path: '/vip',
  query: { from: route.fullPath },
}));
</script>

<template>
  <div v-if="vipModalOpen" class="vip-gate" role="dialog" aria-modal="true">
    <div class="vip-gate__backdrop" @click="closeVipModal" />
    <div class="vip-gate__panel">
      <h3>VIP episodes</h3>
      <p v-if="vipModalEpisode">
        Episode {{ vipModalEpisode }} and later are for VIP members.
      </p>
      <p v-else>Episodes 10 and later are for VIP members.</p>
      <p class="vip-gate__renew">Subscribe from $0.01 · first $9.9 charge on Sunday · cancel anytime.</p>
      <div class="vip-gate__actions">
        <RouterLink class="vip-gate__primary" :to="vipLink" @click="closeVipModal">
          Subscribe
        </RouterLink>
        <button type="button" class="vip-gate__ghost" @click="closeVipModal">Not now</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vip-gate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.vip-gate__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 6, 10, 0.82);
  backdrop-filter: blur(6px);
}

.vip-gate__panel {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 22px 20px;
  border-radius: 18px;
  background: rgba(14, 14, 22, 0.98);
  border: 1px solid var(--stroke);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.vip-gate__panel h3 {
  margin: 0 0 10px;
  font-family: "Syne", sans-serif;
  font-size: 1.2rem;
}

.vip-gate__panel p {
  margin: 0 0 10px;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.92rem;
}

.vip-gate__renew {
  margin: 0 0 18px !important;
  font-size: 0.8rem !important;
  color: rgba(245, 249, 255, 0.45) !important;
}

.vip-gate__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vip-gate__primary {
  display: block;
  text-align: center;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.vip-gate__ghost {
  padding: 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}
</style>
