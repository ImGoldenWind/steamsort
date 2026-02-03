import { getHLTBData, preloadHLTB } from "./hltb.js";

const loginBtn = document.querySelector(".steam-login");
const userBox = document.querySelector(".user-box");
const userName = document.querySelector(".user-name");
const userAvatar = document.querySelector(".user-avatar");
const logoutBtn = document.querySelector(".logout-btn");
const contentEl = document.querySelector(".content");
const helpIcon = document.querySelector(".help-icon");
const helpContent = document.querySelector(".help-content");

let baseGames = [];
let mergedGames = [];

let sortState = {
  column: null,
  direction: 1,
};

let hideEmptyGames = false;

let hltbCache = {};

let friendsList = [];
let selectedFriends = [];

const MAX_FRIENDS = 6;
const FAMILY_CACHE_KEY = "steam_family_games_cache";
const HLTB_CACHE_KEY = "hltb_cache_v3";

function showToast(message, type = "info") {
  const colors = {
    info: "#3b82f6",
    warning: "#f59e0b",
    error: "#ef4444",
    success: "#22c55e",
  };

  Toastify({
    text: message,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    close: true,
    backgroundColor: colors[type] || colors.info,
    stopOnFocus: true,
  }).showToast();
}

loginBtn.addEventListener("click", () => {
  window.location.href = "/api/steam-login.php";
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout.php");
  localStorage.removeItem(FAMILY_CACHE_KEY);
  window.location.reload();
});

async function initAuth() {
  try {
    const sessionResp = await fetch("/api/session.php");
    const session = await sessionResp.json();

    if (!session.authenticated) {
      showEmptyStateNotLogged();
      return;
    }

    const userResp = await fetch("/api/steam-user.php");
    const user = await userResp.json();

    loginBtn.classList.add("hidden");
    userBox.classList.remove("hidden");

    userName.textContent = user.name;
    userAvatar.src = user.avatar;
    userAvatar.alt = user.name;

    try {
      hltbCache = JSON.parse(localStorage.getItem(HLTB_CACHE_KEY)) || {};
    } catch {
      hltbCache = {};
    }

    loadGames();
  } catch {
    showErrorState();
  }
}

let userDropdownOpen = false;

userBox.addEventListener("click", (e) => {
  e.stopPropagation();

  userDropdownOpen = !userDropdownOpen;

  const dropdown = userBox.querySelector(".user-dropdown");
  dropdown.style.display = userDropdownOpen ? "block" : "none";
});

document.addEventListener("click", () => {
  const dropdown = userBox.querySelector(".user-dropdown");
  dropdown.style.display = "none";
  userDropdownOpen = false;
});

if (helpIcon && helpContent) {
  helpIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    helpContent.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    helpContent.classList.remove("open");
  });
}

function showLoader() {
  contentEl.innerHTML = `<div class="loader">Загрузка библиотеки…</div>`;
}

function showEmptyStateNotLogged() {
  contentEl.innerHTML = `<div class="empty">Войдите через Steam</div>`;
}

function showEmptyStateNoGames() {
  contentEl.innerHTML = `<div class="empty">Игры не найдены</div>`;
}

function showErrorState() {
  contentEl.innerHTML = `<div class="empty">Ошибка загрузки библиотеки</div>`;
}

function renderSourceCell(game) {
  if (game.source === "owned") {
    return `
      <img
        src="${userAvatar.src}"
        class="source-avatar"
        title="${userName.textContent}"
      />
    `;
  }

  return game.owners
    .map((name) => {
      const friend = friendsList.find((f) => f.name === name);
      if (!friend) return "";
      return `
        <img
          src="${friend.avatar}"
          class="source-avatar"
          title="${friend.name}"
        />
      `;
    })
    .join("");
}

function renderHLTBCells(game) {
  if (!game.name) {
    return `
      <td>—</td>
      <td>—</td>
      <td>—</td>
    `;
  }

  return `
    <td class="hltb-main" data-name="${game.name}">…</td>
    <td class="hltb-extra" data-name="${game.name}">…</td>
    <td class="hltb-complete" data-name="${game.name}">…</td>
  `;
}

