import { MARKET, DEFAULT_HOLDINGS, FX, SECTORS, generateHistory } from './data.js';

const STORAGE_KEY = 'tinvest_v2';
let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      return {
        holdings: parsed.holdings || DEFAULT_HOLDINGS,
        transactions: parsed.transactions || genTransactions(DEFAULT_HOLDINGS),
        watchlist: parsed.watchlist || ['NVDA','BTC','TMOS','SBER'],
        goals: parsed.goals || [
          { id:'g1', name:'На квартиру', target:8000000, current:1240000, date:'2028-12-31', icon:'🏠' },
          { id:'g2', name:'Подушка безопасности', target:600000, current:420000, date:'2025-12-31', icon:'🛟' },
          { id:'g3', name:'FIRE – 25 млн', target:25000000, current:2870000, date:'2035-06-01', icon:'🔥' },
        ],
        settings:{ currency:'RUB', showRUB:true }
      };
    }
  }catch(e){console.warn(e)}
  return {
    holdings: JSON.parse(JSON.stringify(DEFAULT_HOLDINGS)),
    transactions: genTransactions(DEFAULT_HOLDINGS),
    watchlist:['NVDA','BTC','TMOS','SBER'],
    goals:[
      { id:'g1', name:'На квартиру', target:8000000, current:1240000, date:'2028-12-31', icon:'🏠' },
      { id:'g2', name:'Подушка безопасности', target:600000, current:420000, date:'2025-12-31', icon:'🛟' },
      { id:'g3', name:'FIRE – 25 млн', target:25000000, current:2870000, date:'2035-06-01', icon:'🔥' },
    ],
    settings:{ currency:'RUB', showRUB:true }
  };
}

function genTransactions(holdings){
  const tx=[];
  const now=Date.now();
  holdings.forEach(h=>{
    const qty = Math.floor(h.qty*0.6) || 1;
    tx.push({id:'tx_'+Math.random().toString(36).slice(2,9), ticker:h.ticker, type:'buy', qty, price:h.avgPrice*0.92, date:new Date(now-1000*60*60*24*90).toISOString(), total:qty*h.avgPrice*0.92});
    tx.push({id:'tx_'+Math.random().toString(36).slice(2,9), ticker:h.ticker, type:'buy', qty:h.qty-qty, price:h.avgPrice*1.04, date:new Date(now-1000*60*60*24*30).toISOString(), total:(h.qty-qty)*h.avgPrice*1.04});
  });
  tx.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return tx;
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toRUB(holding){
  const price = holding.price;
  if(holding.currency==='USD') return price*FX.USD_RUB;
  if(holding.currency==='EUR') return price*FX.EUR_RUB;
  return price;
}
function totalMetrics(){
  let totalValueRUB=0, totalCostRUB=0, totalValueUSD=0;
  state.holdings.forEach(h=>{
    const v = h.qty*h.price;
    const c = h.qty*h.avgPrice;
    if(h.currency==='USD'){
      totalValueRUB+=v*FX.USD_RUB;
      totalCostRUB+=c*FX.USD_RUB;
      totalValueUSD+=v;
    }else{
      totalValueRUB+=v;
      totalCostRUB+=c;
      totalValueUSD+=v/FX.USD_RUB;
    }
  });
  const pnl = totalValueRUB-totalCostRUB;
  const pnlPct = totalCostRUB? (pnl/totalCostRUB*100):0;
  return { totalValueRUB, totalCostRUB, totalValueUSD, pnl, pnlPct };
}

function fmt(n, cur='RUB'){
  if(cur==='RUB') return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
  if(cur==='USD') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  return new Intl.NumberFormat('ru-RU').format(n);
}
function fmtPct(n){
  const s = n>=0?'+':'';
  return s+n.toFixed(2)+'%';
}

// DOM helpers
const $ = s=>document.querySelector(s);
const $$ = s=>document.querySelectorAll(s);

let charts={};

function init(){
  renderNav();
  bindEvents();
  renderAll();
  // Chartjs
  if(window.Chart){
    Chart.defaults.color='#92a0bd';
    Chart.defaults.borderColor='rgba(255,255,255,0.06)';
    Chart.defaults.font.family='Inter';
  }
  setTimeout(renderCharts, 80);
}

function renderNav(){
  $$('.nav-item[data-view]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      const view = el.dataset.view;
      $$('.nav-item').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      $$('.view').forEach(v=>v.classList.remove('active'));
      const target = document.getElementById('view-'+view);
      if(target) target.classList.add('active');
      if(window.innerWidth<=768) $('.sidebar').classList.remove('open');
      if(view==='dashboard') setTimeout(()=>renderCharts(true), 100);
      if(view==='portfolio') { renderPortfolio(); setTimeout(()=>renderAllocChart(true),100); }
      if(view==='analytics') setTimeout(()=>renderAnalyticCharts(),100);
      window.scrollTo(0,0);
    });
  });
}

