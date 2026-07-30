(function() {
const FX = { USD_RUB: 92.4, EUR_RUB: 100.2 };

const SECTORS = {
  tech: { label: 'Технологии', color: '#4f7cff' },
  finance: { label: 'Финансы', color: '#22c55e' },
  energy: { label: 'Энергетика', color: '#f59e0b' },
  consumer: { label: 'Потребительский', color: '#ec4899' },
  etf: { label: 'ETF', color: '#8b5cf6' },
  bond: { label: 'Облигации', color: '#06b6d4' },
  crypto: { label: 'Крипто', color: '#f97316' },
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
  { ticker:'VOO', name:'Vanguard S&P 500', price:512.3, change:0.62, sector:'etf', type:'etf', cap:'450B', icon:'V', color:'#6b21a8' },
  { ticker:'TMOS', name:'Тинькофф iMOEX', price:7.42, change:0.95, sector:'etf', type:'etf', cap:'82B RUB', icon:'И', color:'#ffdd2d' },
  { ticker:'BTC', name:'Bitcoin', price:68240, change:3.21, sector:'crypto', type:'crypto', cap:'1.34T', icon:'₿', color:'#f7931a' },
  { ticker:'ETH', name:'Ethereum', price:3840, change:1.88, sector:'crypto', type:'crypto', cap:'460B', icon:'Ξ', color:'#627eea' },
  { ticker:'SOL', name:'Solana', price:172.4, change:5.42, sector:'crypto', type:'crypto', cap:'80B', icon:'S', color:'#9945ff' },
  { ticker:'SU26238', name:'ОФЗ 26238', price:68.42, change:0.12, sector:'bond', type:'bond', cap:'-', icon:'О', color:'#0ea5e9' },
  { ticker:'LQDT', name:'Ликвидность', price:1432, change:0.02, sector:'cash', type:'etf', cap:'210B RUB', icon:'₽', color:'#64748b' },
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

// Keep the app usable when index.html is opened directly from the filesystem.
// (ES modules are blocked by CORS on file:// URLs in most browsers.)
window.TINVEST_DATA = { MARKET, DEFAULT_HOLDINGS, FX, SECTORS, generateHistory };
})();