function renderGamesTable(games) {
  if (!games.length) {
    showEmptyStateNoGames();
    return;
  }

  contentEl.innerHTML = `
    <table class="games-table">
      <thead>
        <tr>
          <th data-sort="name">Игра</th>
          <th>Источник</th>
          <th data-sort="main">Основная игра</th>
          <th data-sort="extra">Основная + сайды</th>
          <th data-sort="complete">100%</th>
        </tr>
      </thead>
      <tbody>
        ${games
          .map(
            (g) => `
          <tr>
            <td>${g.name ?? `AppID ${g.appid}`}</td>
            <td class="source-cell">${renderSourceCell(g)}</td>
            ${renderHLTBCells(g)}
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  attachSortHandlers();
  loadHLTBForVisibleGames();
}

function renderMobileGames(games) {
  if (!isMobileView()) return;

  contentEl.innerHTML = `
    <div class="games-mobile">
      ${games
        .map(
          (g) => `
        <div class="game-card">
          <div class="game-title">${g.name ?? `AppID ${g.appid}`}</div>
          <div class="game-times">
            <div>
              <strong class="hltb-main" data-name="${g.name}">…</strong>
              <span>Main</span>
            </div>
            <div>
              <strong class="hltb-extra" data-name="${g.name}">…</strong>
              <span>Extra</span>
            </div>
            <div>
              <strong class="hltb-complete" data-name="${g.name}">…</strong>
              <span>100%</span>
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  loadHLTBForVisibleGames();
}

function isMobileView() {
  return window.matchMedia("(max-width: 768px)").matches;
}

async function runWithConcurrencyLimit(tasks, limit = 10) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(task);
    results.push(p);

    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

async function loadHLTBForVisibleGames() {
  const names = [
    ...new Set(
      [...document.querySelectorAll("[data-name]")]
        .map((el) => el.dataset.name)
        .filter(Boolean)
    ),
  ];

  const results = await runWithConcurrencyLimit(
    names.map((name) => async () => {
      const data = await getHLTBData(name);
      return { name, data };
    }),
    10
  );

  for (const { name, data } of results) {
    const mainEls = document.querySelectorAll(
      `.hltb-main[data-name="${name}"]`
    );
    const extraEls = document.querySelectorAll(
      `.hltb-extra[data-name="${name}"]`
    );
    const completeEls = document.querySelectorAll(
      `.hltb-complete[data-name="${name}"]`
    );

    if (!data || data.status !== "ok") {
      mainEls.forEach((e) => (e.textContent = "—"));
      extraEls.forEach((e) => (e.textContent = "—"));
      completeEls.forEach((e) => (e.textContent = "—"));
      continue;
    }

    hltbCache[name.toLowerCase()] = { data };
    localStorage.setItem(HLTB_CACHE_KEY, JSON.stringify(hltbCache));

    mainEls.forEach((e) => (e.textContent = `${data.main}ч`));
    extraEls.forEach((e) => (e.textContent = `${data.mainExtra}ч`));
    completeEls.forEach((e) => (e.textContent = `${data.completionist}ч`));
  }
}

async function loadGames() {
  showLoader();

  try {
    const resp = await fetch("/api/steam-games.php");
    const data = await resp.json();

    if (!data.success || !Array.isArray(data.games)) {
      showErrorState();
      return;
    }

    baseGames = data.games.map((g) => ({
      appid: g.appid,
      name: g.name,
      source: "owned",
    }));

    mergedGames = [...baseGames];

    restoreFamilyCache();

    const filtered = getFilteredGames();
    renderGamesTable(filtered);
    renderMobileGames(filtered);
    renderFamilySharingControls();

    preloadHLTB(mergedGames);
  } catch {
    showErrorState();
  }
}