function bindEvents(){
  $('#hamburger')?.addEventListener('click', ()=> $('.sidebar').classList.toggle('open'));
  $('#closeSidebar')?.addEventListener('click', ()=> $('.sidebar').classList.remove('open'));
  $('#searchInput')?.addEventListener('input', (e)=> renderMarkets(e.target.value));
  $('#currencyToggle')?.addEventListener('click', ()=>{
    state.settings.showRUB = !state.settings.showRUB;
    saveState(); renderAll();
  });

  // modal generic close
  $$('[data-close-modal]').forEach(el=>el.addEventListener('click', ()=> closeModals()));
  $$('.modal-overlay').forEach(ov=> ov.addEventListener('click', (e)=>{ if(e.target===ov) closeModals(); }));

  // add holding
  $('#btnAddHolding')?.addEventListener('click', ()=> openBuyModal());
  $('#btnAddHolding2')?.addEventListener('click', ()=> openBuyModal());
  $('#holdingForm')?.addEventListener('submit', handleBuySubmit);

  // market buy buttons delegated
  $('#marketsTable')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-buy]');
    if(btn){
      const ticker = btn.dataset.buy;
      const item = MARKET.find(m=>m.ticker===ticker);
      if(item) openBuyModal(item);
    }
    const wl = e.target.closest('[data-wl]');
    if(wl){
      toggleWatchlist(wl.dataset.wl);
    }
  });

  $('#watchlistGrid')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-buy]');
    if(btn){
      const item = MARKET.find(m=>m.ticker===btn.dataset.buy);
      if(item) openBuyModal(item);
    }
  });

  // compound calculators
  ['compoundInitial','compoundMonthly','compoundYears','compoundRate'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', calcCompound);
  });
  ['dcaAmount','dcaMonths','dcaGrowth'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', calcDCA);
  });
  ['goalTarget','goalCurrent','goalMonthly','goalRate'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', calcGoal);
  });

  $('#addGoalBtn')?.addEventListener('click', addGoal);
  $('#exportBtn')?.addEventListener('click', exportData);
  $('#importBtn')?.addEventListener('click', ()=> $('#importFile').click());
  $('#importFile')?.addEventListener('change', importData);
  $('#resetBtn')?.addEventListener('click', resetData);

  // goals container delegation
  $('#goalsGrid')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-goal]');
    if(del){
      state.goals = state.goals.filter(g=>g.id!==del.dataset.delGoal);
      saveState(); renderGoals();
    }
  });

  // holdings deletion
  $('#holdingsTable')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-holding]');
    if(del){
      if(confirm('Удалить актив из портфеля?')){
        state.holdings = state.holdings.filter(h=>h.id!==del.dataset.delHolding);
        saveState(); renderAll();
      }
    }
  });

  // tabs
  $$('.tabs[data-tabs] .tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      const group = tab.closest('.tabs');
      group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.tab;
      if(group.dataset.tabs==='markets'){
        renderMarkets($('#searchInput')?.value || '', type);
      }
      if(group.dataset.tabs==='perf'){
        renderPerfChart(type);
      }
    });
  });
}

function renderAll(){
  const m = totalMetrics();
  // topbar KPI
  $('#kpiTotal') && ($('#kpiTotal').textContent = state.settings.showRUB ? fmt(m.totalValueRUB,'RUB') : fmt(m.totalValueUSD,'USD'));
  $('#kpiPnL') && ($('#kpiPnL').textContent = (m.pnl>=0?'+':'')+fmt(m.pnl,'RUB'));
  $('#kpiPnL').className = 'pill '+(m.pnl>=0?'pill-green':'pill-red');
  $('#kpiPct') && ($('#kpiPct').textContent = fmtPct(m.pnlPct));
  $('#kpiPct').className = 'pill '+(m.pnlPct>=0?'pill-green':'pill-red');

  renderDashboard();
  renderPortfolio();
  renderMarkets($('#searchInput')?.value || '', document.querySelector('.tabs[data-tabs="markets"] .tab.active')?.dataset.tab || 'all');
  renderAnalytics();
  renderGoals();
  renderWatchlist();
  calcCompound();
  calcDCA();
  calcGoal();
}

