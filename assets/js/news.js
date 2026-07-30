/**
 * TINVEST • Live Signals & News engine
 *
 * ТОЛЬКО РЕАЛЬНЫЕ ОНЛАЙН-ДАННЫЕ. Никаких симуляторов, захардкоженных
 * лент и демо-сценариев:
 *  - Новости: живые RSS-ленты (Бизнес ФМ, РБК, ТАСС, Интерфакс, Коммерсантъ,
 *    CoinTelegraph) с автообновлением. CORS обходится через цепочку публичных
 *    прокси, кодировки (UTF-8 / windows-1251) определяются автоматически.
 *  - Рынки предсказаний: публичный Polymarket Gamma API (gamma-api.polymarket.com).
 *  - Сигналы строятся из совпадений ключевых тем в РЕАЛЬНЫХ заголовках +
 *    живые котировки MOEX/Binance, которые параллельно обновляет app.js.
 */
(function() {
  const D = window.TINVEST_DATA || {};
  const MARKET = D.MARKET || [];

  /* ============================ Config ============================ */

  const NEWS_SOURCES = [
    { id: 'bfm',        label: 'Бизнес ФМ',     url: 'https://www.bfm.ru/news.rss',                       cat: 'macro'    },
    { id: 'rbc',        label: 'РБК',           url: 'https://rssexport.rbc.ru/rbcnews/news/20/full.rss', cat: 'macro'    },
    { id: 'interfax',   label: 'Интерфакс',     url: 'https://www.interfax.ru/rss.asp',                    cat: 'macro'    },
    { id: 'tass',       label: 'ТАСС',          url: 'https://tass.ru/rss/v2.xml',                         cat: 'politics' },
    { id: 'kommersant', label: 'Коммерсантъ',   url: 'https://www.kommersant.ru/RSS/news.xml',             cat: 'politics' },
    { id: 'ct',         label: 'CoinTelegraph', url: 'https://ru.cointelegraph.com/rss',                   cat: 'crypto'   },
  ];

  // Polymarket Gamma API — публичный, без ключа.
  const POLY_ENDPOINTS = [
    'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=30&order=volume24hr&ascending=false',
    'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=30&order=volume&ascending=false',
  ];

  // CORS-прокси. Перебираются по очереди, пока один не сработает.
  const PROXY_CHAIN = [
    { name: 'direct',     wrap: u => u },
    { name: 'allorigins', wrap: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) },
    { name: 'codetabs',   wrap: u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u) },
    { name: 'corsfix',    wrap: u => 'https://proxy.corsfix.com/?' + encodeURIComponent(u) },
    { name: 'x2u',        wrap: u => 'https://cors.x2u.in/' + u },
  ];

  const NEWS_REFRESH_MS  = 3 * 60 * 1000;  // новости — каждые 3 минуты
  const POLY_REFRESH_MS  = 90 * 1000;      // Polymarket — каждые 90 секунд
  const MAX_NEWS_ITEMS   = 48;
  const CACHE_KEY        = 'tinvest_live_v1';

  // Тематические правила: ключевые слова (RU+EN) -> инструменты из рынка.
  const TOPIC_RULES = [
    { id: 'rate',      label: 'Ключевая ставка / ЦБ', tickers: ['LQDT', 'SU29014', 'SBER'],
      kw: ['ключев', 'ставк', 'цб рф', 'центробан', 'центральн', 'инфляц', 'депозит', 'вклад',
           'key rate', 'rate cut', 'rate hike', 'interest rate', 'cbr', 'central bank', 'процентн'] },
    { id: 'oil',       label: 'Нефть и энергетика',   tickers: ['LKOH', 'ROSN', 'TATN'],
      kw: ['нефт', 'brent', 'oil', 'opec', 'опек', 'баррел', 'crude', 'бензин', 'wti', 'экспорт газа'] },
    { id: 'gas',       label: 'Газ',                  tickers: ['GAZP', 'NVTK'],
      kw: ['газпром', 'спг', 'lng', 'новатэк', 'novatek', 'газопровод', 'северный поток'] },
    { id: 'gold',      label: 'Золото',               tickers: ['PLZL', 'GLDRUB'],
      kw: ['золот', 'gold', 'драгмет', 'bullion', 'драгоценн', 'полюс'] },
    { id: 'crypto',    label: 'Криптовалюты',         tickers: ['BTC', 'ETH', 'SOL'],
      kw: ['биткоин', 'bitcoin', 'btc', 'крипт', 'crypto', 'ethereum', 'эфириум', 'solana',
           'стейблкоин', 'stablecoin', 'халвинг', 'halving', 'blockchain', 'блокчейн'] },
    { id: 'banks',     label: 'Банковский сектор',    tickers: ['SBER', 'TCSG'],
      kw: ['сбер', 'sber', 'втб', 'vtb', 'тинькофф', 'т-банк', 't-bank', 'банк россии пониж', 'ипотечн', 'ипотек'] },
    { id: 'fx',        label: 'Валюта и рубль',       tickers: ['GLDRUB', 'PLZL', 'BTC'],
      kw: ['рубл', 'доллар', 'валют', 'юань', 'девальв', 'dollar', 'ruble', 'usd', 'курс'] },
    { id: 'geopol',    label: 'Геополитика',          tickers: ['PLZL', 'GLDRUB', 'BTC'],
      kw: ['санкц', 'sanction', 'тариф', 'tariff', 'переговор', 'геополит', 'geopol', 'трамп', 'trump',
           'путин', 'putin', 'украин', 'ukraine', 'russia', 'китай', 'china'] },
    { id: 'russia_eq', label: 'Рынок акций РФ',       tickers: ['TDIV', 'TMOS', 'SBER', 'YDEX'],
      kw: ['мосбирж', 'moex', 'imoex', 'ртс', 'дивиденд', 'dividend', 'фондов', 'фонд росси', 'акци', 'tdiv'] },
    { id: 'dividends', label: 'Дивиденды и купоны РФ', tickers: ['TDIV', 'SBER', 'LKOH', 'TATN'],
      kw: ['дивиденд', 'dividend', 'tdiv', 'выплат', 'отсечк', 'реестр', 'дивидендная доходность', 'т-капитал', 'бпиф', 'купон'] },
    { id: 'tech',      label: 'Технологии / IT',      tickers: ['YDEX', 'MTSS'],
      kw: ['яндекс', 'yandex', 'озон', 'ozon', 'искусствен', 'nvidia', 'технолог', 're:\\b(ai|ии|вк|vk)\\b'] },
    { id: 'metals',    label: 'Металлы',              tickers: ['GMKN'],
      kw: ['никель', 'nickel', 'норникель', 'nornickel', 'медь', 'copper', 'алюмин', 'сталь'] },
    { id: 'us_eq',     label: 'Рынок США',            tickers: ['VOO'],
      kw: ['s&p', 'nasdaq', 'dow jones', 'уолл-стрит', 'wall street', 'фрс', 'fed ', 'федеральн резерв'] },
    { id: 'realestate',label: 'Недвижимость',         tickers: ['TKVM', 'REITX'],
      kw: ['недвижимост', 'жилищ', 'квартир', 'housing', 'real estate', 'застройщик'] },
  ];

  const POS_WORDS = ['рост', 'вырос', 'повыс', 'рекорд', 'прибыл', 'усили', 'разогн', 'позитив',
    'одобрил', 'rally', 'surge', 'gain', 'jump', 'bull', 'soar', 'record', 'profit', 'approves'];
  const NEG_WORDS = ['паден', 'упал', 'рухн', 'сниз', 'обвал', 'риск обр', 'sanction', 'banned',
    'slump', 'drop', 'plunge', 'crash', 'ban', 'спад', 'спрогнозировал сниж'];

  /* ============================ State ============================ */

  let liveNews = [];         // реальные новости из RSS
  let livePolymarket = [];   // реальные рынки Polymarket
  let feedStatus = {};       // sourceId -> {ok, items, error, ts}
  let polyStatus = { state: 'idle', error: null, ts: 0 };
  let lastNewsUpdate = 0;
  let lastPolyUpdate = 0;
  let currentFilter = 'all';
  let newsFetching = false;
  let polyFetching = false;
  let viewSig = '';
  let widgetSig = '';
  let booted = false;

  /* ============================ Utils ============================ */

  const $esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function stripTags(html) {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function relTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 0) return new Date(ts).toLocaleDateString('ru-RU');
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' ч назад';
    const d = Math.floor(h / 24);
    if (d === 1) return 'вчера';
    if (d < 30) return d + ' дн назад';
    return new Date(ts).toLocaleDateString('ru-RU');
  }

  function clockTime(ts) {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function compactUSD(v) {
    const n = Number(v) || 0;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
  }

  function normTitle(t) {
    return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  function detectSentiment(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    let pos = 0, neg = 0;
    POS_WORDS.forEach(w => { if (t.includes(w)) pos++; });
    NEG_WORDS.forEach(w => { if (t.includes(w)) neg++; });
    if (pos > neg) return 'bullish';
    if (neg > pos) return 'bearish';
    return 'neutral';
  }

  // Прекомпиляция regex-ключей (формат 're:<pattern>')
  TOPIC_RULES.forEach(rule => {
    rule._rx = rule.kw.filter(k => k.startsWith('re:')).map(k => new RegExp(k.slice(3), 'i'));
    rule._plain = rule.kw.filter(k => !k.startsWith('re:'));
  });

  function matchTopics(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    const out = [];
    TOPIC_RULES.forEach(rule => {
      const hit = rule._plain.some(k => t.includes(k)) || rule._rx.some(rx => rx.test(t));
      if (hit) out.push(rule);
    });
    return out;
  }

  function marketQuote(ticker) {
    return MARKET.find(m => m.ticker === ticker) || null;
  }

  /* ============================ Cache ============================ */

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        news: liveNews.slice(0, MAX_NEWS_ITEMS),
        polymarket: livePolymarket.slice(0, 15),
        lastNewsUpdate, lastPolyUpdate
      }));
    } catch (e) { /* quota — игнорируем */ }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (Array.isArray(c.news) && c.news.length && !liveNews.length) liveNews = c.news;
      if (Array.isArray(c.polymarket) && c.polymarket.length && !livePolymarket.length) livePolymarket = c.polymarket;
      lastNewsUpdate = c.lastNewsUpdate || lastNewsUpdate;
      lastPolyUpdate = c.lastPolyUpdate || lastPolyUpdate;
    } catch (e) { /* повреждённый кэш — игнорируем */ }
  }

  /* ============================ Network ============================ */

  async function fetchBuffer(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  }

  // Перебор прокси: возвращает { buffer, via } первого успешного.
  async function fetchViaProxies(targetUrl) {
    let lastErr = null;
    for (const proxy of PROXY_CHAIN) {
      try {
        const buffer = await fetchBuffer(proxy.wrap(targetUrl), proxy.name === 'direct' ? 8000 : 16000);
        if (buffer && buffer.byteLength > 100) return { buffer, via: proxy.name };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all proxies failed');
  }

  function decodeXmlBuffer(buffer) {
    const head = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0, 300)));
    const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
    const enc = m ? m[1].trim().toLowerCase() : 'utf-8';
    try { return new TextDecoder(enc).decode(buffer); }
    catch (e) { return new TextDecoder('utf-8').decode(buffer); }
  }

  /* ============================ RSS parsing ============================ */

  function childText(node, names) {
    for (const name of names) {
      const els = node.getElementsByTagName(name);
      if (els && els.length && els[0].textContent) return els[0].textContent.trim();
    }
    return '';
  }

  function parseRss(xmlText, source) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) return [];
    let nodes = Array.from(doc.getElementsByTagName('item'));
    const isAtom = !nodes.length;
    if (isAtom) nodes = Array.from(doc.getElementsByTagName('entry'));

    const out = [];
    nodes.slice(0, 25).forEach(node => {
      const title = stripTags(childText(node, ['title']));
      if (!title) return;
      let link = '';
      if (isAtom) {
        const l = node.getElementsByTagName('link')[0];
        link = l ? (l.getAttribute('href') || '') : '';
      } else {
        link = childText(node, ['link', 'guid']).trim();
      }
      const dateStr = childText(node, ['pubDate', 'published', 'updated', 'dc:date', 'date']);
      let ts = Date.parse(dateStr);
      if (isNaN(ts)) ts = Date.now();
      const summary = stripTags(childText(node, ['description', 'summary', 'content'])).slice(0, 240);
      const topics = matchTopics(title + ' ' + summary);
      out.push({
        id: 'n_' + (link || title).length + '_' + Math.abs(hashCode(link || title)),
        source: source.label,
        sourceId: source.id,
        category: source.cat,
        title, summary, link, ts,
        topics: topics.map(t => t.label),
        tickers: unique(topics.reduce((a, t) => a.concat(t.tickers), [])).slice(0, 4),
        sentiment: detectSentiment(title + ' ' + summary)
      });
    });
    return out;
  }

  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  }

  function unique(arr) { return Array.from(new Set(arr)); }

  function mergeNews(incomingItems) {
    const seen = new Set(liveNews.map(n => n.normKey || (n.normKey = normTitle(n.title))));
    const merged = [...liveNews];
    incomingItems.forEach(n => {
      const key = normTitle(n.title);
      if (!key || seen.has(key)) return;
      seen.add(key);
      n.normKey = key;
      merged.push(n);
    });
    merged.sort((a, b) => b.ts - a.ts);
    // Отбрасываем устаревшие (старше 3 суток) и лишние
    const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
    liveNews = merged.filter(n => n.ts >= cutoff).slice(0, MAX_NEWS_ITEMS);
  }

  /* ============================ Live fetchers ============================ */

  async function refreshNews() {
    if (newsFetching) return;
    newsFetching = true;
    renderAllSurfaces();

    const jobs = NEWS_SOURCES.map(async (source) => {
      feedStatus[source.id] = { state: 'loading', items: 0, error: null };
      try {
        const { buffer } = await fetchViaProxies(source.url);
        const xml = decodeXmlBuffer(buffer);
        const items = parseRss(xml, source);
        feedStatus[source.id] = { state: items.length ? 'ok' : 'empty', items: items.length, error: null };
        if (items.length) {
          mergeNews(items);
          lastNewsUpdate = Date.now();
          renderAllSurfaces(); // прогрессивная отрисовка по мере поступления
        }
      } catch (e) {
        feedStatus[source.id] = { state: 'error', items: 0, error: String(e && e.message || e) };
        console.warn('[TINVEST live] feed failed:', source.label, e);
      }
    });

    await Promise.allSettled(jobs);
    newsFetching = false;
    if (lastNewsUpdate) saveCache();
    renderAllSurfaces();
  }

  function parsePolymarket(json) {
    const events = Array.isArray(json) ? json : [];
    const out = [];
    events.forEach(ev => {
      const markets = Array.isArray(ev.markets) ? ev.markets : [];
      const m = markets.find(x => x && x.outcomePrices && String(x.outcomePrices).includes('0')) || markets[0];
      if (!m) return;
      let prices = [];
      try { prices = JSON.parse(m.outcomePrices); } catch (e) { prices = []; }
      let prob = parseFloat(prices[0]);
      if (isNaN(prob) && typeof m.lastTradePrice === 'number') prob = m.lastTradePrice;
      if (isNaN(prob)) return;
      prob = prob <= 1 ? prob * 100 : prob;
      prob = Math.round(prob * 10) / 10;
      const chg = typeof m.oneDayPriceChange === 'number'
        ? Math.round(m.oneDayPriceChange * 1000) / 10 : 0;
      const vol = Number(m.volume24hr || ev.volume24hr || m.volume || ev.volume || 0);
      const title = ev.title || m.question || m.slug || 'Market';
      const slug = ev.slug || m.slug || m.id;
      const topics = matchTopics(title + ' ' + (ev.description || ''));
      out.push({
        id: 'poly_' + (ev.id || m.id || slug),
        title, prob, chg, volume: vol,
        link: 'https://polymarket.com/event/' + slug,
        tickers: unique(topics.reduce((a, t) => a.concat(t.tickers), [])).slice(0, 4),
        topics: topics.map(t => t.label),
        endDate: ev.endDate || m.endDate || null
      });
    });
    out.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    return out;
  }

  async function refreshPolymarket() {
    if (polyFetching) return;
    polyFetching = true;
    try {
      let parsed = null;
      let lastErr = null;
      for (const endpoint of POLY_ENDPOINTS) {
        try {
          const { buffer } = await fetchViaProxies(endpoint);
          parsed = parsePolymarket(JSON.parse(new TextDecoder('utf-8').decode(buffer)));
          if (parsed.length) break;
        } catch (e) { lastErr = e; }
      }
      if (parsed && parsed.length) {
        livePolymarket = parsed;
        lastPolyUpdate = Date.now();
        polyStatus = { state: 'ok', error: null, ts: lastPolyUpdate };
        saveCache();
      } else {
        polyStatus = { state: 'error', error: String(lastErr && lastErr.message || lastErr || 'empty'), ts: Date.now() };
      }
    } catch (e) {
      polyStatus = { state: 'error', error: String(e && e.message || e), ts: Date.now() };
      console.warn('[TINVEST live] polymarket failed', e);
    } finally {
      polyFetching = false;
      renderAllSurfaces();
    }
  }

  function refreshAll(manual) {
    refreshNews();
    refreshPolymarket();
    if (manual && window.app && window.app.toast) {
      window.app.toast('Обновляем реальные данные: новости + Polymarket…');
    }
  }

  /* ============================ Signal engine ============================ */

  // Сигналы собираются ТОЛЬКО из реальных входных данных:
  // 1) упоминания тем в свежих заголовках СМИ, 2) вероятности Polymarket.
  function buildSignals() {
    const map = {}; // ticker -> agg

    function touch(ticker) {
      if (!map[ticker]) {
        map[ticker] = { ticker, mentions: 0, headlines: [], sources: new Set(), poly: null, lastTs: 0, bull: 0, bear: 0 };
      }
      return map[ticker];
    }

    liveNews.forEach(n => {
      (n.tickers || []).forEach(tk => {
        const s = touch(tk);
        s.mentions++;
        s.sources.add(n.source);
        if (n.ts > s.lastTs) s.lastTs = n.ts;
        if (s.headlines.length < 3) s.headlines.push({ title: n.title, link: n.link, source: n.source, ts: n.ts });
        if (n.sentiment === 'bullish') s.bull++;
        if (n.sentiment === 'bearish') s.bear++;
      });
    });

    livePolymarket.slice(0, 15).forEach(p => {
      (p.tickers || []).forEach(tk => {
        const s = touch(tk);
        // Берём самый ликвидный рынок
        if (!s.poly || (p.volume || 0) > (s.poly.volume || 0)) {
          s.poly = { title: p.title, prob: p.prob, link: p.link, volume: p.volume };
        }
      });
    });

    const arr = Object.values(map).map(s => {
      const quote = marketQuote(s.ticker);
      const recencyH = s.lastTs ? (Date.now() - s.lastTs) / 3600000 : 999;
      const recencyBoost = recencyH < 2 ? 3 : recencyH < 8 ? 1.5 : recencyH < 24 ? 0.5 : 0;
      const polyBoost = s.poly ? (s.poly.prob >= 60 ? 2.5 : s.poly.prob >= 40 ? 1.2 : 0.4) : 0;
      const sourceBoost = Math.min(s.sources.size, 3) * 0.7;
      s.score = s.mentions * 1.6 + recencyBoost + polyBoost + sourceBoost;
      s.sentiment = s.bull > s.bear ? 'bullish' : s.bear > s.bull ? 'bearish' : 'neutral';
      s.quote = quote;
      return s;
    });

    arr.sort((a, b) => b.score - a.score);
    return arr;
  }

  // Совместимость с app.js (AI-рекомендации на дашборде/аналитике).
  function getBaseRecommendations() {
    return buildSignals().slice(0, 6).map(s => {
      const q = s.quote || {};
      const top = s.headlines[0];
      return {
        ticker: s.ticker,
        name: q.name || s.ticker,
        type: q.type || 'stock',
        sector: q.sector || 'tech',
        urgency: s.mentions >= 4 || (s.poly && s.poly.prob >= 65) ? 'Высокая' : 'На радаре',
        source: s.poly
          ? `Polymarket ${Math.round(s.poly.prob)}% + СМИ (${s.sources.size})`
          : `СМИ: ${Array.from(s.sources).join(', ')}`,
        reason: top
          ? `В инфополе: «${top.title}» (${top.source}, ${relTime(top.ts)})`
          : `Polymarket оценивает вероятность в ${Math.round(s.poly.prob)}%: «${s.poly.title}»`,
        expectedReturn: q.price != null
          ? `Живая цена ${fmtQuote(q)}${q.change != null ? ' (' + (q.change >= 0 ? '+' : '') + q.change.toFixed(2) + '% сегодня)' : ''}`
          : 'Цена обновляется онлайн',
        targetWeight: '5 - 10%'
      };
    });
  }

  function fmtQuote(q) {
    const isUsd = ['BTC', 'ETH', 'SOL', 'NVDA', 'AAPL', 'MSFT', 'VOO'].includes(q.ticker);
    const v = q.price >= 1000 ? Math.round(q.price).toLocaleString('ru-RU') : (+q.price).toFixed(2);
    return isUsd ? '$' + v : v + ' ₽';
  }

  /* ====================== Portfolio exposure (real) ====================== */

  function calcPortfolioExposure() {
    const state = (window.app && window.app.state) || {};
    const holdings = (state.holdings) || [];
    const fx = (state.fx) || { USD_RUB: 78.7 };

    let totalVal = 0;
    let rateHedgingVal = 0; // LQDT, bonds/floaters, SBER
    let energyVal = 0;
    let goldVal = 0;
    let cryptoVal = 0;

    holdings.forEach(h => {
      const val = h.currency === 'USD' ? h.qty * h.price * fx.USD_RUB : h.qty * h.price;
      totalVal += val;

      if (['LQDT', 'SU29014', 'SU26238', 'SBER'].includes(h.ticker)) rateHedgingVal += val;
      if (['LKOH', 'ROSN', 'TATN', 'GAZP', 'NVTK'].includes(h.ticker)) energyVal += val;
      if (['PLZL', 'GLDRUB'].includes(h.ticker)) goldVal += val;
      if (['BTC', 'ETH', 'SOL'].includes(h.ticker)) cryptoVal += val;
    });

    // Горячие темы из РЕАЛЬНОГО потока новостей прямо сейчас
    const hot = {};
    liveNews.slice(0, 20).forEach(n => (n.topics || []).forEach(t => { hot[t] = (hot[t] || 0) + 1; }));
    const hotTopics = Object.entries(hot).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    if (!totalVal) {
      return {
        score: 40,
        statusLabel: 'Портфель пуст',
        statusClass: 'pill-red',
        text: 'Добавьте активы в портфель, чтобы оценить его защищённость от тем реального новостного потока.',
        ratePct: 0, energyPct: 0, goldPct: 0, cryptoPct: 0,
        hotTopics,
        gapAdvice: hotTopics.length
          ? `Сейчас в инфополе лидируют темы: ${hotTopics.join(', ')}. Добавьте активы — модуль сопоставит их с влиянием на ваш портфель.`
          : 'Идёт загрузка реального новостного потока…'
      };
    }

    const ratePct = Math.round(rateHedgingVal / totalVal * 100);
    const energyPct = Math.round(energyVal / totalVal * 100);
    const goldPct = Math.round(goldVal / totalVal * 100);
    const cryptoPct = Math.round(cryptoVal / totalVal * 100);

    let score = 50;
    if (ratePct >= 10) score += 20;
    if (energyPct >= 10) score += 15;
    if (goldPct >= 5 || cryptoPct >= 5) score += 15;

    let statusLabel = 'Хорошо адаптирован';
    let statusClass = 'pill-green';
    let gapAdvice = 'Ваш портфель имеет сбалансированную структуру к текущим темам ленты новостей.';

    if (score < 60) {
      statusLabel = 'Низкая защита от ставки';
      statusClass = 'pill-red';
      gapAdvice = 'Добавьте минимум 10–15% фонда денежного рынка (LQDT) или флоатеров (SU29014) — они стабилизируют доходность при любых решениях регулятора.';
    } else if (score < 80) {
      statusLabel = 'Умеренная адаптация';
      statusClass = 'pill-blue';
      gapAdvice = 'Можно усилить защитные активы (золото PLZL/GLDRUB) или экспортёров (LKOH), сверяясь с горячими темами ленты: ' + (hotTopics.join(', ') || 'загрузка…') + '.';
    }

    if (hotTopics.length) {
      gapAdvice += ' Горячие темы сейчас: ' + hotTopics.join(' • ') + '.';
    }

    return {
      score, statusLabel, statusClass,
      text: `Адаптация к событиям: ${score}/100. Кэш/Флоатеры: ${ratePct}%, Нефтегаз: ${energyPct}%, Золото: ${goldPct}%, Крипта: ${cryptoPct}%.`,
      ratePct, energyPct, goldPct, cryptoPct, hotTopics, gapAdvice
    };
  }

  /* ============================ Rendering ============================ */

  function statusSourcesHtml() {
    return NEWS_SOURCES.map(s => {
      const st = feedStatus[s.id] || { state: 'idle' };
      const dot = st.state === 'ok' ? '#22c55e' : st.state === 'loading' ? '#f59e0b' : st.state === 'error' ? '#ef4444' : '#64748b';
      return `<span class="mini" title="${st.error ? $esc(st.error) : $esc(s.url)}" style="display:inline-flex;align-items:center;gap:4px;color:var(--text2)">
        <span style="width:7px;height:7px;border-radius:50%;background:${dot};display:inline-block"></span>${$esc(s.label)}</span>`;
    }).join('');
  }

  function liveStatusBarHtml() {
    const anyFail = Object.values(feedStatus).some(s => s.state === 'error') || polyStatus.state === 'error';
    const upd = lastNewsUpdate ? clockTime(lastNewsUpdate) : '—';
    const polyUpd = lastPolyUpdate ? clockTime(lastPolyUpdate) : '—';
    const loading = newsFetching || polyFetching;
    return `
      <div class="card" style="background:linear-gradient(135deg, rgba(34,197,94,0.10), rgba(79,124,255,0.08));border:1px solid rgba(34,197,94,0.28);margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="pill pill-green" style="display:inline-flex;align-items:center;gap:6px">
              <span class="pulse" style="position:static"></span> ОНЛАЙН • реальные данные
            </span>
            <span class="mini muted">Новости обновлены: <b style="color:var(--text)">${upd}</b></span>
            <span class="mini muted">Polymarket: <b style="color:var(--text)">${polyUpd}</b></span>
            ${loading ? '<span class="pill pill-blue">⟳ загрузка…</span>' : ''}
            ${anyFail && !loading ? '<span class="pill pill-red">часть источников недоступна</span>' : ''}
          </div>
          <button class="btn btn-primary btn-sm" id="btnLiveRefresh">⟳ Обновить сейчас</button>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;align-items:center">
          ${statusSourcesHtml()}
          <span class="mini" style="display:inline-flex;align-items:center;gap:4px;color:var(--text2)">
            <span style="width:7px;height:7px;border-radius:50%;background:${polyStatus.state === 'ok' ? '#22c55e' : polyStatus.state === 'loading' ? '#f59e0b' : '#64748b'};display:inline-block"></span>Polymarket API
          </span>
        </div>
        <div class="mini muted" style="margin-top:8px">Автообновление: новости — каждые 3 мин, Polymarket — каждые 90 сек, котировки MOEX/Binance — каждые 10 сек. Без симуляторов: всё, что вы видите, — реальные онлайн-данные.</div>
      </div>`;
  }

  function signalsGridHtml(signals) {
    if (!signals.length) {
      return `<div class="empty" style="padding:26px"><div class="empty-icon">📡</div>
        Сигналы формируются из реального потока новостей и рынков Polymarket.<br>
        <span class="mini muted">${Object.values(feedStatus).every(s => s.state === 'error') && lastNewsUpdate === 0
          ? 'Источники пока недоступны — проверьте соединение, модуль повторит попытку автоматически.'
          : 'Загружаем свежие данные…'}</span></div>`;
    }
    return `<div class="grid grid-3">` + signals.slice(0, 6).map(s => {
      const q = s.quote || {};
      const color = q.color || '#4f7cff';
      const icon = q.icon || s.ticker.slice(0, 2);
      const top = s.headlines[0];
      const strength = s.mentions >= 4 || (s.poly && s.poly.prob >= 65) ? 'pill-red" title="Тема активно обсуждается в инфополе' : 'pill-blue';
      const sentiIcon = s.sentiment === 'bullish' ? '🟢' : s.sentiment === 'bearish' ? '🔴' : '⚪';
      return `
        <div class="card" style="display:flex;flex-direction:column;border-color:rgba(79,124,255,0.25)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div class="asset-cell">
              <div class="asset-icon" style="background:${color}">${$esc(icon)}</div>
              <div>
                <div style="font-weight:800;font-size:16px">${$esc(s.ticker)}</div>
                <div class="mini muted">${$esc(q.name || '')}</div>
              </div>
            </div>
            <span class="pill ${strength}">${s.mentions} новост${s.mentions === 1 ? 'ь' : (s.mentions < 5 ? 'и' : 'ей')}</span>
          </div>
          ${q.price != null ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);margin-bottom:10px">
              <span class="mini muted">Живая котировка</span>
              <span style="font-weight:800">${fmtQuote(q)}</span>
              ${q.change != null ? `<span class="pill ${q.change >= 0 ? 'pill-green' : 'pill-red'}" style="font-size:11px">${q.change >= 0 ? '+' : ''}${(+q.change).toFixed(2)}%</span>` : ''}
            </div>` : ''}
          <div style="display:grid;gap:6px;margin-bottom:10px">
            ${s.headlines.slice(0, 2).map(h => `
              <a href="${$esc(h.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;padding:8px 10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);display:block">
                <div class="mini" style="font-weight:600;line-height:1.35">${$esc(h.title)}</div>
                <div class="mini muted" style="margin-top:3px">${$esc(h.source)} • ${relTime(h.ts)} ↗</div>
              </a>`).join('')}
            ${s.poly ? `
              <a href="${$esc(s.poly.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;padding:8px 10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);display:block">
                <div class="mini" style="font-weight:600;line-height:1.35">🎲 ${$esc(s.poly.title)}</div>
                <div class="mini muted" style="margin-top:3px">Polymarket • вероятность <b style="color:var(--accent)">${Math.round(s.poly.prob)}% YES</b>, объём ${compactUSD(s.poly.volume)} ↗</div>
              </a>` : ''}
          </div>
          <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span class="mini muted">${sentiIcon} ${s.sentiment === 'bullish' ? 'позитивный фон' : s.sentiment === 'bearish' ? 'негативный фон' : 'нейтральный фон'}</span>
            <button class="btn btn-primary btn-sm" data-buy-rec="${$esc(s.ticker)}">Купить ${$esc(s.ticker)}</button>
          </div>
        </div>`;
    }).join('') + `</div>`;
  }

  function newsFeedHtml() {
    const availableSources = unique(liveNews.map(n => n.sourceId));
    const chips = [{ id: 'all', label: 'Все' }]
      .concat(NEWS_SOURCES.filter(s => availableSources.includes(s.id)).map(s => ({ id: s.id, label: s.label })));

    let list = liveNews;
    if (currentFilter !== 'all') list = liveNews.filter(n => n.sourceId === currentFilter);
    const shown = list.slice(0, 12);

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="font-weight:800">📻 Живая лента новостей</h3>
            <p class="mini muted">${lastNewsUpdate ? 'Реальные ленты • обновлено ' + clockTime(lastNewsUpdate) : 'Подключение к лентам…'}</p>
          </div>
          <div class="tabs" style="flex-wrap:wrap">
            ${chips.map(c => `<button class="tab ${currentFilter === c.id ? 'active' : ''}" data-news-tab="${c.id}">${$esc(c.label)}</button>`).join('')}
          </div>
        </div>
        <div style="display:grid;gap:12px">
          ${shown.length ? shown.map(n => `
            <div style="padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap">
                <span class="pill pill-blue">${$esc(n.source)}</span>
                <span class="mini muted">${relTime(n.ts)}</span>
              </div>
              <a href="${$esc(n.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">
                <h4 style="font-weight:700;font-size:14px;margin-bottom:4px;line-height:1.3">${$esc(n.title)} ↗</h4>
              </a>
              ${n.summary ? `<p class="mini muted" style="line-height:1.4;margin-bottom:8px">${$esc(n.summary)}</p>` : ''}
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${n.sentiment === 'bullish' ? '<span class="mini pill pill-green">позитив</span>' : n.sentiment === 'bearish' ? '<span class="mini pill pill-red">негатив</span>' : ''}
                  ${(n.tickers || []).map(t => `<span class="mini pill" style="background:rgba(255,255,255,0.06)">${$esc(t)}</span>`).join('')}
                </div>
                ${(n.tickers || []).length ? `
                  <button class="btn-ghost btn-sm" data-buy-rec="${$esc(n.tickers[0])}" style="font-size:11px;border:1px solid var(--border)">
                    Купить ${$esc(n.tickers[0])} →
                  </button>` : ''}
              </div>
            </div>`).join('') : `
            <div class="empty" style="padding:20px"><div class="empty-icon">🛰️</div>
              ${lastNewsUpdate ? 'По выбранной ленте пока нет свежих новостей.' : 'Идёт подключение к реальным новостным лентам…'}
            </div>`}
        </div>
      </div>`;
  }

  function polymarketHtml() {
    const list = livePolymarket.slice(0, 8);
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="font-weight:800">🎲 Polymarket — реальный рынок предсказаний</h3>
            <p class="mini muted">${lastPolyUpdate ? 'gamma-api.polymarket.com • обновлено ' + clockTime(lastPolyUpdate) : 'Подключение к Polymarket…'}</p>
          </div>
          <span class="pill ${polyStatus.state === 'ok' ? 'pill-green' : 'pill-blue'}">${polyStatus.state === 'ok' ? 'Live API' : polyFetching ? '⟳ подключение' : 'кэш/повтор'}</span>
        </div>
        <div style="display:grid;gap:12px">
          ${list.length ? list.map(p => `
            <div style="padding:14px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap">
                <span class="mini muted">Объём 24ч: ${compactUSD(p.volume)}</span>
                <span class="pill ${p.chg >= 0 ? 'pill-green' : 'pill-red'}">${p.chg >= 0 ? '+' : ''}${p.chg}% за 24ч</span>
              </div>
              <a href="${$esc(p.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">
                <h4 style="font-weight:700;font-size:14px;margin-bottom:8px;line-height:1.3">${$esc(p.title)} ↗</h4>
              </a>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span class="mini muted">Вероятность исхода:</span>
                <b style="color:var(--accent);font-size:16px">${p.prob}% YES</b>
              </div>
              <div class="progress" style="margin-bottom:10px">
                <div class="progress-bar" style="width:${Math.min(100, p.prob)}%;background:linear-gradient(90deg, var(--accent), #22c55e)"></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${(p.topics || []).slice(0, 2).map(t => `<span class="mini pill" style="background:rgba(255,255,255,0.06)">${$esc(t)}</span>`).join('')}
                  ${(p.tickers || []).map(t => `<span class="mini pill pill-blue">${$esc(t)}</span>`).join('')}
                </div>
                ${(p.tickers || []).length ? `
                  <button class="btn btn-primary btn-sm" data-buy-rec="${$esc(p.tickers[0])}">
                    Купить ${$esc(p.tickers[0])}
                  </button>` : ''}
              </div>
            </div>`).join('') : `
            <div class="empty" style="padding:20px"><div class="empty-icon">🎲</div>
              ${polyStatus.state === 'error' ? 'Polymarket временно недоступен — автоматически повторим подключение.' : 'Загружаем реальные рынки предсказаний…'}
            </div>`}
        </div>
      </div>`;
  }

  function exposureHtml(exposure) {
    return `
      <div class="grid grid-3" style="margin-bottom:20px">
        <div class="card">
          <div class="kpi-label">🛡️ Новостной статус портфеля</div>
          <div class="kpi-value" style="font-size:32px;margin:6px 0">${exposure.score}<span style="font-size:16px;color:var(--text3)">/100</span></div>
          <span class="pill ${exposure.statusClass}">${exposure.statusLabel}</span>
          <div class="mini muted" style="margin-top:10px;line-height:1.4">${exposure.text}</div>
        </div>
        <div class="card" style="grid-column:span 2">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-weight:700">💡 Рекомендация по адаптации к событиям</h3>
            <span class="pill pill-blue">Live-анализ</span>
          </div>
          <div style="padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border);margin-bottom:10px;line-height:1.5;font-weight:600;color:var(--text)">
            ${$esc(exposure.gapAdvice)}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <span class="mini muted">Кэш/Флоатеры: <b>${exposure.ratePct}%</b></span>
            <span class="mini muted">Нефтегаз: <b>${exposure.energyPct}%</b></span>
            <span class="mini muted">Золото: <b>${exposure.goldPct}%</b></span>
            <span class="mini muted">Крипта: <b>${exposure.cryptoPct}%</b></span>
          </div>
        </div>
      </div>`;
  }

  function currentSig() {
    const holdings = (window.app && window.app.state && window.app.state.holdings) || [];
    return [
      lastNewsUpdate, lastPolyUpdate, currentFilter,
      liveNews.length, livePolymarket.length,
      newsFetching ? 1 : 0, polyFetching ? 1 : 0,
      holdings.map(h => h.ticker + ':' + h.qty).join('|')
    ].join('#');
  }

  function renderNewsView(force) {
    const container = document.getElementById('view-signals');
    if (!container) return;
    const sig = currentSig();
    if (!force && sig === viewSig) return;
    viewSig = sig;

    const signals = buildSignals();
    const exposure = calcPortfolioExposure();

    container.innerHTML =
      liveStatusBarHtml() +
      exposureHtml(exposure) +
      `<div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <h2 style="font-size:20px;font-weight:800">🎯 Сигналы прямо сейчас</h2>
            <p class="muted mini">Собраны из реальных заголовков СМИ и вероятностей Polymarket. Котировки — MOEX/Binance live.</p>
          </div>
          <span class="pill pill-green">${liveNews.length} новостей в потоке</span>
        </div>
        ${signalsGridHtml(signals)}
      </div>` +
      `<div class="grid grid-2" style="margin-top:24px">${newsFeedHtml()}${polymarketHtml()}</div>`;

    attachSignalsEvents(container);
  }

  function attachSignalsEvents(container) {
    // Ручное обновление реальных данных
    container.querySelector('#btnLiveRefresh')?.addEventListener('click', () => refreshAll(true));

    // Фильтр лент по источнику
    container.querySelectorAll('[data-news-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        currentFilter = tab.dataset.newsTab;
        renderNewsView(true);
      });
    });

    // Кнопки покупки по сигналам
    container.querySelectorAll('[data-buy-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.dataset.buyRec;
        const marketItem = (window.TINVEST_DATA.MARKET || []).find(m => m.ticker === ticker) || { ticker, name: ticker, price: 100 };
        if (window.app && window.app.openBuyModal) window.app.openBuyModal(marketItem);
      });
    });
  }

  function renderDashboardNewsWidget() {
    const el = document.getElementById('dashNewsWidget');
    if (!el) return;
    const signals = buildSignals();
    const sig = [lastNewsUpdate, lastPolyUpdate, signals.slice(0, 3).map(s => s.ticker + s.mentions).join(',')].join('#');
    if (sig === widgetSig) return;
    widgetSig = sig;

    const recs = signals.slice(0, 3);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="font-weight:700">📻 Сигналы Бизнес ФМ, СМИ & Polymarket</h3>
          <span class="pill pill-green" style="display:inline-flex;align-items:center;gap:5px"><span class="pulse" style="position:static"></span>Live</span>
        </div>
        <a href="#" class="mini muted" data-view-trigger="signals">Все новости & сигналы →</a>
      </div>
      <div style="display:grid;gap:8px">
        ${recs.length ? recs.map(s => {
          const q = s.quote || {};
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);gap:8px">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(79,124,255,0.12);color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:12px;flex-shrink:0">
                ${$esc(s.ticker.slice(0, 2))}
              </div>
              <div style="min-width:0">
                <div style="font-weight:700;font-size:13px">${$esc(s.ticker)} — ${$esc(q.name || s.ticker)}</div>
                <div class="mini muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px">${$esc(s.headlines[0] ? s.headlines[0].title : (s.poly ? 'Polymarket: ' + s.poly.title : ''))}</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" data-buy-rec="${$esc(s.ticker)}" style="flex-shrink:0">Купить</button>
          </div>`;
        }).join('') : `
          <div class="empty" style="padding:16px"><div class="empty-icon">📡</div>
            Подключаемся к реальным новостным лентам и Polymarket… сигналы появятся автоматически.
          </div>`}
      </div>`;

    el.querySelectorAll('[data-buy-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.dataset.buyRec;
        const marketItem = (window.TINVEST_DATA.MARKET || []).find(m => m.ticker === ticker) || { ticker, name: ticker, price: 100 };
        if (window.app && window.app.openBuyModal) window.app.openBuyModal(marketItem);
      });
    });
  }

  function renderAllSurfaces() {
    renderDashboardNewsWidget();
    const view = document.getElementById('view-signals');
    if (view && view.classList.contains('active')) renderNewsView();
    else viewSig = ''; // перерисуем при следующем входе на вкладку
  }

  /* ============================ Boot ============================ */

  function boot() {
    if (booted) return;
    booted = true;
    loadCache();
    renderAllSurfaces();

    // Первичная загрузка реальных данных сразу при старте
    refreshAll(false);

    // Автообновление (онлайн-режим)
    setInterval(refreshNews, NEWS_REFRESH_MS);
    setInterval(refreshPolymarket, POLY_REFRESH_MS);

    // Вернулись во вкладку — обновим, если данные устарели
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (Date.now() - lastNewsUpdate > 60000) refreshNews();
      if (Date.now() - lastPolyUpdate > 45000) refreshPolymarket();
    });
    window.addEventListener('online', () => refreshAll(false));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose live module
  window.TINVEST_NEWS = {
    renderNewsView,
    renderDashboardNewsWidget,
    calcPortfolioExposure,
    getBaseRecommendations,
    buildSignals,
    refresh: refreshAll,
    // диагностика для консоли
    _debug: () => ({ news: liveNews, polymarket: livePolymarket, feedStatus, polyStatus })
  };
})();