async function loadSteamFriends() {
  try {
    const resp = await fetch("/api/steam-friends.php");
    const data = await resp.json();
    return data.success && Array.isArray(data.friends) ? data.friends : [];
  } catch {
    showToast("Ошибка загрузки друзей", "error");
    return [];
  }
}

async function loadFriendGames(steamid) {
  try {
    const resp = await fetch(`/api/steam-games.php?steamid=${steamid}`);
    const data = await resp.json();
    return data.success && Array.isArray(data.games) ? data.games : [];
  } catch {
    return [];
  }
}

function buildMergedGames(baseGames, friends, friendsGamesMap) {
  const map = new Map();

  baseGames.forEach((g) => {
    map.set(g.appid, { ...g });
  });

  friends.forEach((friend) => {
    const games = friendsGamesMap[friend.steamid] || [];

    games.forEach((game) => {
      if (map.has(game.appid)) return;

      map.set(game.appid, {
        appid: game.appid,
        name: game.name,
        source: "family",
        owners: [friend.name],
      });
    });
  });

  return Array.from(map.values());
}

function saveFamilyCache() {
  localStorage.setItem(
    FAMILY_CACHE_KEY,
    JSON.stringify({
      friends: selectedFriends,
      games: mergedGames,
      timestamp: Date.now(),
    })
  );
}

function restoreFamilyCache() {
  const raw = localStorage.getItem(FAMILY_CACHE_KEY);
  if (!raw) return;

  try {
    const cache = JSON.parse(raw);
    if (Array.isArray(cache.friends) && Array.isArray(cache.games)) {
      selectedFriends = cache.friends;
      mergedGames = cache.games;
    }
  } catch {}
}

async function renderFamilySharingControls() {
  const controls = document.querySelector(".controls");
  if (!controls || controls.querySelector(".family-sharing")) return;

  const block = document.createElement("div");
  block.className = "family-sharing";
  block.innerHTML = `
    <div class="family-description">
      Выберите друзей, чьи библиотеки могут быть доступны через Family Sharing.
      Если библиотека друга скрыта, то его игры отобразить не выйдет.
    </div>

    <div class="family-controls">
      <div class="family-picker">
        <input class="family-search" placeholder="Поиск друга…" disabled />
        <div class="family-dropdown hidden"></div>
      </div>
      <button class="family-apply" title="Обновить список">↺</button>
    </div>

    <div class="family-selected"></div>
  `;

  const filterBlock = document.createElement("div");
  filterBlock.className = "hltb-filter";
  filterBlock.innerHTML = `
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="hide-empty-hltb" />
      Скрывать игры без времени
    </label>
  `;

  const selectedEl = block.querySelector(".family-selected");
  selectedEl.insertAdjacentElement("afterend", filterBlock);

  controls.appendChild(block);

  const search = block.querySelector(".family-search");
  const dropdown = block.querySelector(".family-dropdown");
  const selectedContainer = block.querySelector(".family-selected");
  const applyBtn = block.querySelector(".family-apply");
  const checkbox = filterBlock.querySelector("#hide-empty-hltb");

  checkbox.onchange = () => {
    hideEmptyGames = checkbox.checked;
    renderGamesTable(getFilteredGames());
  };

  friendsList = await loadSteamFriends();

  if (!friendsList.length) {
    search.placeholder = "Друзья не найдены";
    return;
  }

  if (selectedFriends.length > 0) {
    selectedFriends = selectedFriends.filter((sf) =>
      friendsList.some((f) => f.steamid === sf.steamid)
    );
    renderSelectedFriends(selectedContainer);
  }

  search.disabled = false;

  function renderDropdown(list) {
    dropdown.innerHTML = list
      .map(
        (f) => `
      <div class="friend-option ${
        selectedFriends.some((s) => s.steamid === f.steamid) ? "selected" : ""
      }" data-id="${f.steamid}">
        <img src="${f.avatar}" />
        <span>${f.name}</span>
      </div>
    `
      )
      .join("");
  }

  renderDropdown(friendsList);

  search.addEventListener("focus", () => {
    dropdown.classList.remove("hidden");
  });

  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    renderDropdown(friendsList.filter((f) => f.name.toLowerCase().includes(q)));
  });

  dropdown.addEventListener("click", (e) => {
    const el = e.target.closest(".friend-option");
    if (!el) return;

    if (selectedFriends.length >= MAX_FRIENDS) {
      showToast("Можно выбрать не более 4 друзей", "warning");
      return;
    }

    const friend = friendsList.find((f) => f.steamid === el.dataset.id);
    if (!friend || selectedFriends.some((f) => f.steamid === friend.steamid)) {
      showToast("Этот друг уже выбран", "info");
      return;
    }

    selectedFriends.push(friend);
    renderSelectedFriends(selectedContainer);
    renderDropdown(friendsList);
    search.value = "";
  });

  applyBtn.addEventListener("click", async () => {
    if (selectedFriends.length === 0) {
      mergedGames = [...baseGames];
      localStorage.removeItem(FAMILY_CACHE_KEY);
      renderGamesTable(getFilteredGames());
      showToast("Семейные игры удалены", "info");
      return;
    }

    showToast("Загружаем игры друзей…", "info");

    const friendsGamesMap = Object.fromEntries(
      await Promise.all(
        selectedFriends.map(async (friend) => [
          friend.steamid,
          await loadFriendGames(friend.steamid),
        ])
      )
    );

    mergedGames = buildMergedGames(baseGames, selectedFriends, friendsGamesMap);

    saveFamilyCache();
    renderGamesTable(getFilteredGames());
    preloadHLTB(mergedGames);
    showToast("Семейные игры обновлены", "success");
  });

  document.addEventListener("click", (e) => {
    if (!block.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });
}