function renderDashboard(){
  const m = totalMetrics();
  $('#dashTotal').textContent = state.settings.showRUB? fmt(m.totalValueRUB,'RUB'):fmt(m.totalValueUSD,'USD');
  $('#dashCost').textContent = fmt(m.totalCostRUB,'RUB');
  $('#dashPnlValue').textContent = fmt(m.pnl,'RUB');
  $('#dashPnlPct').textContent = fmtPct(m.pnlPct);
  $('#dashPnlPct').className = 'pill '+(m.pnlPct>=0?'pill-green':'pill-red');
  $('#dashCount').textContent = state.holdings.length+' активов';
  const diversification = calcDiversification();
  $('#dashRiskScore').textContent = diversification.score+'/100';
  $('#dashRiskLabel').textContent = diversification.label;
  $('#dashRiskBar').style.width = diversification.score+'%';

  // top holdings
  const sorted = [...state.holdings].sort((a,b)=> (b.qty*b.price) - (a.qty*a.price)).slice(0,4);
  $('#dashTopHoldings').innerHTML = sorted.map(h=>{
    const val = h.qty*h.price;
    const valRUB = h.currency==='USD'? val*FX.USD_RUB : val;
    const pct = totalMetrics().totalValueRUB? (valRUB/totalMetrics().totalValueRUB*100):0;
    const pnl = ((h.price-h.avgPrice)/h.avgPrice*100);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div class="asset-cell"><div class="asset-icon" style="background:${h.color}">${h.icon}</div><div><div style="font-weight:600">${h.ticker}</div><div class="mini muted">${h.name}</div></div></div>
      <div style="text-align:right"><div style="font-weight:700">${state.settings.showRUB? fmt(valRUB,'RUB'):fmt(val,'USD')}</div><div class="mini"><span class="pill ${pnl>=0?'pill-green':'pill-red'}" style="font-size:11px;padding:2px 6px">${fmtPct(pnl)}</span> <span class="muted">${pct.toFixed(1)}%</span></div></div>
    </div>`;
  }).join('');

  // insights
  const insights = generateInsights();
  $('#aiInsights').innerHTML = insights.map(ins=>`
    <div style="display:flex;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);margin-bottom:10px">
      <div style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;background:${ins.bg};color:${ins.color};font-size:18px">${ins.icon}</div>
      <div><div style="font-weight:600;font-size:13px;margin-bottom:4px">${ins.title}</div><div class="mini muted" style="line-height:1.4">${ins.text}</div></div>
    </div>
  `).join('');
}

function renderPortfolio(){
  const tbody = $('#holdingsTableBody');
  if(!tbody) return;
  const m = totalMetrics();
  tbody.innerHTML = state.holdings.map(h=>{
    const value = h.qty*h.price;
    const cost = h.qty*h.avgPrice;
    const pnl = value-cost;
    const pnlPct = cost? (pnl/cost*100):0;
    const valueRUB = h.currency==='USD'? value*FX.USD_RUB : value;
    const weight = m.totalValueRUB? (valueRUB/m.totalValueRUB*100):0;
    return `<tr>
      <td><div class="asset-cell"><div class="asset-icon" style="background:${h.color}">${h.icon}</div><div><div style="font-weight:600">${h.ticker}</div><div class="mini muted">${h.name}</div></div></div></td>
      <td>${SECTORS[h.sector]?.label || h.type}</td>
      <td>${h.qty}</td>
      <td>${h.currency==='USD'? fmt(h.avgPrice,'USD'): fmt(h.avgPrice,'RUB')} → ${h.currency==='USD'? fmt(h.price,'USD'): fmt(h.price,'RUB')}</td>
      <td><b>${fmt(valueRUB,'RUB')}</b><div class="mini muted">${fmt(value,'USD')} • ${weight.toFixed(1)}%</div></td>
      <td><span class="pill ${pnl>=0?'pill-green':'pill-red'}">${fmtPct(pnlPct)}</span><div class="mini muted">${fmt(pnl,'RUB')}</div></td>
      <td><button class="btn-ghost btn-sm" data-del-holding="${h.id}" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border)">✕</button></td>
    </tr>`;
  }).join('');

  // transactions
  const txBody = $('#txTableBody');
  if(txBody){
    txBody.innerHTML = state.transactions.slice(0,30).map(tx=>{
      return `<tr>
        <td>${new Date(tx.date).toLocaleDateString('ru-RU')}</td>
        <td><b>${tx.ticker}</b> <span class="mini pill ${tx.type==='buy'?'pill-green':'pill-red'}" style="margin-left:6px">${tx.type==='buy'?'Покупка':'Продажа'}</span></td>
        <td>${tx.qty}</td>
        <td>${fmt(tx.price, 'RUB')}</td>
        <td>${fmt(tx.total,'RUB')}</td>
      </tr>`;
    }).join('');
  }
}

function renderMarkets(filter='', type='all'){
  let list = MARKET;
  if(type!=='all'){
    list = list.filter(m=>m.type===type);
  }
  if(filter){
    const q = filter.toLowerCase();
    list = list.filter(m=> m.ticker.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }
  const tbody = $('#marketsTableBody');
  if(!tbody) return;
  tbody.innerHTML = list.map(m=>{
    const inWl = state.watchlist.includes(m.ticker);
    return `<tr>
      <td><div class="asset-cell"><div class="asset-icon" style="background:${m.color}">${m.icon}</div><div><div style="font-weight:700">${m.ticker}</div><div class="mini muted">${m.name}</div></div></div></td>
      <td><span class="pill" style="background:rgba(255,255,255,0.06);color:var(--text2);border:1px solid var(--border)">${SECTORS[m.sector]?.label}</span></td>
      <td><b>${m.currency==='RUB' || ['SBER','YDEX','TCSG','LKOH','TMOS','SU26238','LQDT'].includes(m.ticker) ? fmt(m.price,'RUB'): fmt(m.price,'USD')}</b><div class="mini ${m.change>=0?'pill-green':'pill-red'}" style="display:inline-flex;margin-top:2px;padding:1px 6px;border-radius:10px;font-size:11px">${fmtPct(m.change)}</div></td>
      <td class="muted">${m.cap}</td>
      <td><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" data-buy="${m.ticker}">Купить</button><button class="btn-ghost btn-sm" data-wl="${m.ticker}" style="border:1px solid var(--border)">${inWl?'★':'☆'}</button></div></td>
    </tr>`;
  }).join('');

  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">🔍</div>Ничего не найдено по запросу "${filter}"</div></td></tr>`;
  }
}

