async function parseJson(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDramaList(params) {
  const q = new URLSearchParams(params);
  const res = await fetch(`/api/drama/list?${q.toString()}`);
  return parseJson(res);
}

export async function fetchEpisodeList(videoId) {
  const res = await fetch(
    `/api/drama/episode-list?video_id=${encodeURIComponent(videoId)}`,
  );
  return parseJson(res);
}

export async function loginWithGoogle(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  return res.json().catch(() => ({}));
}