function renderSelectedFriends(container) {
  container.innerHTML = selectedFriends
    .map(
      (f) => `
    <span class="friend-badge">
      ${f.name}
      <button data-id="${f.steamid}">×</button>
    </span>
  `
    )
    .join("");

  container.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      selectedFriends = selectedFriends.filter(
        (f) => f.steamid !== btn.dataset.id
      );

      if (selectedFriends.length === 0) {
        mergedGames = [...baseGames];
        localStorage.removeItem(FAMILY_CACHE_KEY);
        renderGamesTable(getFilteredGames());
        showToast("Семейные игры удалены", "info");
      }

      renderSelectedFriends(container);
    };
  });
}

function attachSortHandlers() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.style.cursor = "pointer";

    th.onclick = () => {
      const key = th.dataset.sort;

      if (sortState.column === key) {
        sortState.direction *= -1;
      } else {
        sortState.column = key;
        sortState.direction = 1;
      }

      sortGames();
      renderGamesTable(getFilteredGames());
    };
  });
}

function sortGames() {
  const { column, direction } = sortState;

  mergedGames.sort((a, b) => {
    if (column === "name") {
      return (a.name || "").localeCompare(b.name || "") * direction;
    }

    return (getHLTBValue(a, column) - getHLTBValue(b, column)) * direction;
  });
}

function getHLTBValue(game, type) {
  const cacheKey = game.name?.toLowerCase();
  const data = hltbCache[cacheKey]?.data;

  if (!data || data.status !== "ok") return Infinity;

  if (type === "main") return data.main ?? Infinity;
  if (type === "extra") return data.mainExtra ?? Infinity;
  if (type === "complete") return data.completionist ?? Infinity;

  return Infinity;
}

function getFilteredGames() {
  if (!hideEmptyGames) {
    return mergedGames;
  }

  return mergedGames.filter((game) => {
    const key = game.name?.toLowerCase();
    const data = hltbCache[key]?.data;

    if (!data || data.status !== "ok") return false;

    return (
      (data.main ?? 0) > 0 ||
      (data.mainExtra ?? 0) > 0 ||
      (data.completionist ?? 0) > 0
    );
  });
}

initAuth();
