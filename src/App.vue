<script setup>
import { computed, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppOrbs from './components/AppOrbs.vue';
import AccountModal from './components/AccountModal.vue';
import { useAccount } from './composables/useAccount';
const route = useRoute();
const showOrbs = computed(
  () =>
    route.name !== 'series-detail'
    && route.name !== 'vip'
    && route.name !== 'legal-subscription',
);

const { syncAvatar, isSignedIn, userId, afterSignIn } = useAccount();

onMounted(() => {
  syncAvatar();
  if (isSignedIn.value && userId.value) {
    void afterSignIn();
  }
});
</script>

<template>
  <AppOrbs v-if="showOrbs" />
  <AccountModal />
  <RouterView v-slot="{ Component, route }">
    <KeepAlive include="HomeView">
      <component :is="Component" v-if="route.meta.keepAlive" :key="route.name" />
    </KeepAlive>
    <component
      :is="Component"
      v-if="!route.meta.keepAlive"
      :key="route.fullPath"
    />
  </RouterView>
</template>
