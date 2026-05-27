async function parseJson(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCatalogList(params) {
  const q = new URLSearchParams(params);
  const res = await fetch(`/api/catalog/list?${q.toString()}`);
  return parseJson(res);
}

export async function fetchCatalogMeta(source, id) {
  const q = new URLSearchParams({ source, id });
  const res = await fetch(`/api/catalog/meta?${q.toString()}`);
  return parseJson(res);
}

export async function fetchCatalogEpisodes(source, id) {
  const q = new URLSearchParams({ source, id });
  const res = await fetch(`/api/catalog/episodes?${q.toString()}`);
  return parseJson(res);
}
