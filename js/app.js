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

function describeCondition(probability, hour) {
  const h = typeof hour === "number" ? hour : new Date(hour).getHours();
  const night = h < 6 || h >= 18;
  if (probability >= 80) return "Chuvoso";
  if (probability >= 60) return "Nublado";
  if (probability >= 20)
    return night ? "Parcialmente nublado" : "Parcialmente nublado";
  return night ? "Céu limpo" : "Limpo";
}

function iconFor(probability, hour) {
  const h = typeof hour === "number" ? hour : new Date(hour).getHours();
  const night = h < 6 || h >= 18;
  if (probability >= 80) return img("rain-2.svg");
  if (probability >= 60)
    return night ? img("moon-clouds.svg") : img("sun-clouds.svg");
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m&hourly=temperature_2m,precipitation_probability,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_sum,sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
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
  const updated = new Date(current.time).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const condLabel = describeCondition(currentProb, current.time);
  const delta = round(current.apparent_temperature - current.temperature_2m);
  const sens =
    delta === 0
      ? "igual à temperatura"
      : delta > 0
      ? `+${delta}° mais quente`
      : `${delta}° mais fria`;
  chanceTextEl.textContent = `Chance de chuva: ${prob(
    currentProb
  )} • Atualizado às ${updated} • ${condLabel} • Sensação: ${sens}`;
  currentTempEl.textContent = temp(current.temperature_2m);
  currentIconEl.src = iconFor(currentProb, current.time);
  apparentTempEl.textContent = temp(current.apparent_temperature);
  chanceDetailEl.textContent = prob(currentProb);
  const wind = round(current.wind_speed_10m);
  windSpeedEl.innerHTML = wind < 1 ? `Calmo` : `${wind} <span>km/h</span>`;
}

function renderHourly(weather) {
  const hourly = weather.hourly;
  hourlyContainer.innerHTML = "";
  hourlyContainer.setAttribute("role", "list");
  const now = new Date();
  const items = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);
    if (t >= now) items.push(i);
    if (items.length === 6) break;
  }
  let maxProbNext = 0;
  items.forEach((idx) => {
    const t = new Date(hourly.time[idx]);
    const diffMs = Math.abs(t.getTime() - now.getTime());
    const timeStr =
      diffMs < 60 * 60 * 1000
        ? "Agora"
        : t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const p = hourly.precipitation_probability[idx] ?? 0;
    if (p > maxProbNext) maxProbNext = p;
    const item = document.createElement("div");
    item.className = "hour-weather-item";
    item.setAttribute("role", "listitem");
    const timeEl = document.createElement("p");
    timeEl.textContent = timeStr;
    const iconEl = document.createElement("img");
    iconEl.src = iconFor(p, hourly.time[idx]);
    iconEl.alt = "Condição";
    iconEl.loading = "lazy";
    iconEl.decoding = "async";
    iconEl.width = 50;
    iconEl.height = 50;
    iconEl.onerror = () => {
      iconEl.src = img("sun-clouds.svg");
    };
    const tempEl = document.createElement("p");
    tempEl.textContent = temp(hourly.temperature_2m[idx]);
    const rh = hourly.relative_humidity_2m
      ? hourly.relative_humidity_2m[idx]
      : null;
    item.title = rh != null ? `Umidade ${round(rh)}%` : `Umidade —`;
    item.appendChild(timeEl);
    item.appendChild(iconEl);
    item.appendChild(tempEl);
    hourlyContainer.appendChild(item);
  });
  const nextSummary =
    maxProbNext === 0
      ? "sem chuva prevista"
      : maxProbNext < 20
      ? "baixa probabilidade"
      : maxProbNext < 60
      ? "possibilidade moderada"
      : "alta chance de chuva";
  chanceTextEl.textContent = `${chanceTextEl.textContent} • Próximas horas: ${nextSummary}`;
}