function renderWatchlist(){
  const grid = $('#watchlistGrid');
  if(!grid) return;
  const items = MARKET.filter(m=> state.watchlist.includes(m.ticker));
  if(!items.length){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">⭐</div>Добавьте активы в избранное, нажимая ☆ в таблице рынков</div>`;
    return;
  }
  grid.innerHTML = items.map(m=>`
    <div class="card" style="padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="asset-cell"><div class="asset-icon" style="background:${m.color}">${m.icon}</div><div><b>${m.ticker}</b><div class="mini muted">${m.name}</div></div></div>
        <span class="pill ${m.change>=0?'pill-green':'pill-red'}">${fmtPct(m.change)}</span>
      </div>
      <div style="font-size:20px;font-weight:800">${fmt(m.price, m.ticker.match(/^[A-Z]+$/) && ['BTC','ETH','SOL','NVDA','AAPL','MSFT','VOO'].includes(m.ticker) ? 'USD':'RUB')}</div>
      <div class="mini muted" style="margin:6px 0 12px">Капитализация: ${m.cap}</div>
      <div style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" data-buy="${m.ticker}">Купить</button><button class="btn-ghost btn-sm" onclick="window.app.toggleWatchlist('${m.ticker}')" style="border:1px solid var(--border)">Удалить</button></div>
    </div>
  `).join('');
}

function renderAnalytics(){
  const m = totalMetrics();
  const div = calcDiversification();
  $('#analyScore').textContent = div.score;
  $('#analyLabel').textContent = div.label;
  $('#analyDesc').textContent = div.desc;
  $('#analyProgress').style.width = div.score+'%';

  // Sector breakdown
  const bySector={};
  state.holdings.forEach(h=>{
    const vRUB = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : h.qty*h.price;
    bySector[h.sector]=(bySector[h.sector]||0)+vRUB;
  });
  const total = Object.values(bySector).reduce((a,b)=>a+b,0);
  $('#sectorBreakdown').innerHTML = Object.entries(bySector).sort((a,b)=>b[1]-a[1]).map(([sec,val])=>{
    const pct = total? val/total*100:0;
    const info = SECTORS[sec]||{label:sec,color:'#888'};
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:10px;height:10px;border-radius:50%;background:${info.color}"></div><div style="flex:1"><div style="display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:600">${info.label}</span><span class="mini muted">${pct.toFixed(1)}% • ${fmt(val,'RUB')}</span></div><div class="progress" style="margin-top:6px"><div class="progress-bar" style="width:${pct}%;background:${info.color}"></div></div></div></div>`;
  }).join('');

  // Recommendations
  const recs = generateRecommendations();
  $('#recommendations').innerHTML = recs.map(r=>`
    <div style="padding:14px;border-radius:12px;background:linear-gradient(135deg, ${r.gradient});border:1px solid ${r.border};margin-bottom:10px">
      <div style="display:flex;gap:10px;align-items:flex-start"><div style="font-size:18px">${r.icon}</div><div><div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.title}</div><div class="mini" style="line-height:1.5;opacity:0.85">${r.text}</div>${r.action? `<button class="btn btn-sm" style="margin-top:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15)">${r.action}</button>`:''}</div></div>
    </div>
  `).join('');

  // risk
  const risk = calcRisk();
  $('#riskValue').textContent = risk.value.toFixed(1)+'/10';
  $('#riskPin').style.left = (risk.value*10)+'%';
  $('#riskLabel').textContent = risk.label;
  $('#riskDesc').textContent = risk.desc;
}

