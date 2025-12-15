const cityInput = document.getElementById("city");
const cityNameEl = document.getElementById("city-name");
const chanceTextEl = document.getElementById("chance-text");
const currentTempEl = document.getElementById("current-temp");
const currentIconEl = document.getElementById("current-icon");
const hourlyContainer = document.getElementById("hourly-forecast");
const apparentTempEl = document.getElementById("apparent-temp");
const chanceDetailEl = document.getElementById("chance-detail");
const windSpeedEl = document.getElementById("wind-speed");
const uvIndexEl = document.getElementById("uv-index");
const weeklyContainer = document.getElementById("weekly-forecast");
const autocompleteEl = document.getElementById("autocomplete");
const STORAGE_KEY = "weather_app_city";

const img = (name) => `images/${name}`;
const round = (n) => Math.round(n);
const temp = (n) => `${round(n)}°`;
const prob = (n) => `${round(n)}%`;

function iconFor(probability, hour) {
  const h = typeof hour === "number" ? hour : new Date(hour).getHours();
  const night = h < 6 || h >= 18;
  if (probability >= 80) return img("rain-2.svg");
  if (probability >= 60) return img("clouds.svg");
  if (probability >= 20)
    return night ? img("moon-clouds.svg") : img("sun-clouds.svg");
  return night ? img("moon-clouds.svg") : img("sun.svg");
}

function weekdayName(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=1&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar localização");
  const data = await res.json();
  if (!data.results || data.results.length === 0)
    throw new Error("Cidade não encontrada");
  const r = data.results[0];
  return { latitude: r.latitude, longitude: r.longitude, name: r.name };
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum&timezone=auto&windspeed_unit=kmh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar clima");
  return res.json();
}

function renderCurrent(name, weather) {
  const current = weather.current;
  const hourly = weather.hourly;
  const nowIndex = hourly.time.findIndex(
    (t) => new Date(t) >= new Date(current.time)
  );
  const currentProb =
    nowIndex >= 0 && Array.isArray(hourly.precipitation_probability)
      ? hourly.precipitation_probability[nowIndex]
      : 0;
  cityNameEl.textContent = name;
  chanceTextEl.textContent = `Chance de chuva ${prob(currentProb)}`;
  currentTempEl.textContent = temp(current.temperature_2m);
  currentIconEl.src = iconFor(currentProb, current.time);
  apparentTempEl.textContent = temp(current.apparent_temperature);
  chanceDetailEl.textContent = prob(currentProb);
  windSpeedEl.innerHTML = `${round(current.wind_speed_10m)} <span>km/h</span>`;
}

function renderHourly(weather) {
  const hourly = weather.hourly;
  hourlyContainer.innerHTML = "";
  const now = new Date();
  const items = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);
    if (t >= now) items.push(i);
    if (items.length === 6) break;
  }
  items.forEach((idx) => {
    const timeStr = new Date(hourly.time[idx]).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const p = hourly.precipitation_probability[idx] ?? 0;
    const item = document.createElement("div");
    item.className = "hour-weather-item";
    const timeEl = document.createElement("p");
    timeEl.textContent = timeStr;
    const iconEl = document.createElement("img");
    iconEl.src = iconFor(p, hourly.time[idx]);
    iconEl.alt = "Condição";
    const tempEl = document.createElement("p");
    tempEl.textContent = temp(hourly.temperature_2m[idx]);
    item.appendChild(timeEl);
    item.appendChild(iconEl);
    item.appendChild(tempEl);
    hourlyContainer.appendChild(item);
  });
}

function renderWeekly(weather) {
  const daily = weather.daily;
  weeklyContainer.innerHTML = "";
  for (let i = 0; i < daily.time.length && i < 7; i++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day-weather-item";
    const nameEl = document.createElement("p");
    nameEl.textContent = weekdayName(daily.time[i]);
    const iconEl = document.createElement("img");
    const p =
      daily.precipitation_sum && daily.precipitation_sum[i]
        ? daily.precipitation_sum[i]
        : 0;
    const probApprox = p >= 10 ? 80 : p >= 3 ? 60 : p >= 1 ? 30 : 0;
    iconEl.src = iconFor(probApprox, 12);
    iconEl.alt = "Condição";
    const tempsEl = document.createElement("div");
    const maxEl = document.createElement("p");
    maxEl.textContent = temp(daily.temperature_2m_max[i]);
    const minEl = document.createElement("p");
    minEl.textContent = temp(daily.temperature_2m_min[i]);
    tempsEl.appendChild(maxEl);
    tempsEl.appendChild(minEl);
    dayEl.appendChild(nameEl);
    dayEl.appendChild(iconEl);
    dayEl.appendChild(tempsEl);
    weeklyContainer.appendChild(dayEl);
  }
  if (
    Array.isArray(weather.daily.uv_index_max) &&
    weather.daily.uv_index_max.length > 0
  ) {
    uvIndexEl.textContent = `${round(weather.daily.uv_index_max[0])}`;
  }
}