function renderWeekly(weather) {
  const daily = weather.daily;
  weeklyContainer.innerHTML = "";
  const spark = document.createElement("div");
  spark.className = "sparkline";
  weeklyContainer.appendChild(spark);
  const maxes = [];
  for (let i = 0; i < daily.time.length && i < 7; i++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day-weather-item";
    const nameEl = document.createElement("p");
    nameEl.textContent = weekdayName(daily.time[i]);
    const iconEl = document.createElement("img");
    const probApprox = computeDailyProbability(weather, i);
    iconEl.src = iconFor(probApprox, 12);
    iconEl.alt = "Condição";
    iconEl.width = 60;
    iconEl.height = 60;
    iconEl.loading = "lazy";
    iconEl.decoding = "async";
    iconEl.onerror = () => {
      iconEl.src = img("sun-clouds.svg");
    };
    const tempsEl = document.createElement("div");
    const maxEl = document.createElement("p");
    maxEl.textContent = temp(daily.temperature_2m_max[i]);
    const minEl = document.createElement("p");
    minEl.textContent = temp(daily.temperature_2m_min[i]);
    const badge = document.createElement("span");
    badge.className = "prob-badge";
    badge.textContent = `${probApprox}%`;
    tempsEl.appendChild(maxEl);
    tempsEl.appendChild(minEl);
    dayEl.appendChild(nameEl);
    dayEl.appendChild(iconEl);
    dayEl.appendChild(tempsEl);
    dayEl.appendChild(badge);
    const detail = document.createElement("div");
    detail.className = "day-detail";
    const uv = Array.isArray(daily.uv_index_max) ? daily.uv_index_max[i] : null;
    const pSum = Array.isArray(daily.precipitation_sum)
      ? daily.precipitation_sum[i]
      : 0;
    const apMax = Array.isArray(daily.apparent_temperature_max)
      ? daily.apparent_temperature_max[i]
      : null;
    const apMin = Array.isArray(daily.apparent_temperature_min)
      ? daily.apparent_temperature_min[i]
      : null;
    const apMean =
      apMax != null && apMin != null ? round((apMax + apMin) / 2) : null;
    const sr = Array.isArray(daily.sunrise) ? daily.sunrise[i] : null;
    const ss = Array.isArray(daily.sunset) ? daily.sunset[i] : null;
    const srStr = sr
      ? new Date(sr).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const ssStr = ss
      ? new Date(ss).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    detail.style.display = "none";
    detail.innerHTML = `
      <div class="row"><span>Chuva</span><strong>${round(
        pSum
      )} mm</strong></div>
      <div class="row"><span>UV</span><strong>${
        uv != null ? round(uv) : "-"
      }</strong></div>
      <div class="row"><span>Sensação</span><strong>${
        apMean != null ? `${apMean}°` : "-"
      }</strong></div>
      <div class="row"><span>Nascer</span><strong>${srStr}</strong></div>
      <div class="row"><span>Pôr</span><strong>${ssStr}</strong></div>
    `;
    dayEl.appendChild(detail);
    dayEl.addEventListener("click", () => {
      const open = dayEl.classList.toggle("open");
      detail.style.display = open ? "grid" : "none";
    });
    weeklyContainer.appendChild(dayEl);
    maxes.push(daily.temperature_2m_max[i]);
  }
  if (
    Array.isArray(weather.daily.uv_index_max) &&
    weather.daily.uv_index_max.length > 0
  ) {
    uvIndexEl.textContent = `${round(weather.daily.uv_index_max[0])}`;
  }
  highlightExtremes();
  renderSparkline(spark, maxes);
}

function computeDailyProbability(weather, dayIndex) {
  const day = new Date(weather.daily.time[dayIndex]);
  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  const hourly = weather.hourly;
  let maxProb = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);
    const k = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
    if (k === key) {
      const p = hourly.precipitation_probability[i] ?? 0;
      if (p > maxProb) maxProb = p;
    }
  }
  return round(maxProb);
}

function highlightExtremes() {
  const items = [...weeklyContainer.querySelectorAll(".day-weather-item")];
  const values = items.map((el) => {
    const maxText = el.querySelector("div > p:first-child").textContent;
    return parseInt(maxText);
  });
  let maxIdx = 0;
  let minIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxIdx]) maxIdx = i;
    if (values[i] < values[minIdx]) minIdx = i;
  }
  items[maxIdx]?.classList.add("hot-day");
  items[minIdx]?.classList.add("cold-day");
}

function renderSparkline(container, values) {
  if (!values || values.length === 0) return;
  const w = container.clientWidth || 600;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xStep = w / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
    const x = i * xStep;
    return `${x},${y}`;
  });
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${points.join(
        " "
      )}" fill="none" stroke="#23aaff" stroke-width="2"/>
    </svg>
  `;
  container.innerHTML = svg;
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