function calcDiversification(){
  const holdings = state.holdings;
  if(!holdings.length) return { score:0, label:'Пусто', desc:'Добавьте активы'};
  const total = holdings.reduce((s,h)=> s + (h.currency==='USD'? h.qty*h.price*FX.USD_RUB : h.qty*h.price),0);
  let hhi=0;
  holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : h.qty*h.price;
    const w = v/total;
    hhi+= w*w;
  });
  // hhi 0..1, lower better diversified
  const sectors = new Set(holdings.map(h=>h.sector)).size;
  const types = new Set(holdings.map(h=>h.type)).size;
  let score = Math.round((1 - hhi)*70 + Math.min(sectors/5,1)*15 + Math.min(types/4,1)*15);
  score = Math.max(5, Math.min(98,score));
  let label='Отлично диверсифицирован';
  let desc='Портфель сбалансирован по секторам и классам активов.';
  if(score<40){label='Высокая концентрация'; desc='Слишком много вложено в 1–2 актива. Рассмотрите ребалансировку.'}
  else if(score<65){label='Умеренная диверсификация'; desc='Хорошее начало, но можно добавить ETF и облигации.'}
  else if(score<85){label='Хорошо диверсифицирован'; desc='Большинство рисков распределены, можно fine-tune.'}
  return { score, label, desc, hhi };
}

function calcRisk(){
  const holdings = state.holdings;
  let riskScore=5;
  const cryptoWeight = holdings.filter(h=>h.sector==='crypto').reduce((s,h)=> s + (h.currency==='USD'? h.qty*h.price*FX.USD_RUB: h.qty*h.price),0);
  const total = holdings.reduce((s,h)=> s + (h.currency==='USD'? h.qty*h.price*FX.USD_RUB: h.qty*h.price),0);
  const cryptoPct = total? cryptoWeight/total*100:0;
  const singleMax = Math.max(...holdings.map(h=> (h.currency==='USD'? h.qty*h.price*FX.USD_RUB: h.qty*h.price)/ (total||1)*100),0);
  riskScore += cryptoPct*0.08;
  riskScore += singleMax>35? 1.5:0;
  riskScore += holdings.length<4?1:0;
  riskScore = Math.min(9.5, Math.max(2, riskScore));
  let label='Умеренный', desc='Сбалансированный риск-профиль, подходит для долгосрочного роста.';
  if(riskScore<3.5){label='Консервативный'; desc='Низкая волатильность, подходит для сохранения капитала.'}
  else if(riskScore>7){label='Агрессивный'; desc='Высокая волатильность, высокая потенциальная доходность, но и просадки.'}
  else if(riskScore>5.5){label='Умеренно-агрессивный'; desc='Смесь роста и защиты, ожидайте просадок до 20–25%.'}
  return { value:riskScore, label, desc };
}

function generateInsights(){
  const m = totalMetrics();
  const div = calcDiversification();
  const risk = calcRisk();
  const bySectorRatio = {};
  state.holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB: h.qty*h.price;
    bySectorRatio[h.sector]=(bySectorRatio[h.sector]||0)+v;
  });
  const total = Object.values(bySectorRatio).reduce((a,b)=>a+b,0);
  const techPct = total? ((bySectorRatio['tech']||0)/total*100):0;

  const insights=[];
  insights.push({
    icon:'📈', bg:'rgba(79,124,255,0.14)', color:'#8ea8ff',
    title:`Доходность ${fmtPct(m.pnlPct)}`,
    text:`Портфель стоит ${fmt(m.totalValueRUB,'RUB')}. Прибыль ${fmt(m.pnl,'RUB')} от вложенных ${fmt(m.totalCostRUB,'RUB')}.`
  });
  insights.push({
    icon:'🛡️', bg:'rgba(34,197,94,0.12)', color:'#22c55e',
    title: `${div.label} — ${div.score}/100`,
    text: div.desc
  });
  if(techPct>45){
    insights.push({
      icon:'⚠️', bg:'rgba(245,158,11,0.14)', color:'#f59e0b',
      title:'Перекос в технологии',
      text:`${techPct.toFixed(0)}% портфеля в Tech секторе. Исторически сектор волатилен — добавьте облигации или потребительский сектор.`
    });
  }
  insights.push({
    icon:'🎯', bg:'rgba(139,92,246,0.14)', color:'#a78bfa',
    title:`Риск-профиль: ${risk.label}`,
    text: risk.desc
  });
  return insights;
}

