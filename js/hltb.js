const HLTB_API_URL = "/api/hltb-lookup.php";
const HLTB_CACHE_KEY = "hltb_cache_v3";
const HLTB_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

const pendingRequests = new Map();

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(HLTB_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(HLTB_CACHE_KEY, JSON.stringify(cache));
}

function isCacheValid(entry) {
  return entry && Date.now() - entry.fetchedAt < HLTB_CACHE_TTL;
}

async function fetchHLTBFromAPI(gameName) {
  const response = await fetch(HLTB_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: gameName }),
  });

  if (!response.ok) {
    throw new Error(`HLTB HTTP ${response.status}`);
  }

  return response.json();
}

const cache = loadCache();
export async function getHLTBData(gameName) {
  if (!gameName) return null;

  const cacheKey = gameName.toLowerCase();

  if (isCacheValid(cache[cacheKey])) {
    return cache[cacheKey].data;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

const requestPromise = fetchHLTBFromAPI(gameName)
  .then((data) => {
    if (data?.status === "ok") {
      cache[cacheKey] = {
        fetchedAt: Date.now(),
        data,
      };
      saveCache(cache);
    }
    return data;
  })
  .catch((err) => {
    console.error("HLTB error:", err);
    return { status: "error", reason: err.message };
  })
  .finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function preloadHLTB(games) {
  if (!Array.isArray(games)) return;

  const uniqueNames = [
    ...new Set(
      games
        .map((game) => game?.name)
        .filter(Boolean)
    ),
  ];

  for (const name of uniqueNames) {
    getHLTBData(name);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}
