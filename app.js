// Dota 2 Last Pick — отдельный браузерный помощник.
// Не взаимодействует с игрой и не изменяет её файлы.

const API = "https://api.opendota.com/api";
const CDN = "https://cdn.cloudflare.steamstatic.com";

const $ = (id) => document.getElementById(id);

const el = {
  status: $("status"),
  roles: $("roles"),
  allies: $("allies"),
  enemies: $("enemies"),
  allyPicker: $("allyPicker"),
  enemyPicker: $("enemyPicker"),
  clearAllies: $("clearAllies"),
  clearEnemies: $("clearEnemies"),
  recalculate: $("recalculate"),
  results: $("results"),
  resultHint: $("resultHint")
};

const roleOptions = [
  "Carry",
  "Mid",
  "Offlane",
  "Soft Support",
  "Hard Support"
];

const state = {
  heroes: [],
  role: "Carry",
  allies: [],
  enemies: [],
  matchupCache: new Map()
};

function setStatus(message, error = false) {
  el.status.textContent = message;
  el.status.style.color = error ? "#ef8b83" : "";
}

function imageUrl(hero) {
  return hero.img ? CDN + hero.img : "";
}

function safe(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Ошибка сервера: HTTP " + response.status);
  }
  return response.json();
}

function renderRoles() {
  el.roles.innerHTML = roleOptions.map(role => `
    <button class="role ${state.role === role ? "active" : ""}"
            type="button" data-role="${role}">
      ${role}
    </button>
  `).join("");

  el.roles.querySelectorAll("[data-role]").forEach(button => {
    button.addEventListener("click", () => {
      state.role = button.dataset.role;
      renderRoles();
      showPlaceholder();
    });
  });
}