function generateRecommendations(){
  const m = totalMetrics();
  const recs=[];
  // cash
  const cashHolding = state.holdings.find(h=>h.ticker==='LQDT');
  const cashPct = cashHolding? (cashHolding.qty*cashHolding.price)/m.totalValueRUB*100:0;
  if(cashPct<5){
    recs.push({icon:'💧', title:'Низкая подушка', text:'Кэш менее 5% — нет запаса для просадок. Держите 10–15% в LQDT или ОФЗ для докупок.', gradient:'rgba(6,182,212,0.12), rgba(6,182,212,0.04)', border:'rgba(6,182,212,0.2)', action:'Купить LQDT'});
  }
  if(m.pnlPct>20){
    recs.push({icon:'💰', title:'Зафиксируйте часть прибыли', text:`Доходность ${m.pnlPct.toFixed(1)}% — выше рынка. Можно зафиксировать 15–20% в облигации, чтобы снизить риск.`, gradient:'rgba(34,197,94,0.14), rgba(34,197,94,0.06)', border:'rgba(34,197,94,0.2)', action:'Ребалансировать'});
  }
  const diversification = calcDiversification();
  if(diversification.score<60){
    recs.push({icon:'🧩', title:'Диверсифицируйте по ETF', text:'Добавьте TMOS (IMOEX) и VOO (S&P500). 2 фонда снижают HHI с '+diversification.hhi.toFixed(2)+' до ~0.18 и повысят устойчивость.', gradient:'rgba(139,92,246,0.14), rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.2)', action:'Добавить ETF'});
  }
  // moonshot
  recs.push({icon:'🤖', title:'AI модель: рост BTC', text:'On-chain метрики показывают накопление. Если BTC доля <10%, докупите лесенкой: 30% сейчас, 40% при -10%, 30% при -20%.', gradient:'rgba(249,115,22,0.14), rgba(249,115,22,0.05)', border:'rgba(249,115,22,0.25)', action:'План докупки'});
  recs.push({icon:'📚', title:'Налоговый лайфхак', text:'Используйте ИИС-3: вычет до 400к ₽ в год + освобождение от НДФЛ после 5 лет. Для вас экономия ≈ 52к ₽ ежегодно.', gradient:'rgba(79,124,255,0.14), rgba(79,124,255,0.05)', border:'rgba(79,124,255,0.2)', action:'Подробнее об ИИС'});

  return recs;
}

