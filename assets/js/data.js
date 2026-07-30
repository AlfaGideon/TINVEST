(function() {
const FX = { USD_RUB: 78.7, EUR_RUB: 89.63 };

const SECTORS = {
  tech: { label: 'Технологии', color: '#4f7cff' },
  finance: { label: 'Финансы', color: '#22c55e' },
  energy: { label: 'Энергетика', color: '#f59e0b' },
  consumer: { label: 'Потребительский', color: '#ec4899' },
  etf: { label: 'ETF', color: '#8b5cf6' },
  bond: { label: 'Облигации', color: '#06b6d4' },
  crypto: { label: 'Крипто', color: '#f97316' },
  realestate: { label: 'Недвижимость', color: '#8b5cf6' },
  cash: { label: 'Кэш', color: '#64748b' }
};

const MARKET = [
  { ticker:'NVDA', name:'NVIDIA Corp', price:184.72, change:2.34, sector:'tech', type:'stock', cap:'2.8T', icon:'N', color:'#76b900' },
  { ticker:'AAPL', name:'Apple Inc', price:227.48, change:-0.42, sector:'tech', type:'stock', cap:'3.4T', icon:'A', color:'#000' },
  { ticker:'MSFT', name:'Microsoft', price:428.15, change:0.83, sector:'tech', type:'stock', cap:'3.1T', icon:'M', color:'#0078d4' },
  { ticker:'SBER', name:'Сбербанк', price:312.4, change:1.12, sector:'finance', type:'stock', cap:'7.1T RUB', icon:'СБ', color:'#21a038' },
  { ticker:'YDEX', name:'Яндекс', price:4125, change:-0.87, sector:'tech', type:'stock', cap:'1.5T RUB', icon:'Я', color:'#ff0000' },
  { ticker:'TCSG', name:'Тинькофф', price:3240, change:2.01, sector:'finance', type:'stock', cap:'0.6T RUB', icon:'Т', color:'#ffdd2d' },
  { ticker:'LKOH', name:'Лукойл', price:7420, change:0.45, sector:'energy', type:'stock', cap:'5.2T RUB', icon:'Л', color:'#e30613' },
  { ticker:'GAZP', name:'Газпром', price:128.4, change:-0.32, sector:'energy', type:'stock', cap:'3.0T RUB', icon:'Г', color:'#007cc2' },
  { ticker:'WUSH', name:'Whoosh', price:211.5, change:1.24, sector:'consumer', type:'stock', cap:'23.5B RUB', icon:'W', color:'#ffcc00' },
  { ticker:'MGNT', name:'Магнит', price:5920, change:0.45, sector:'consumer', type:'stock', cap:'0.6T RUB', icon:'М', color:'#e30613' },
  { ticker:'MTSS', name:'МТС', price:288.4, change:0.12, sector:'tech', type:'stock', cap:'0.5T RUB', icon:'МТ', color:'#ff0000' },
  { ticker:'GMKN', name:'Норникель', price:148.2, change:-0.87, sector:'energy', type:'stock', cap:'2.3T RUB', icon:'НК', color:'#004a99' },
  { ticker:'ROSN', name:'Роснефть', price:562.4, change:0.65, sector:'energy', type:'stock', cap:'6.0T RUB', icon:'Р', color:'#ffcc00' },
  { ticker:'VOO', name:'Vanguard S&P 500', price:512.3, change:0.62, sector:'etf', type:'etf', cap:'450B', icon:'V', color:'#6b21a8' },
  { ticker:'TMOS', name:'Тинькофф iMOEX', price:7.42, change:0.95, sector:'etf', type:'etf', cap:'82B RUB', icon:'И', color:'#ffdd2d' },
  { ticker:'BTC', name:'Bitcoin', price:68240, change:3.21, sector:'crypto', type:'crypto', cap:'1.34T', icon:'₿', color:'#f7931a' },
  { ticker:'ETH', name:'Ethereum', price:3840, change:1.88, sector:'crypto', type:'crypto', cap:'460B', icon:'Ξ', color:'#627eea' },
  { ticker:'SOL', name:'Solana', price:172.4, change:5.42, sector:'crypto', type:'crypto', cap:'80B', icon:'S', color:'#9945ff' },
  { ticker:'SU26238', name:'ОФЗ 26238', price:68.42, change:0.12, sector:'bond', type:'bond', cap:'-', icon:'О', color:'#0ea5e9' },
  { ticker:'LQDT', name:'Ликвидность', price:1432, change:0.02, sector:'cash', type:'etf', cap:'210B RUB', icon:'₽', color:'#64748b' },
  { ticker:'SU29014', name:'ОФЗ 29014 (Флоатер)', price:100.2, change:0.05, sector:'bond', type:'bond', cap:'-', icon:'ФЛ', color:'#0ea5e9' },
  { ticker:'PLZL', name:'Полюс Золото', price:13420, change:1.85, sector:'energy', type:'stock', cap:'1.8T RUB', icon:'ПЗ', color:'#f59e0b' },
  { ticker:'GLDRUB', name:'Физическое Золото', price:7450, change:1.12, sector:'bond', type:'otc', cap:'-', icon:'Au', color:'#f59e0b' },
  { ticker:'NVTK', name:'Новатэк', price:1085, change:0.65, sector:'energy', type:'stock', cap:'3.2T RUB', icon:'НТ', color:'#007cc2' },
  { ticker:'TATN', name:'Татнефть', price:642, change:1.05, sector:'energy', type:'stock', cap:'1.5T RUB', icon:'ТН', color:'#10b981' },
  { ticker:'TKVM', name:'Кв. метры (TKVM)', price:7.04, change:0.85, sector:'realestate', type:'otc', cap:'-', icon:'TK', color:'#8b5cf6' },
  { ticker:'REITX', name:'Недвижимость OTC', price:8450, change:-0.12, sector:'realestate', type:'otc', cap:'-', icon:'RE', color:'#8b5cf6' },
  { ticker:'BONDOTC', name:'Облигация внебирж.', price:987, change:0.05, sector:'bond', type:'otc', cap:'-', icon:'BO', color:'#06b6d4' },
];

const DEFAULT_HOLDINGS = [];

function generateHistory(baseValue, months=24, volatility=0.045, trend=0.008){
  const now = Date.now();
  let val = baseValue;
  const data=[];
  const labels=[];
  // seeded random based on baseValue to keep chart stable
  let seed = Math.round(baseValue);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for(let i=months;i>=0;i--){
    const d = new Date(now);
    d.setMonth(d.getMonth()-i);
    labels.push(d.toLocaleDateString('ru-RU',{month:'short',year:'2-digit'}));
    val = val * (1 + trend + (random()-0.5)*volatility);
    data.push(Math.round(val));
  }
  return {labels, data};
}

const NEWS_FEED = [
  {
    id: 'news_1',
    source: 'Бизнес ФМ',
    category: 'macro',
    title: 'ЦБ РФ допускает сохранение высокой ключевой ставки на уровне 20–21% до конца года',
    summary: 'Регулятор отмечает сохраняющееся инфляционное давление. Банковский сектор увеличивает привлечение средств под высокую доходность.',
    date: 'Сегодня, 10:45',
    urgency: 'high',
    sentiment: 'neutral',
    impactedTickers: ['LQDT', 'SU26238', 'SBER', 'SU29014'],
    recommendation: {
      action: 'buy',
      tickers: ['LQDT', 'SU29014', 'SBER'],
      reason: 'При ставке 20%+ фонды денежного рынка (LQDT) дают капитализируемый доход ~20% без риска просадки тела, а флоатеры ОФЗ (SU29014) компенсируют инфляцию. Сбербанк фиксирует рекордный маржинальный доход.'
    }
  },
  {
    id: 'news_2',
    source: 'Интерфакс / Геополитика',
    category: 'politics',
    title: 'Геополитическая напряженность: золото обновляет исторические максимумы',
    summary: 'Мировые центральные банки продолжают активные закупки золота для диверсификации резервов и защиты от валютных барьеров.',
    date: 'Сегодня, 09:15',
    urgency: 'high',
    sentiment: 'bullish',
    impactedTickers: ['PLZL', 'GLDRUB', 'BTC'],
    recommendation: {
      action: 'buy',
      tickers: ['PLZL', 'GLDRUB'],
      reason: 'Золото (GLDRUB) и акции Полюса (PLZL) выступают надежным хеджем от геополитической волатильности и валютных рисков.'
    }
  },
  {
    id: 'news_3',
    source: 'Бизнес ФМ',
    category: 'commodities',
    title: 'ОПЕК+ сохраняет квоты: цены на нефть Brent превышают $82 за баррель',
    summary: 'Российские нефтяные компании демонстрируют высокий дивидендный поток и планируют рекордные промежуточные выплаты.',
    date: 'Вчера, 17:30',
    urgency: 'medium',
    sentiment: 'bullish',
    impactedTickers: ['LKOH', 'ROSN', 'TATN'],
    recommendation: {
      action: 'buy',
      tickers: ['LKOH', 'ROSN', 'TATN'],
      reason: 'Лукойл и Роснефть генерируют сильный свободный денежный поток с дивидендной доходностью 12–15% годовых.'
    }
  },
  {
    id: 'news_4',
    source: 'Ведомости',
    category: 'macro',
    title: 'Минфин расширяет налоговые стимулы для долгосрочных инвесторов (ИИС-3)',
    summary: 'Доступны вычеты до 400 000 рублей в год и полное освобождение инвестиционного дохода от НДФЛ после 5 лет.',
    date: 'Вчера, 14:10',
    urgency: 'low',
    sentiment: 'bullish',
    impactedTickers: ['TMOS', 'VOO', 'SU26238'],
    recommendation: {
      action: 'buy',
      tickers: ['TMOS'],
      reason: 'Фонд TMOS (iMOEX) на ИИС-3 дает двойной доход: налоговый вычет 13-15% в год плюс рост рос. рынка.'
    }
  },
  {
    id: 'news_5',
    source: 'РБК / Crypto',
    category: 'crypto',
    title: 'Институциональный приток в цифровые активы вырос до рекордных $2.4 млрд',
    summary: 'Регуляторная ясность и институциональные фонды создают устойчивый спрос на базовые криптовалюты.',
    date: 'Сегодня, 08:00',
    urgency: 'medium',
    sentiment: 'bullish',
    impactedTickers: ['BTC', 'ETH', 'SOL'],
    recommendation: {
      action: 'buy',
      tickers: ['BTC', 'ETH'],
      reason: 'Bitcoin остается защищенным от фиатной инфляции активом с ограничением эмиссии. Целесообразно выделить 5-10% капитала.'
    }
  }
];

const POLYMARKET_EVENTS = [
  {
    id: 'poly_1',
    title: 'Сохранение / повышение ключевой ставки ЦБ РФ выше 20% в 2026',
    category: 'macro',
    probability: 84,
    change24h: 3.5,
    volume: '$1.4M',
    description: 'Оценка рынком вероятности продолжения ультра-жесткой денежно-кредитной политики Банком России.',
    impact: 'Высокая ставка сдерживает компании с долгом, но делает критически привлекательными LQDT, флоатеры и Сбербанк.',
    recommendedTickers: ['LQDT', 'SU29014', 'SBER']
  },
  {
    id: 'poly_2',
    title: 'Цена нефти Brent за баррель > $85 в Q3/Q4',
    category: 'commodities',
    probability: 76,
    change24h: -1.2,
    volume: '$2.8M',
    description: 'Вероятность удержания высоких цен на энергоносители благодаря ограничениям ОПЕК+.',
    impact: 'Сильный дивидендный фактор для Лукойла, Роснефти и Татнефти.',
    recommendedTickers: ['LKOH', 'ROSN', 'TATN']
  },
  {
    id: 'poly_3',
    title: 'Достижение цены Bitcoin $100,000 до конца года',
    category: 'crypto',
    probability: 69,
    change24h: 4.8,
    volume: '$8.2M',
    description: 'Оценка глобальными инвесторами вероятности продолжения бычьего цикла крипторынка.',
    impact: 'Бычий сигнал для BTC и криптосектора. Рекомендуется лесенка покупок.',
    recommendedTickers: ['BTC', 'SOL']
  },
  {
    id: 'poly_4',
    title: 'Восстановление индекса Мосбиржи (IMOEX) выше 3300 пунктов',
    category: 'macro',
    probability: 62,
    change24h: 2.1,
    volume: '$950K',
    description: 'Оценка вероятности роста широкого рынка РФ на фоне реинвестирования дивидендов.',
    impact: 'Благоприятно для широких фондов (TMOS) и IT-сектора (Яндекс).',
    recommendedTickers: ['TMOS', 'YDEX']
  }
];

// Keep the app usable when index.html is opened directly from the filesystem.
// (ES modules are blocked by CORS on file:// URLs in most browsers.)
window.TINVEST_DATA = { MARKET, DEFAULT_HOLDINGS, FX, SECTORS, generateHistory, NEWS_FEED, POLYMARKET_EVENTS };
})();