function renderSlots(type) {
  const list = type === "ally" ? state.allies : state.enemies;
  const container = type === "ally" ? el.allies : el.enemies;

  container.innerHTML = Array.from({ length: 4 }, (_, index) => {
    const hero = list[index];

    if (!hero) {
      return `
        <button class="slot" type="button" data-add="${type}">
          <span class="plus">+</span>
        </button>
      `;
    }

    return `
      <div class="slot">
        <img src="${imageUrl(hero)}" alt="${safe(hero.localized_name)}">
        <button class="remove" type="button"
                data-remove="${type}" data-index="${index}">×</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => openPicker(type));
  });

  container.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      list.splice(Number(button.dataset.index), 1);
      renderSlots(type);
      showPlaceholder();
    });
  });
}

function renderPicker(type, search) {
  const picker = type === "ally" ? el.allyPicker : el.enemyPicker;

  // Запоминаем, был ли курсор в поисковой строке и где он находился.
  const oldInput = picker.querySelector(".search");
  const wasFocused = oldInput === document.activeElement;
  const cursorPosition = oldInput ? oldInput.selectionStart : search.length;

  const selectedIds = new Set([
    ...state.allies.map(hero => hero.id),
    ...state.enemies.map(hero => hero.id)
  ]);

  const filtered = state.heroes.filter(hero => {
    const matches = hero.localized_name
      .toLowerCase()
      .includes(search.toLowerCase());

    return matches && !selectedIds.has(hero.id);
  });

  picker.innerHTML = `
    <div class="picker-top">
      <input class="search" type="search"
             placeholder="Поиск героя..."
             value="${safe(search)}">
      <button class="ghost" type="button" data-close>Закрыть</button>
    </div>

    <div class="hero-grid">
      ${filtered.map(hero => `
        <button class="hero-btn" type="button"
                data-hero-id="${hero.id}">
          <img src="${imageUrl(hero)}" alt="">
          <span>${safe(hero.localized_name)}</span>
        </button>
      `).join("")}
    </div>
  `;

  const input = picker.querySelector(".search");

  input.addEventListener("input", () => {
    renderPicker(type, input.value);
  });

  // Возвращаем фокус и курсор в поисковую строку.
  if (wasFocused) {
    input.focus();
    const position = Math.min(cursorPosition, input.value.length);
    input.setSelectionRange(position, position);
  }

  picker.querySelector("[data-close]").addEventListener("click", () => {
    picker.classList.add("hidden");
  });

  picker.querySelectorAll("[data-hero-id]").forEach(button => {
    button.addEventListener("click", () => {
      const hero = state.heroes.find(
        item => item.id === Number(button.dataset.heroId)
      );

      const list = type === "ally" ? state.allies : state.enemies;

      if (hero && list.length < 4) {
        list.push(hero);
      }

      picker.classList.add("hidden");
      renderSlots(type);
      showPlaceholder();
    });
  });
}

function showPlaceholder() {
  el.results.classList.add("empty");
  el.results.innerHTML = `
    <div class="empty-icon">⚔</div>
    <div>Нажми «Рассчитать», чтобы получить топ-5</div>
  `;

  el.resultHint.textContent = state.enemies.length
    ? `Выбрано врагов: ${state.enemies.length}. Твоя роль: ${state.role}.`
    : "Выбери хотя бы одного врага.";
}

function roleScore(hero) {
  const tags = hero.roles || [];

  const wanted = {
    "Carry": ["Carry"],
    "Mid": ["Carry", "Nuker", "Escape"],
    "Offlane": ["Initiator", "Durable", "Disabler"],
    "Soft Support": ["Support", "Disabler", "Initiator"],
    "Hard Support": ["Support", "Disabler"]
  }[state.role];

  const matches = wanted.filter(tag => tags.includes(tag)).length;
  return matches / wanted.length;
}

async function getMatchups(enemyId) {
  if (!state.matchupCache.has(enemyId)) {
    const request = getJson(
      `${API}/heroes/${enemyId}/matchups`
    );

    state.matchupCache.set(enemyId, request);
  }

  return state.matchupCache.get(enemyId);
}

async function calculate() {
  if (!state.enemies.length) {
    setStatus("Сначала выбери хотя бы одного врага.", true);
    return;
  }

  el.recalculate.disabled = true;
  setStatus("Загружаю статистику матчапов...");

  el.results.classList.remove("empty");
  el.results.innerHTML = "<p>Подбираю лучших героев...</p>";

  try {
    const matchupLists = await Promise.all(
      state.enemies.map(enemy => getMatchups(enemy.id))
    );

    const excluded = new Set([
      ...state.allies.map(hero => hero.id),
      ...state.enemies.map(hero => hero.id)
    ]);

    const candidates = state.heroes.filter(
      hero => !excluded.has(hero.id)
    );

    const results = candidates.map(hero => {
      let totalWinRate = 0;
      let games = 0;

      matchupLists.forEach(rows => {
        const row = rows.find(item => item.hero_id === hero.id);

        if (row && row.games_played > 0) {
          const candidateWinRate =
            1 - row.wins / row.games_played;

          totalWinRate += candidateWinRate;
          games++;
        }
      });

      const matchup = games
        ? totalWinRate / games
        : 0.5;

      const role = roleScore(hero);

      const meta = hero.pro_pick > 0
        ? Math.min(1, Math.log1p(hero.pro_pick) / Math.log1p(50000))
        : 0.5;

      const synergy = state.allies.length
        ? Math.min(
            1,
            (hero.roles || []).filter(tag =>
              state.allies.some(ally =>
                (ally.roles || []).includes(tag)
              )
            ).length / 3
          )
        : 0.5;

      const score =
        matchup * 0.62 +
        role * 0.20 +
        meta * 0.10 +
        synergy * 0.08;

      return {
        hero,
        score,
        matchup,
        role,
        games
      };
    });

    results.sort((a, b) => b.score - a.score);

    renderResults(results.slice(0, 5));
    setStatus("Готово! Герои подобраны.");
  } catch (error) {
    console.error("Ошибка расчёта:", error);
    setStatus("Не удалось загрузить матчапы.", true);

    el.results.classList.add("empty");
    el.results.innerHTML = `
      <div class="empty-icon">⚠</div>
      <div>Ошибка загрузки статистики OpenDota.</div>
      <div class="breakdown">${safe(error.message)}</div>
    `;
  } finally {
    el.recalculate.disabled = false;
  }
}

function renderResults(results) {
  el.results.classList.remove("empty");
  el.resultHint.textContent =
    "Пять лучших вариантов по доступной статистике и выбранной роли.";

  el.results.innerHTML = results.map((item, index) => `
    <article class="result-card ${index === 0 ? "best" : ""}">
      <img src="${imageUrl(item.hero)}"
           alt="${safe(item.hero.localized_name)}">

      <div>
        <div class="rank">Место #${index + 1}</div>
        <div class="name">${safe(item.hero.localized_name)}</div>

        <div class="tags">
          ${(item.hero.roles || []).slice(0, 4).map(tag => `
            <span class="tag">${safe(tag)}</span>
          `).join("")}
        </div>

        <div class="breakdown">
          Контрпик: ${Math.round(item.matchup * 100)}%
          · Роль: ${Math.round(item.role * 100)}%
          · Матчапов: ${item.games}
        </div>
      </div>

      <div class="score">
        <strong>${Math.round(item.score * 100)}</strong>
        <small>из 100</small>
      </div>
    </article>
  `).join("");
}

async function init() {
  renderRoles();
  renderSlots("ally");
  renderSlots("enemy");
  showPlaceholder();

  try {
    setStatus("Загружаю героев...");

    const heroes = await getJson(`${API}/heroStats`);

    state.heroes = heroes
      .filter(hero =>
        hero.id &&
        hero.localized_name &&
        hero.img
      )
      .sort((a, b) =>
        a.localized_name.localeCompare(b.localized_name)
      );

    if (!state.heroes.length) {
      throw new Error("Список героев пуст.");
    }

    renderSlots("ally");
    renderSlots("enemy");

    setStatus(`Герои загружены: ${state.heroes.length}`);
  } catch (error) {
    console.error("Ошибка загрузки героев:", error);
    setStatus("Не удалось загрузить героев.", true);

    el.results.classList.add("empty");
    el.results.innerHTML = `
      <div class="empty-icon">⚠</div>
      <div>Не получилось загрузить героев из OpenDota.</div>
      <div class="breakdown">${safe(error.message)}</div>
    `;
  }
}

el.clearAllies.addEventListener("click", () => {
  state.allies = [];
  renderSlots("ally");
  showPlaceholder();
});

el.clearEnemies.addEventListener("click", () => {
  state.enemies = [];
  renderSlots("enemy");
  showPlaceholder();
});

el.recalculate.addEventListener("click", calculate);

init();