async function searchAndRender(name) {
  try {
    document.body.setAttribute("aria-busy", "true");
    const place = await geocodeCity(name);
    const weather = await fetchWeather(place.latitude, place.longitude);
    renderCurrent(place.name, weather);
    renderHourly(weather);
    renderWeekly(weather);
  } catch (e) {
    alert(e.message || "Erro inesperado");
  } finally {
    document.body.removeAttribute("aria-busy");
  }
}

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = cityInput.value.trim();
    if (q.length > 0) searchAndRender(q);
  }
});

function getSavedCity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.latitude || !obj.longitude || !obj.name) return null;
    return obj;
  } catch {
    return null;
  }
}

function saveCity(place) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        admin1: place.admin1 || null,
        country_code: place.country_code || null,
      })
    );
  } catch {}
}

const brStates = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

function parseQuery(q) {
  const m = q.match(/-\s*([A-Za-z]{2})$/);
  if (!m) return { name: q.trim(), state: null };
  const abbr = m[1].toUpperCase();
  const state = brStates[abbr] || null;
  const name = q.slice(0, q.indexOf(m[0])).trim();
  return { name, state, abbr };
}

const cache = new Map();
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function geocodeSuggest(q) {
  const key = `s:${q}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=10&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data.results) ? data.results : [];
  cache.set(key, list);
  return list;
}

function renderSuggestions(items) {
  if (!items || items.length === 0) {
    autocompleteEl.innerHTML = `<div class="autocomplete-item"><span class="label">Nenhuma cidade encontrada</span></div>`;
    autocompleteEl.style.display = "block";
    cityInput.setAttribute("aria-expanded", "true");
    return;
  }
  autocompleteEl.innerHTML = "";
  items.forEach((it, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "autocomplete-item";
    btn.setAttribute("role", "option");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = it.name;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${it.admin1 || ""} ${
      it.country_code ? `• ${it.country_code}` : ""
    }`.trim();
    btn.appendChild(label);
    btn.appendChild(meta);
    btn.addEventListener("click", () => {
      autocompleteEl.style.display = "none";
      cityInput.setAttribute("aria-expanded", "false");
      const place = {
        latitude: it.latitude,
        longitude: it.longitude,
        name: it.name,
        admin1: it.admin1,
        country_code: it.country_code,
      };
      saveCity(place);
      renderByPlace(place);
      cityInput.value = `${it.name}${it.admin1 ? ` - ${it.admin1}` : ""}`;
    });
    autocompleteEl.appendChild(btn);
  });
  autocompleteEl.style.display = "block";
  cityInput.setAttribute("aria-expanded", "true");
}

async function renderByPlace(place) {
  try {
    document.body.setAttribute("aria-busy", "true");
    const weather = await fetchWeather(place.latitude, place.longitude);
    renderCurrent(place.name, weather);
    renderHourly(weather);
    renderWeekly(weather);
  } catch (e) {
    alert(e.message || "Erro inesperado");
  } finally {
    document.body.removeAttribute("aria-busy");
  }
}

const doSuggest = debounce(async () => {
  const q = cityInput.value.trim();
  if (q.length < 2) {
    autocompleteEl.style.display = "none";
    cityInput.setAttribute("aria-expanded", "false");
    return;
  }
  const parsed = parseQuery(q);
  let items = await geocodeSuggest(parsed.name);
  if (parsed.state) {
    items = items.filter(
      (it) =>
        it.country_code === "BR" &&
        (it.admin1 || "").toLowerCase().includes(parsed.state.toLowerCase())
    );
    if (items.length === 0) {
      items = (await geocodeSuggest(q.replace(/-/g, " "))) || [];
    }
  }
  renderSuggestions(items.slice(0, 8));
}, 250);

cityInput.addEventListener("input", doSuggest);

let activeIndex = -1;
cityInput.addEventListener("keydown", (e) => {
  const items = [...autocompleteEl.querySelectorAll(".autocomplete-item")];
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
  } else if (e.key === "Enter") {
    const q = cityInput.value.trim();
    if (items.length && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
      activeIndex = -1;
    } else if (q.length > 0) {
      const parsed = parseQuery(q);
      geocodeSuggest(parsed.name).then((list) => {
        let sel = list;
        if (parsed.state) {
          sel = list.filter(
            (it) =>
              it.country_code === "BR" &&
              (it.admin1 || "")
                .toLowerCase()
                .includes(parsed.state.toLowerCase())
          );
        }
        if (sel && sel.length > 0) {
          const p = {
            latitude: sel[0].latitude,
            longitude: sel[0].longitude,
            name: sel[0].name,
            admin1: sel[0].admin1,
            country_code: sel[0].country_code,
          };
          saveCity(p);
          renderByPlace(p);
        } else {
          searchAndRender(parsed.name)
            .then(() => {})
            .catch(() => {});
        }
      });
    }
  } else if (e.key === "Escape") {
    autocompleteEl.style.display = "none";
    cityInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }
});

function init() {
  const saved = getSavedCity();
  if (saved) {
    cityInput.value = `${saved.name}${
      saved.admin1 ? ` - ${saved.admin1}` : ""
    }`;
    renderByPlace(saved);
    return;
  }
  geocodeCity("São Paulo")
    .then((place) => {
      saveCity(place);
      cityInput.value = `${place.name}${
        place.admin1 ? ` - ${place.admin1}` : ""
      }`;
      renderByPlace(place);
    })
    .catch(() => {
      searchAndRender("São Paulo");
    });
}

init();
