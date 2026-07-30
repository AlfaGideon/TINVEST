(function() {
  const data = window.TINVEST_DATA || {};
  let newsFeed = data.NEWS_FEED || [];
  let polymarketEvents = data.POLYMARKET_EVENTS || [];

  let currentScenario = null; // null = live feed, or 'high_rate', 'oil_surge', 'geopolitics', 'crypto_bull'
  let currentFilterTab = 'all';

  const SCENARIOS = {
    high_rate: {
      id: 'high_rate',
      title: 'Бизнес ФМ: ЦБ поднимает ключевую ставку до 21-22%',
      source: 'Бизнес ФМ • Макро-сценарий',
      description: 'Ультражесткая ДКП регулятора для подавления инфляции. Растет доходность инструментов денежного рынка и флоатеров.',
      sentiment: 'Защитный режим (Высокая ставка)',
      sentimentScore: 88,
      recommendedProducts: [
        {
          ticker: 'LQDT',
          name: 'Фонд «Ликвидность»',
          type: 'etf',
          sector: 'cash',
          expectedReturn: '20.5% - 21.5% годовых',
          urgency: 'Критически рекомендуется',
          reason: 'Ежедневная капитализация процентов по ставке RUSFAR. Нулевой риск просадки тела капитала.',
          targetWeight: '15 - 20%'
        },
        {
          ticker: 'SU29014',
          name: 'ОФЗ 29014 (Флоатер)',
          type: 'bond',
          sector: 'bond',
          expectedReturn: 'Ключевая ставка + 0.5%',
          urgency: 'Высокая',
          reason: 'Купон автоматически растет вслед за ставкой ЦБ, защищая от процентного риска.',
          targetWeight: '10 - 15%'
        },
        {
          ticker: 'SBER',
          name: 'Сбербанк',
          type: 'stock',
          sector: 'finance',
          expectedReturn: 'Дивиденды ~13-15%',
          urgency: 'Средняя',
          reason: 'Главный бенефициар высоких процентных ставок через растущий маржинальный доход и чистую прибыль.',
          targetWeight: '10%'
        }
      ]
    },
    oil_surge: {
      id: 'oil_surge',
      title: 'Polymarket 78%: ОПЕК+ удерживает нефть Brent > $88',
      source: 'Polymarket • Рынок нефти',
      description: 'Дефицит предложения на мировом рынке и рост спроса формируют бычий тренд в энергетическом секторе.',
      sentiment: 'Сырьевой бум & Высокие дивиденды',
      sentimentScore: 82,
      recommendedProducts: [
        {
          ticker: 'LKOH',
          name: 'Лукойл',
          type: 'stock',
          sector: 'energy',
          expectedReturn: 'Дивиденды 14-17%',
          urgency: 'Высокая',
          reason: 'Огромная чистая денежная позиция и 100% выплата свободного денежного потока на дивиденды.',
          targetWeight: '12 - 15%'
        },
        {
          ticker: 'ROSN',
          name: 'Роснефть',
          type: 'stock',
          sector: 'energy',
          expectedReturn: 'Рост + дивиденды ~13%',
          urgency: 'Высокая',
          reason: 'Бенефициар проекта Восток Ойл и стабильных экспортных поставкок в Азию.',
          targetWeight: '10%'
        },
        {
          ticker: 'TATN',
          name: 'Татнефть',
          type: 'stock',
          sector: 'energy',
          expectedReturn: 'Дивиденды 3 раза/год',
          urgency: 'Средняя',
          reason: 'Высокая корпоративная прозрачность и частая выплата дивидендных купонов.',
          targetWeight: '8%'
        }
      ]
    },
    geopolitics: {
      id: 'geopolitics',
      title: 'Интерфакс: Эскалация геополитики & Санкционные риски',
      source: 'Геополитический анализ',
      description: 'Рост мировой напряженности стимулирует переток капитала в реальные физические активы и защитные инструменты.',
      sentiment: 'Защита от риска & Золото',
      sentimentScore: 92,
      recommendedProducts: [
        {
          ticker: 'PLZL',
          name: 'Полюс Золото',
          type: 'stock',
          sector: 'energy',
          expectedReturn: 'Рост котировок при ралли золота',
          urgency: 'Критически рекомендуется',
          reason: 'Низкая себестоимость добычи ($420/унция) делает Полюс самым маржинальным золотодобытчиком в мире.',
          targetWeight: '10 - 15%'
        },
        {
          ticker: 'GLDRUB',
          name: 'Физическое Золото (MOEX)',
          type: 'otc',
          sector: 'bond',
          expectedReturn: 'Защита от девальвации',
          urgency: 'Высокая',
          reason: 'Прямая привязка к мировой цене биржевого золота в рублях с хранением в НРД.',
          targetWeight: '8 - 12%'
        },
        {
          ticker: 'BTC',
          name: 'Bitcoin',
          type: 'crypto',
          sector: 'crypto',
          expectedReturn: 'Асимметричный рост',
          urgency: 'Средняя',
          reason: 'Независимый от суверенных банков инструмент сохранения стоимости с децентрализованной эмиссией.',
          targetWeight: '5 - 10%'
        }
      ]
    },
    crypto_bull: {
      id: 'crypto_bull',
      title: 'Polymarket 85%: Приток институционалов в Крипто-ETF',
      source: 'Polymarket • Цифровые активы',
      description: 'Массовое одобрение спотовых продуктов и снижение процентных ставок ФРС США ускоряют приток капитала в цифровые активы.',
      sentiment: 'Бычий тренд (Crypto Bull)',
      sentimentScore: 89,
      recommendedProducts: [
        {
          ticker: 'BTC',
          name: 'Bitcoin',
          type: 'crypto',
          sector: 'crypto',
          expectedReturn: 'Цель $100k+',
          urgency: 'Высокая',
          reason: 'Институциональный дефицит предложения после халвинга и притока в ETF.',
          targetWeight: '8 - 12%'
        },
        {
          ticker: 'SOL',
          name: 'Solana',
          type: 'crypto',
          sector: 'crypto',
          expectedReturn: 'Рост экосистемы DeFi',
          urgency: 'Средняя',
          reason: 'Лидер по скорости транзакций и суточному активному объему среди блокчейнов L1.',
          targetWeight: '3 - 5%'
        }
      ]
    }
  };

  function getBaseRecommendations() {
    if (currentScenario && SCENARIOS[currentScenario]) {
      return SCENARIOS[currentScenario].recommendedProducts;
    }

    // Combine current active news & polymarket recommendations
    const recs = [
      {
        ticker: 'LQDT',
        name: 'Фонд «Ликвидность»',
        type: 'etf',
        sector: 'cash',
        expectedReturn: '~20.2% годовых',
        urgency: 'Высокая',
        source: 'Бизнес ФМ (Ключевая ставка ЦБ 20%+)',
        reason: 'Защита от процентного риска с ежедневной капитализацией дохода по ключевой ставке RUSFAR.',
        targetWeight: '10 - 20%'
      },
      {
        ticker: 'SU29014',
        name: 'ОФЗ 29014 (Флоатер)',
        type: 'bond',
        sector: 'bond',
        expectedReturn: 'Ключевая ставка +0.5%',
        urgency: 'Высокая',
        source: 'Бизнес ФМ (Инфляционный тренд)',
        reason: 'Автоматическая адаптация купона под любые решения ЦБ РФ по ставке.',
        targetWeight: '10 - 15%'
      },
      {
        ticker: 'LKOH',
        name: 'Лукойл',
        type: 'stock',
        sector: 'energy',
        expectedReturn: 'Дивиденды 14-16%',
        urgency: 'Высокая',
        source: 'Polymarket (Нефть > $85)',
        reason: 'Высокий свободный денежный поток и стабильная дивидендная политика на долгосроке.',
        targetWeight: '10%'
      },
      {
        ticker: 'PLZL',
        name: 'Полюс Золото',
        type: 'stock',
        sector: 'energy',
        expectedReturn: 'Рост на максимумах золота',
        urgency: 'Средняя',
        source: 'Интерфакс (Геополитический хедж)',
        reason: 'Защита от санкционных и валютных шоков через самый дешевый по себестоимости драгметалл.',
        targetWeight: '8 - 10%'
      },
      {
        ticker: 'SBER',
        name: 'Сбербанк',
        type: 'stock',
        sector: 'finance',
        expectedReturn: 'Дивиденды ~13.5%',
        urgency: 'Средняя',
        source: 'Бизнес ФМ (Финансовый сектор)',
        reason: 'Лидер по ROE (22%+) с регулярной выплатой 50% чистой прибыли по МСФО.',
        targetWeight: '12%'
      },
      {
        ticker: 'BTC',
        name: 'Bitcoin',
        type: 'crypto',
        sector: 'crypto',
        expectedReturn: 'Глобальный хедж',
        urgency: 'Средняя',
        source: 'Polymarket (84% за $100k)',
        reason: 'Глобальный антиинфляционный актив при ослаблении фиатных валют.',
        targetWeight: '5 - 8%'
      }
    ];

    return recs;
  }

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

      if (['LQDT', 'SU29014', 'SU26238', 'SBER'].includes(h.ticker)) {
        rateHedgingVal += val;
      }
      if (['LKOH', 'ROSN', 'TATN', 'GAZP', 'NVTK'].includes(h.ticker)) {
        energyVal += val;
      }
      if (['PLZL', 'GLDRUB'].includes(h.ticker)) {
        goldVal += val;
      }
      if (['BTC', 'ETH', 'SOL'].includes(h.ticker)) {
        cryptoVal += val;
      }
    });

    if (!totalVal) {
      return {
        score: 40,
        statusLabel: 'Портфель пуст',
        statusClass: 'pill-red',
        text: 'Добавьте активы в портфель, чтобы оценить его защищенность от макро-новостей и событий Polymarket.',
        ratePct: 0,
        energyPct: 0,
        goldPct: 0,
        cryptoPct: 0,
        gapAdvice: 'Рекомендуется добавить LQDT и ОФЗ-флоатеры для защиты от высокой ставки ЦБ.'
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
    let gapAdvice = 'Ваш портфель имеет сбалансированную структуру к текущим макро-событиям.';

    if (score < 60) {
      statusLabel = 'Низкая защита от ставки ЦБ';
      statusClass = 'pill-red';
      gapAdvice = 'Добавьте минимум 10–15% фонда LQDT или флоатеров (SU29014), чтобы гарантировать высокую доходность при ставке 20%+.';
    } else if (score < 80) {
      statusLabel = 'Умеренная адаптация';
      statusClass = 'pill-blue';
      gapAdvice = 'Рекомендуется усилить золото (PLZL/GLDRUB) или экспортеров (LKOH), опираясь на сигналы Бизнес ФМ.';
    }

    return {
      score,
      statusLabel,
      statusClass,
      text: `Адаптация к событиям: ${score}/100. Кэш/Флоатеры: ${ratePct}%, Нефтегаз: ${energyPct}%, Золото: ${goldPct}%, Крипта: ${cryptoPct}%.`,
      ratePct,
      energyPct,
      goldPct,
      cryptoPct,
      gapAdvice
    };
  }

  function renderNewsView() {
    const container = document.getElementById('view-signals');
    if (!container) return;

    const recs = getBaseRecommendations();
    const exposure = calcPortfolioExposure();

    // Active scenario info if set
    const scInfo = currentScenario ? SCENARIOS[currentScenario] : null;

    // 1. Scenario Simulator Banner
    const scenarioHtml = `
      <div class="card" style="background:linear-gradient(135deg, rgba(79,124,255,0.12), rgba(124,77,255,0.1));border:1px solid rgba(79,124,255,0.25);margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="pill pill-blue">⚡ AI Симулятор макро-событий</span>
              ${currentScenario ? `<span class="pill pill-green">Активен сценарий: ${scInfo?.title}</span>` : '<span class="pill" style="background:rgba(255,255,255,0.06)">Режим: Живая лента новостей</span>'}
            </div>
            <h3 style="font-weight:800;font-size:18px;margin-top:8px">Выберите событие для моделирования рекомендаций к покупке:</h3>
          </div>
          ${currentScenario ? `<button class="btn btn-ghost btn-sm" id="btnResetScenario" style="border:1px solid var(--border)">✕ Сбросить к живой ленте</button>` : ''}
        </div>
        <div class="chips" style="margin-top:14px">
          <span class="chip ${currentScenario==='high_rate'?'active':''}" data-scenario="high_rate">🏦 Ставка ЦБ 21-22% (Бизнес ФМ)</span>
          <span class="chip ${currentScenario==='oil_surge'?'active':''}" data-scenario="oil_surge">🛢️ Нефть > $88 (Polymarket 78%)</span>
          <span class="chip ${currentScenario==='geopolitics'?'active':''}" data-scenario="geopolitics">🛡️ Геополитический хедж & Золото</span>
          <span class="chip ${currentScenario==='crypto_bull'?'active':''}" data-scenario="crypto_bull">🚀 Ралли Крипты (Polymarket 85%)</span>
        </div>
      </div>
    `;

    // 2. Exposure & Portfolio News Impact Widget
    const exposureHtml = `
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
            <span class="pill pill-blue">AI Анализ</span>
          </div>
          <div style="padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border);margin-bottom:10px;line-height:1.5;font-weight:600;color:var(--text)">
            ${exposure.gapAdvice}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <span class="mini muted">Защита от высокой ставки (LQDT/Флоатеры): <b>${exposure.ratePct}%</b></span>
            <span class="mini muted">Нефтегазовый сектор: <b>${exposure.energyPct}%</b></span>
            <span class="mini muted">Золото/Геополитика: <b>${exposure.goldPct}%</b></span>
          </div>
        </div>
      </div>
    `;

    // 3. Recommended Products Grid
    const recCardsHtml = `
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div>
            <h2 style="font-size:20px;font-weight:800">🎯 Продукты, которые стоит приобрести сейчас</h2>
            <p class="muted mini">Основано на сводках Бизнес ФМ, политических событиях и рынках Polymarket</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="btnAddCustomNewsBtn">+ Свое событие</button>
        </div>
        <div class="grid grid-3">
          ${recs.map(r => `
            <div class="card" style="display:flex;flex-direction:column;justify-space-between;border-color:rgba(79,124,255,0.25)">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                  <div class="asset-cell">
                    <div class="asset-icon" style="background:${r.sector==='cash'?'#64748b':(r.sector==='bond'?'#0ea5e9':(r.sector==='crypto'?'#f97316':'#4f7cff'))}">
                      ${r.ticker.slice(0,2)}
                    </div>
                    <div>
                      <div style="font-weight:800;font-size:16px">${r.ticker}</div>
                      <div class="mini muted">${r.name}</div>
                    </div>
                  </div>
                  <span class="pill pill-green">${r.urgency || 'Рекомендуем'}</span>
                </div>
                ${r.source ? `<div class="mini pill" style="background:rgba(255,255,255,0.06);margin-bottom:8px">📡 ${r.source}</div>` : ''}
                <div style="padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);margin-bottom:10px">
                  <div class="mini muted">Ожидаемая доходность / Эффект:</div>
                  <div style="font-weight:700;color:var(--accent);font-size:14px;margin-top:2px">${r.expectedReturn}</div>
                </div>
                <p class="mini muted" style="line-height:1.5;margin-bottom:12px">${r.reason}</p>
              </div>
              <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <span class="mini muted">Целевой вес: <b>${r.targetWeight || '10%'}</b></span>
                <button class="btn btn-primary btn-sm" data-buy-rec="${r.ticker}">Купить ${r.ticker}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // 4. News Feed & Polymarket Section
    let filteredNews = newsFeed;
    if (currentFilterTab === 'bfm') filteredNews = newsFeed.filter(n => n.source.includes('Бизнес ФМ'));
    if (currentFilterTab === 'politics') filteredNews = newsFeed.filter(n => n.category === 'politics');
    if (currentFilterTab === 'crypto') filteredNews = newsFeed.filter(n => n.category === 'crypto');

    const newsTabHtml = `
      <div class="grid grid-2" style="margin-top:24px">
        <!-- NEWS FEED -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="font-weight:800">📻 Лента новостей Бизнес ФМ & Макро</h3>
              <p class="mini muted">Анализ событий в режиме реального времени</p>
            </div>
            <div class="tabs" data-tabs="newsFilter">
              <button class="tab ${currentFilterTab==='all'?'active':''}" data-news-tab="all">Все</button>
              <button class="tab ${currentFilterTab==='bfm'?'active':''}" data-news-tab="bfm">Бизнес ФМ</button>
              <button class="tab ${currentFilterTab==='politics'?'active':''}" data-news-tab="politics">Политика</button>
            </div>
          </div>
          <div style="display:grid;gap:12px">
            ${filteredNews.map(n => `
              <div style="padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span class="pill pill-blue">${n.source}</span>
                  <span class="mini muted">${n.date}</span>
                </div>
                <h4 style="font-weight:700;font-size:14px;margin-bottom:4px;line-height:1.3">${n.title}</h4>
                <p class="mini muted" style="line-height:1.4;margin-bottom:8px">${n.summary}</p>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                  <div style="display:flex;gap:4px">
                    ${n.impactedTickers.map(t => `<span class="mini pill" style="background:rgba(255,255,255,0.06)">${t}</span>`).join('')}
                  </div>
                  ${n.recommendation ? `
                    <button class="btn-ghost btn-sm" data-buy-rec="${n.recommendation.tickers[0]}" style="font-size:11px;border:1px solid var(--border)">
                      Купить ${n.recommendation.tickers[0]} →
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- POLYMARKET PREDICTION MARKETS -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <h3 style="font-weight:800">🎲 Polymarket — Рынок предсказаний</h3>
              <p class="mini muted">Вероятности ключевых экономических и политических событий</p>
            </div>
            <span class="pill pill-green">Live API</span>
          </div>
          <div style="display:grid;gap:12px">
            ${polymarketEvents.map(p => `
              <div style="padding:14px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span class="mini muted">Объем ставок: ${p.volume}</span>
                  <span class="pill ${p.change24h>=0?'pill-green':'pill-red'}">${p.change24h>=0?'+':''}${p.change24h}% за 24ч</span>
                </div>
                <h4 style="font-weight:700;font-size:14px;margin-bottom:8px">${p.title}</h4>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span class="mini muted">Вероятность исхода:</span>
                  <b style="color:var(--accent);font-size:16px">${p.probability}% YES</b>
                </div>
                <div class="progress" style="margin-bottom:10px">
                  <div class="progress-bar" style="width:${p.probability}%;background:linear-gradient(90deg, var(--accent), #22c55e)"></div>
                </div>
                <p class="mini muted" style="line-height:1.4;margin-bottom:8px"><b>Влияние:</b> ${p.impact}</p>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="display:flex;gap:4px">
                    ${p.recommendedTickers.map(t => `<span class="mini pill pill-blue">${t}</span>`).join('')}
                  </div>
                  <button class="btn btn-primary btn-sm" data-buy-rec="${p.recommendedTickers[0]}">
                    Купить ${p.recommendedTickers[0]}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = scenarioHtml + exposureHtml + recCardsHtml + newsTabHtml;

    // Attach event listeners inside the view
    attachSignalsEvents(container);
  }

  function attachSignalsEvents(container) {
    // Scenario Chips
    container.querySelectorAll('[data-scenario]').forEach(chip => {
      chip.addEventListener('click', () => {
        const sc = chip.dataset.scenario;
        currentScenario = (currentScenario === sc) ? null : sc;
        renderNewsView();
        if (window.app && window.app.toast) {
          window.app.toast(currentScenario ? `Активирован сценарий: ${SCENARIOS[currentScenario].title}` : 'Возврат к живой ленте новостей');
        }
      });
    });

    // Reset Scenario
    document.getElementById('btnResetScenario')?.addEventListener('click', () => {
      currentScenario = null;
      renderNewsView();
    });

    // News Filter Tabs
    container.querySelectorAll('[data-news-tab]').forEach(tab => {
      chipTab = tab;
      tab.addEventListener('click', () => {
        currentFilterTab = tab.dataset.newsTab;
        renderNewsView();
      });
    });

    // Buy Recommendation Buttons
    container.querySelectorAll('[data-buy-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.dataset.buyRec;
        const marketItem = (window.TINVEST_DATA.MARKET || []).find(m => m.ticker === ticker) || { ticker, name: ticker, price: 100 };
        if (window.app && window.app.openBuyModal) {
          window.app.openBuyModal(marketItem);
        }
      });
    });

    // Custom News Modal trigger
    document.getElementById('btnAddCustomNewsBtn')?.addEventListener('click', () => {
      const headline = prompt('Введите заголовок новости или политического события (например: «ЦБ решает снизить ставку до 16%»):');
      if (headline && headline.trim()) {
        const newNewsItem = {
          id: 'news_custom_' + Date.now(),
          source: 'Пользовательское событие',
          category: 'macro',
          title: headline.trim(),
          summary: 'Пользовательский сценарий для AI-анализа воздействия на рынок и портфель.',
          date: 'Только что',
          urgency: 'high',
          sentiment: 'bullish',
          impactedTickers: ['LQDT', 'SBER', 'TMOS'],
          recommendation: {
            action: 'buy',
            tickers: ['TMOS', 'SBER'],
            reason: 'Анализ пользовательского события указывает на позитивный импульс для широкого индекса акций.'
          }
        };
        newsFeed.unshift(newNewsItem);
        renderNewsView();
        if (window.app && window.app.toast) {
          window.app.toast('Событие добавлено в AI-анализатор');
        }
      }
    });
  }

  function renderDashboardNewsWidget() {
    const el = document.getElementById('dashNewsWidget');
    if (!el) return;

    const recs = getBaseRecommendations().slice(0, 3);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="font-weight:700">📻 Сигналы Бизнес ФМ & Polymarket</h3>
          <span class="pill pill-green">Live AI</span>
        </div>
        <a href="#" class="mini muted" data-view-trigger="signals">Все новости & сигналы →</a>
      </div>
      <div style="display:grid;gap:8px">
        ${recs.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;background:var(--bg2);border:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(79,124,255,0.12);color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:12px">
                ${r.ticker.slice(0,2)}
              </div>
              <div>
                <div style="font-weight:700;font-size:13px">${r.ticker} — ${r.name}</div>
                <div class="mini muted">${r.reason.slice(0, 65)}...</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" data-buy-rec="${r.ticker}">Купить</button>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('[data-buy-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.dataset.buyRec;
        const marketItem = (window.TINVEST_DATA.MARKET || []).find(m => m.ticker === ticker) || { ticker, name: ticker, price: 100 };
        if (window.app && window.app.openBuyModal) {
          window.app.openBuyModal(marketItem);
        }
      });
    });
  }

  // Expose news module
  window.TINVEST_NEWS = {
    renderNewsView,
    renderDashboardNewsWidget,
    calcPortfolioExposure,
    getBaseRecommendations
  };
})();