function renderGoals(){
  const grid = $('#goalsGrid');
  if(!grid) return;
  grid.innerHTML = state.goals.map(g=>{
    const pct = Math.min(100, g.current/g.target*100);
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;gap:10px;align-items:center"><div style="width:42px;height:42px;border-radius:12px;background:var(--card2);border:1px solid var(--border);display:grid;place-items:center;font-size:20px">${g.icon}</div><div><div style="font-weight:700">${g.name}</div><div class="mini muted">до ${new Date(g.date).toLocaleDateString('ru-RU')}</div></div></div>
        <button class="btn-ghost btn-sm" style="border:1px solid var(--border)" data-del-goal="${g.id}">✕</button>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="mini muted">${fmt(g.current,'RUB')}</span><span class="mini muted">${fmt(g.target,'RUB')}</span></div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px"><span class="pill pill-blue">${pct.toFixed(1)}%</span><span class="mini muted">Осталось ${fmt(g.target-g.current,'RUB')}</span></div>
    </div>`;
  }).join('');
}

let perfHistory=null;
function renderCharts(force=false){
  renderPerfChart(document.querySelector('.tabs[data-tabs="perf"] .tab.active')?.dataset.tab || '1Y', force);
  renderAllocChart(force);
}
function renderPerfChart(range='1Y', force=false){
  const canvas = $('#perfChart');
  if(!canvas) return;
  if(charts.perf && !force){ charts.perf.destroy(); }
  if(!perfHistory){
    const total = totalMetrics().totalValueRUB;
    perfHistory = {
      '1M': generateHistory(total, 1, 0.03, 0.015),
      '3M': generateHistory(total*0.92, 3, 0.04, 0.01),
      '1Y': generateHistory(total*0.78, 12, 0.05, 0.008),
      'ALL': generateHistory(total*0.55, 24, 0.06, 0.012)
    };
  }
  const hist = perfHistory[range] || perfHistory['1Y'];
  // benchmark S&P
  const benchData = hist.data.map((v,i)=> Math.round(v*(0.92 + i*0.002 + Math.sin(i)*0.01)));

  charts.perf = new Chart(canvas, {
    type:'line',
    data:{
      labels: hist.labels,
      datasets:[
        { label:'Портфель', data:hist.data, borderColor:'#4f7cff', backgroundColor:(ctx)=>{
          const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
          g.addColorStop(0,'rgba(79,124,255,0.28)');
          g.addColorStop(1,'rgba(79,124,255,0)');
          return g;
        }, fill:true, tension:0.4, borderWidth:2.5, pointRadius:0 },
        { label:'IMOEX', data:benchData, borderColor:'#92a0bd', borderDash:[6,6], backgroundColor:'transparent', tension:0.4, borderWidth:1.5, pointRadius:0 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      scales:{
        x:{ grid:{ display:false }, ticks:{ maxTicksLimit:8, color:'#5a6d95', font:{size:11} } },
        y:{ grid:{ color:'rgba(255,255,255,0.06)' }, ticks:{ color:'#5a6d95', callback:v=> (v/1000).toFixed(0)+'k', font:{size:11} } }
      },
      plugins:{ legend:{ display:true, labels:{ boxWidth:12, usePointStyle:true, color:'#92a0bd' } }, tooltip:{ backgroundColor:'#121a2b', titleColor:'#e6eaf2', bodyColor:'#92a0bd', borderColor:'#1e2d4a', borderWidth:1, padding:10, displayColors:true } }
    }
  });
}

function renderAllocChart(force=false){
  const canvas = $('#allocChart');
  if(!canvas) return;
  if(charts.alloc && !force){ charts.alloc.destroy(); }
  const byType={};
  state.holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : h.qty*h.price;
    byType[h.type]=(byType[h.type]||0)+v;
  });
  const labels = Object.keys(byType).map(k=> ({stock:'Акции', etf:'ETF Фонды', bond:'Облигации', crypto:'Крипта', cash:'Кэш'}[k]||k));
  const data = Object.values(byType);
  const colors = Object.keys(byType).map(k=> ({stock:'#4f7cff', etf:'#8b5cf6', bond:'#06b6d4', crypto:'#f97316', cash:'#64748b'}[k]||'#888'));

  charts.alloc = new Chart(canvas, {
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:0, hoverOffset:6 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      cutout:'68%',
      plugins:{ legend:{ position:'bottom', labels:{ color:'#92a0bd', padding:14, usePointStyle:true, font:{size:12} } }, tooltip:{ backgroundColor:'#121a2b', borderColor:'#1e2d4a', borderWidth:1 } }
    }
  });
}

function renderAnalyticCharts(){
  const c1 = $('#corrChart');
  if(c1 && !charts.corr){
    charts.corr = new Chart(c1, {
      type:'bar',
      data:{
        labels: state.holdings.map(h=>h.ticker),
        datasets:[{ label:'Корреляция с портфелем', data: state.holdings.map(()=> (Math.random()*0.4+0.5).toFixed(2)), backgroundColor:'#4f7cff', borderRadius:8 }]
      },
      options:{ responsive:true, maintainAspectRatio:false, scales:{ x:{ grid:{display:false}}, y:{ grid:{color:'rgba(255,255,255,0.06)'}, min:0, max:1 } }, plugins:{ legend:{display:false} } }
    });
  }
  const c2 = $('#growthChart');
  if(c2 && !charts.growth){
    const hist = generateHistory(totalMetrics().totalValueRUB, 36, 0.06, 0.009);
    charts.growth = new Chart(c2, {
      type:'line',
      data:{ labels:hist.labels, datasets:[{ data:hist.data, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.12)', fill:true, tension:0.4, borderWidth:2, pointRadius:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(255,255,255,0.06)'}}} }
    });
  }
}

// Modals
function openBuyModal(prefilled=null){
  $('#buyModal').classList.add('open');
  if(prefilled){
    $('#buyTicker').value = prefilled.ticker;
    $('#buyName').value = prefilled.name;
    $('#buyPrice').value = prefilled.price;
    $('#buyCurrency').value = ['SBER','YDEX','TCSG','LKOH','TMOS','SU26238','LQDT'].includes(prefilled.ticker) ? 'RUB':'USD';
  }else{
    $('#holdingForm').reset();
  }
}
function closeModals(){
  $$('.modal-overlay').forEach(m=>m.classList.remove('open'));
}
function handleBuySubmit(e){
  e.preventDefault();
  const ticker = $('#buyTicker').value.toUpperCase().trim();
  const name = $('#buyName').value.trim() || ticker;
  const qty = parseFloat($('#buyQty').value);
  const price = parseFloat($('#buyPrice').value);
  const currency = $('#buyCurrency').value;
  if(!ticker || !qty || !price) return alert('Заполните поля');
  const existingMarket = MARKET.find(m=>m.ticker===ticker) || {};
  const existing = state.holdings.find(h=>h.ticker===ticker);
  if(existing){
    const totalCost = existing.qty*existing.avgPrice + qty*price;
    const totalQty = existing.qty + qty;
    existing.avgPrice = totalCost/totalQty;
    existing.qty = totalQty;
    existing.price = price; // update to last
  }else{
    state.holdings.push({
      id:'h_'+Math.random().toString(36).slice(2,9),
      ticker, name, qty, price, avgPrice:price, currency,
      type: existingMarket.type || 'stock',
      sector: existingMarket.sector || 'tech',
      color: existingMarket.color || '#4f7cff',
      icon: existingMarket.icon || ticker.slice(0,2)
    });
  }
  state.transactions.unshift({
    id:'tx_'+Math.random().toString(36).slice(2,9),
    ticker, type:'buy', qty, price, total:qty*price, date:new Date().toISOString()
  });
  saveState(); renderAll(); closeModals();
  // small toast
  toast(`Куплено ${qty} ${ticker} по ${fmt(price, currency)}`);
}

function toggleWatchlist(ticker){
  if(state.watchlist.includes(ticker)){
    state.watchlist = state.watchlist.filter(t=>t!==ticker);
  }else{
    state.watchlist.push(ticker);
  }
  saveState(); renderMarkets($('#searchInput')?.value||'', document.querySelector('.tabs[data-tabs="markets"] .tab.active')?.dataset.tab || 'all'); renderWatchlist();
}

function calcCompound(){
  const P = parseFloat($('#compoundInitial')?.value)||0;
  const PMT = parseFloat($('#compoundMonthly')?.value)||0;
  const years = parseFloat($('#compoundYears')?.value)||0;
  const rate = parseFloat($('#compoundRate')?.value)||0;
  const r = rate/100/12;
  const n = years*12;
  let total = P*Math.pow(1+r,n);
  if(r!==0) total += PMT * ( (Math.pow(1+r,n)-1)/r );
  else total += PMT*n;
  const invested = P + PMT*n;
  const profit = total-invested;
  $('#compoundResult') && ($('#compoundResult').textContent = fmt(total,'RUB'));
  $('#compoundInvested') && ($('#compoundInvested').textContent = fmt(invested,'RUB'));
  $('#compoundProfit') && ($('#compoundProfit').textContent = fmt(profit,'RUB'));
  $('#compoundProfitPct') && ($('#compoundProfitPct').textContent = invested? fmtPct(profit/invested*100):'0%');
}

function calcDCA(){
  const amount = parseFloat($('#dcaAmount')?.value)||0;
  const months = parseFloat($('#dcaMonths')?.value)||0;
  const growth = parseFloat($('#dcaGrowth')?.value)||0;
  const monthlyRate = growth/100/12;
  let total=0;
  for(let i=0;i<months;i++){
    total = (total + amount) * (1+monthlyRate);
  }
  const invested = amount*months;
  $('#dcaResult').textContent = fmt(total,'RUB');
  $('#dcaInvested').textContent = fmt(invested,'RUB');
  $('#dcaProfit').textContent = fmt(total-invested,'RUB');
}

function calcGoal(){
  const target = parseFloat($('#goalTarget')?.value)||0;
  const current = parseFloat($('#goalCurrent')?.value)||0;
  const monthly = parseFloat($('#goalMonthly')?.value)||0;
  const rate = parseFloat($('#goalRate')?.value)||0;
  const r = rate/100/12;
  if(monthly<=0){
    $('#goalResult').textContent = 'Укажите платеж';
    return;
  }
  let months=0, bal=current;
  while(bal<target && months<600){
    bal = bal*(1+r)+monthly;
    months++;
  }
  if(months>=600) $('#goalResult').textContent='> 50 лет';
  else{
    const years = Math.floor(months/12);
    const remM = months%12;
    $('#goalResult').textContent = `${years>0? years+' г ':''}${remM} мес • ${fmt(bal,'RUB')}`;
  }
  $('#goalMonths').textContent = months+' мес';
}

function addGoal(){
  const name = $('#newGoalName').value.trim();
  const target = parseFloat($('#newGoalTarget').value);
  const current = parseFloat($('#newGoalCurrent').value)||0;
  const date = $('#newGoalDate').value;
  if(!name || !target) return alert('Введите название и цель');
  state.goals.push({ id:'g_'+Math.random().toString(36).slice(2,7), name, target, current, date:date||'2028-12-31', icon:'🎯' });
  saveState(); renderGoals();
  $('#newGoalName').value=''; $('#newGoalTarget').value=''; $('#newGoalCurrent').value='';
  toast('Цель добавлена');
}

function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='tinvest-portfolio-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  URL.revokeObjectURL(url);
}
function importData(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      if(parsed.holdings){ state=parsed; saveState(); renderAll(); toast('Импорт выполнен'); }
    }catch(err){ alert('Ошибка файла'); }
  };
  reader.readAsText(file);
}
function resetData(){
  if(confirm('Сбросить портфель к демо-данным?')){
    localStorage.removeItem(STORAGE_KEY);
    state=loadState();
    location.reload();
  }
}

function toast(msg){
  let t = $('#toast');
  if(!t){
    t=document.createElement('div');
    t.id='toast';
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#121a2b;border:1px solid #1e2d4a;color:#e6eaf2;padding:12px 18px;border-radius:12px;z-index:200;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-size:14px;font-weight:600;transition:all .24s';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(12px)'; }, 3000);
}

// expose
window.app={ toggleWatchlist, openBuyModal };

document.addEventListener('DOMContentLoaded', init);
