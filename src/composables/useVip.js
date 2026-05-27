import { ref } from 'vue';
import { fetchMemberStatus, syncMemberAfterCheckout } from '../api/payment';

export const VIP_FROM_EPISODE = 10;
const VIP_STORAGE_KEY = 'watch_vip_member';

const vipModalOpen = ref(false);
const vipModalEpisode = ref(null);
const memberSynced = ref(false);

export function isMember() {
  try {
    return localStorage.getItem(VIP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMember(active = true) {
  try {
    if (active) localStorage.setItem(VIP_STORAGE_KEY, '1');
    else localStorage.removeItem(VIP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function syncMemberFromServer(userId, { tryAirwallexSync = false } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) {
    setMember(false);
    memberSynced.value = true;
    return false;
  }
  try {
    if (tryAirwallexSync) {
      const synced = await syncMemberAfterCheckout(uid);
      if (synced.code === 200 && synced.isMember) {
        setMember(true);
        memberSynced.value = true;
        return true;
      }
    }
    const res = await fetchMemberStatus(uid);
    const active = res.code === 200 && Boolean(res.isMember);
    setMember(active);
    memberSynced.value = true;
    return active;
  } catch {
    setMember(false);
    memberSynced.value = true;
    return false;
  }
}

export function clearMember() {
  setMember(false);
  memberSynced.value = false;
}

export function useVip() {

  function needsVipGate(totalEpisodes) {
    return totalEpisodes > VIP_FROM_EPISODE;
  }

  function isVipEpisode(episodeNum, totalEpisodes) {
    const n = Number(episodeNum);
    if (!Number.isFinite(n)) return false;
    return needsVipGate(totalEpisodes) && n >= VIP_FROM_EPISODE;
  }

  function canPlayEpisode(episodeNum, totalEpisodes) {
    return !isVipEpisode(episodeNum, totalEpisodes) || isMember();
  }

  function openVipModal(episodeNum) {
    vipModalEpisode.value = episodeNum;
    vipModalOpen.value = true;
  }

  function closeVipModal() {
    vipModalOpen.value = false;
    vipModalEpisode.value = null;
  }

  return {
    vipModalOpen,
    vipModalEpisode,
    memberSynced,
    isMember,
    setMember,
    syncMemberFromServer,
    clearMember,
    needsVipGate,
    isVipEpisode,
    canPlayEpisode,
    openVipModal,
    closeVipModal,
  };
}
