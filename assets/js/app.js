const { MARKET, DEFAULT_HOLDINGS, FX, SECTORS, generateHistory } = window.TINVEST_DATA;
let mergedMarket = [...MARKET];

const STORAGE_KEY = 'tinvest_v3'; // bumped to drop old demo-data snapshots
let state = loadState();

function loadState(){
  // Wipe legacy keys that contained baked-in demo holdings
  ['tinvest_v1','tinvest_v2'].forEach(k => {
    try { if(localStorage.getItem(k)) localStorage.removeItem(k); } catch(e){}
  });
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed.fx) {
        FX.USD_RUB = parsed.fx.USD_RUB || FX.USD_RUB;
        FX.EUR_RUB = parsed.fx.EUR_RUB || FX.EUR_RUB;
      }
      return {
        profile: parsed.profile || { name: 'Инвестор' },
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        settings: Object.assign({ currency:'RUB', showRUB:true }, parsed.settings || {}),
        fx: parsed.fx || { USD_RUB: FX.USD_RUB, EUR_RUB: FX.EUR_RUB }
      };
    }
  }catch(e){console.warn(e)}
  return {
    profile: { name: 'Инвестор' },
    holdings: [],
    transactions: [],
    watchlist: [],
    goals: [],
    settings: { currency:'RUB', showRUB:true },
    fx: { USD_RUB: FX.USD_RUB, EUR_RUB: FX.EUR_RUB }
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
  state.fx = { USD_RUB: FX.USD_RUB, EUR_RUB: FX.EUR_RUB };
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
    let vr = v;
    let cr = c;
    if(h.currency==='USD'){
      vr = v*FX.USD_RUB;
      cr = c*FX.USD_RUB;
    }else if(h.currency==='EUR'){
      vr = v*FX.EUR_RUB;
      cr = c*FX.EUR_RUB;
    }
    totalValueRUB+=vr;
    totalCostRUB+=cr;
    totalValueUSD+=vr/FX.USD_RUB;
  });
  const pnl = totalValueRUB-totalCostRUB;
  const pnlPct = totalCostRUB? (pnl/totalCostRUB*100):0;
  return { totalValueRUB, totalCostRUB, totalValueUSD, pnl, pnlPct };
}

function fmt(n, cur='RUB'){
  if(cur==='RUB') return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
  if(cur==='USD') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  if(cur==='EUR') return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
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
  updateLivePrices();
  updateFX();
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

  // exchange rate manual edit
  $('#sbUsdRow')?.addEventListener('click', ()=>{
    const val = prompt('Укажите курс USD/RUB (ЦБ или рыночный):', FX.USD_RUB);
    if(val && !isNaN(parseFloat(val))) {
      FX.USD_RUB = parseFloat(val);
      saveState(); renderAll();
    }
  });
  $('#sbEurRow')?.addEventListener('click', ()=>{
    const val = prompt('Укажите курс EUR/RUB (ЦБ или рыночный):', FX.EUR_RUB);
    if(val && !isNaN(parseFloat(val))) {
      FX.EUR_RUB = parseFloat(val);
      saveState(); renderAll();
    }
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
      const item = mergedMarket.find(m=>m.ticker===ticker);
      if(item) openBuyModal(item);
    }
    const wl = e.target.closest('[data-wl]');
    if(wl){
      toggleWatchlist(wl.dataset.wl);
    }
    const ob = e.target.closest('[data-orderbook]');
    if(ob){
      openOrderBook(ob.dataset.orderbook);
    }
  });

  $('#watchlistGrid')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-buy]');
    if(btn){
      const item = mergedMarket.find(m=>m.ticker===btn.dataset.buy);
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

  // Goal type tabs
  $$('.tabs[data-tabs="goalType"] .tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      const group = tab.closest('.tabs');
      group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.goalType;
      $('#goalFormCustom').style.display = type==='custom' ? 'block' : 'none';
      $('#goalFormRetirement').style.display = type==='retirement' ? 'block' : 'none';
      $('#goalFormDebt').style.display = type==='debt' ? 'block' : 'none';
    });
  });
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

  // holdings edit/deletion
  $('#holdingsTableBody')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-holding]');
    if(del){
      if(confirm('Удалить актив из портфеля?')){
        state.holdings = state.holdings.filter(h=>h.id!==del.dataset.delHolding);
        saveState(); renderAll();
      }
    }
    const edit = e.target.closest('[data-edit-holding]');
    if(edit){
      const h = state.holdings.find(x=>x.id===edit.dataset.editHolding);
      if(h){
         const newQty = prompt('Новое количество:', h.qty);
         if(newQty!==null && !isNaN(parseFloat(newQty))) h.qty = parseFloat(newQty);
         const newAvg = prompt('Новая средняя цена (покупки):', h.avgPrice);
         if(newAvg!==null && !isNaN(parseFloat(newAvg))) h.avgPrice = parseFloat(newAvg);
         const newPrice = prompt('Новая текущая цена рынка (для ручного обновления):', h.price);
         if(newPrice!==null && !isNaN(parseFloat(newPrice))) h.price = parseFloat(newPrice);
         saveState(); renderAll();
      }
    }
  });

  // alloc chips
  $('#allocChips')?.addEventListener('click', (e)=>{
    const chip = e.target.closest('[data-alloc]');
    if(!chip) return;
    $$('#allocChips .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    allocMode = chip.dataset.alloc;
    renderAllocChart(true);
  });

  // rebalance
  $('#btnRebalance')?.addEventListener('click', showRebalance);

  // notifications
  $('#btnNotifications')?.addEventListener('click', ()=>{
    const ins = generateInsights();
    toast(ins.length? ins[ins.length-1].title + ' — ' + ins[ins.length-1].text.slice(0,80) : 'Новых уведомлений нет');
  });

  // recommendation action buttons
  $('#recommendations')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-rec-action]');
    if(!btn) return;
    const action = btn.dataset.recAction;
    if(action==='Купить LQDT'){
      const item = mergedMarket.find(m=>m.ticker==='LQDT');
      if(item) openBuyModal(item);
    } else if(action==='Ребалансировать'){
      showRebalance();
    } else if(action==='Добавить ETF'){
      const item = mergedMarket.find(m=>m.ticker==='TMOS');
      if(item) openBuyModal(item);
    } else if(action==='План докупки'){
      const item = mergedMarket.find(m=>m.ticker==='BTC');
      if(item) openBuyModal(item);
    } else {
      toast('ИИС-3: вычет до 400 000 ₽ в год, льгота по НДФЛ после 5 лет.');
    }
  });

  // escape closes modal
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModals(); });

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
  renderProfile();
  renderSidebarLive();
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
  renderDividends();
  renderStressTest();
  calcCompound();
  calcDCA();
  calcGoal();
  perfHistory = null;
  if(charts.perf){ try{ charts.perf.destroy(); }catch(e){} charts.perf=null; }
  setTimeout(()=>renderPerfChart(document.querySelector('.tabs[data-tabs="perf"] .tab.active')?.dataset.tab || '1Y', true), 50);
  setTimeout(()=>renderAllocChart(true), 80);
}

function renderProfile(){
  const name = (state.profile && state.profile.name) || 'Инвестор';
  const nameEl = $('#userName');
  const subEl = $('#userSub');
  const avEl = $('#userAvatar');
  if(nameEl) nameEl.textContent = name;
  if(avEl) avEl.textContent = (name.trim()[0] || 'И').toUpperCase();
  const m = totalMetrics();
  const sub = state.holdings.length
    ? `${state.holdings.length} актив${state.holdings.length===1?'':(state.holdings.length<5?'а':'ов')} • ${fmt(m.totalValueRUB,'RUB')}`
    : 'Локальный профиль • LocalStorage';
  if(subEl) subEl.textContent = sub;
}

function renderSidebarLive(){
  const usd = $('#sbUsd'), eur = $('#sbEur'), btc = $('#sbBtc');
  const bar = $('#sbLiveBar'), lbl = $('#sbLiveLabel');
  if(usd) usd.textContent = FX.USD_RUB ? FX.USD_RUB.toFixed(2)+' ₽' : '—';
  if(eur) eur.textContent = FX.EUR_RUB ? FX.EUR_RUB.toFixed(2)+' ₽' : '—';
  const btcItem = mergedMarket.find(m=>m.ticker==='BTC');
  if(btc && btcItem){
    btc.textContent = '$'+Math.round(btcItem.price).toLocaleString('ru-RU');
    btc.style.color = btcItem.change>=0 ? '#22c55e' : '#ef4444';
  }
  if(bar) bar.style.width = '100%';
  if(lbl) lbl.textContent = 'Онлайн • MOEX • Binance • ЦБ';
}

function renderDashboard(){
  const m = totalMetrics();
  // Greeting
  const name = (state.profile && state.profile.name) || 'Инвестор';
  const hour = new Date().getHours();
  const greet = hour<6?'Доброй ночи':(hour<12?'Доброе утро':(hour<18?'Добрый день':'Добрый вечер'));
  const gT = $('#greetTitle'), gS = $('#greetSub');
  if(gT) gT.textContent = `${greet}, ${name} 👋`;
  if(gS){
    if(!state.holdings.length){
      gS.innerHTML = 'Портфель пока пуст. Нажмите <b style="color:var(--text)">«Купить»</b> вверху или откройте вкладку <b style="color:var(--text)">Рынки</b>, чтобы добавить первый актив.';
    } else {
      const diversification = calcDiversification();
      const risk = calcRisk();
      gS.innerHTML = `AI-коуч проанализировал портфель: <b style="color:var(--text)">диверсификация ${diversification.score}/100</b>, риск <b style="color:var(--text)">${risk.label.toLowerCase()}</b>. ${m.pnlPct>=0?'Портфель в плюсе.':'Портфель в просадке — держитесь.'}`;
    }
  }

  $('#dashTotal').textContent = state.settings.showRUB? fmt(m.totalValueRUB,'RUB'):fmt(m.totalValueUSD,'USD');
  $('#dashCost').textContent = fmt(m.totalCostRUB,'RUB');
  $('#dashPnlValue').textContent = fmt(m.pnl,'RUB');
  $('#dashPnlPct').textContent = fmtPct(m.pnlPct);
  $('#dashPnlPct').className = 'pill '+(m.pnlPct>=0?'pill-green':'pill-red');
  $('#dashCount').textContent = state.holdings.length+' активов';
  // sectors/types breakdown
  const sectors = new Set(state.holdings.map(h=>h.sector)).size;
  const types = new Set(state.holdings.map(h=>h.type)).size;
  const brk = $('#dashBreakdown');
  if(brk) brk.textContent = `${sectors} сектор${sectors===1?'':(sectors<5?'а':'ов')} • ${types} класс${types===1?'':(types<5?'а':'ов')}`;

  const diversification = calcDiversification();
  $('#dashRiskScore').textContent = diversification.score+'/100';
  $('#dashRiskLabel').textContent = ' ' + diversification.label;
  $('#dashRiskBar').style.width = diversification.score+'%';

  // top holdings
  const sorted = [...state.holdings].sort((a,b)=> (b.qty*b.price) - (a.qty*a.price)).slice(0,4);
  if(!sorted.length){
    $('#dashTopHoldings').innerHTML = '<div class="empty"><div class="empty-icon">💼</div>Портфель пуст. Нажмите «Купить» вверху или добавьте актив на вкладке «Рынки».</div>';
  }else
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
  if(!state.holdings.length){
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">💼</div>Пока нет активов. Нажмите «+ Сделка», чтобы добавить первый.</div></td></tr>';
  }else
  tbody.innerHTML = state.holdings.map(h=>{
    const value = h.qty*h.price;
    const cost = h.qty*h.avgPrice;
    const pnl = value-cost;
    const pnlPct = cost? (pnl/cost*100):0;
    
    let valueRUB = value;
    let valueUSD = value;
    if (h.currency === 'USD') {
      valueRUB = value * FX.USD_RUB;
    } else if (h.currency === 'EUR') {
      valueRUB = value * FX.EUR_RUB;
      valueUSD = valueRUB / FX.USD_RUB;
    } else {
      valueUSD = value / FX.USD_RUB;
    }

    let pnlRUB = pnl;
    if (h.currency === 'USD') {
      pnlRUB = pnl * FX.USD_RUB;
    } else if (h.currency === 'EUR') {
      pnlRUB = pnl * FX.EUR_RUB;
    }

    const weight = m.totalValueRUB? (valueRUB/m.totalValueRUB*100):0;
    return `<tr>
      <td><div class="asset-cell"><div class="asset-icon" style="background:${h.color}">${h.icon}</div><div><div style="font-weight:600">${h.ticker}</div><div class="mini muted">${h.name}</div></div></div></td>
      <td>${SECTORS[h.sector]?.label || h.type}</td>
      <td>${h.qty}</td>
      <td>${fmt(h.avgPrice, h.currency)} → ${fmt(h.price, h.currency)}</td>
      <td><b>${fmt(valueRUB,'RUB')}</b><div class="mini muted">${fmt(valueUSD,'USD')} • ${weight.toFixed(1)}%</div></td>
      <td><span class="pill ${pnl>=0?'pill-green':'pill-red'}">${fmtPct(pnlPct)}</span><div class="mini muted">${fmt(pnlRUB,'RUB')}</div></td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost btn-sm" data-edit-holding="${h.id}" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border)">✎</button>
          <button class="btn-ghost btn-sm" data-del-holding="${h.id}" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border)">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // transactions
  const txBody = $('#txTableBody');
  if(txBody){
    txBody.innerHTML = state.transactions.slice(0,30).map(tx=>{
      const txCurrency = tx.currency || (['SBER','YDEX','TCSG','LKOH','TMOS','SU26238','LQDT','GAZP','GMKN','ROSN','WUSH','MGNT','MTSS'].includes(tx.ticker) ? 'RUB' : 'USD');
      return `<tr>
        <td>${new Date(tx.date).toLocaleDateString('ru-RU')}</td>
        <td><b>${tx.ticker}</b> <span class="mini pill ${tx.type==='buy'?'pill-green':'pill-red'}" style="margin-left:6px">${tx.type==='buy'?'Покупка':'Продажа'}</span></td>
        <td>${tx.qty}</td>
        <td>${fmt(tx.price, txCurrency)}</td>
        <td>${fmt(tx.total, txCurrency)}</td>
      </tr>`;
    }).join('');
  }
}

function renderMarkets(filter='', type='all'){
  let list = mergedMarket;
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
      <td><b>${(m.currency && m.currency==='RUB') || ['SBER','YDEX','TCSG','LKOH','TMOS','SU26238','LQDT','GAZP','LKOH','WUSH','MGNT','MTSS','GMKN','ROSN'].includes(m.ticker) || !['NVDA','AAPL','MSFT','VOO','BTC','ETH','SOL'].includes(m.ticker) ? fmt(m.price,'RUB'): fmt(m.price,'USD')}</b><div class="mini ${m.change>=0?'pill-green':'pill-red'}" style="display:inline-flex;margin-top:2px;padding:1px 6px;border-radius:10px;font-size:11px">${fmtPct(m.change)}</div></td>
      <td class="muted">${m.cap}</td>
      <td><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" data-buy="${m.ticker}">Купить</button><button class="btn-ghost btn-sm" data-wl="${m.ticker}" style="border:1px solid var(--border)">${inWl?'★':'☆'}</button>${m.type==='otc'?`<button class="btn-ghost btn-sm" data-orderbook="${m.ticker}" style="border:1px solid var(--border);font-size:11px">Стакан</button>`:''}</div></td>
    </tr>`;
  }).join('');

  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">🔍</div>Ничего не найдено по запросу "${filter}"</div></td></tr>`;
  }
}

function renderWatchlist(){
  const grid = $('#watchlistGrid');
  if(!grid) return;
  const items = mergedMarket.filter(m=> state.watchlist.includes(m.ticker));
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
      <div style="font-size:20px;font-weight:800">${fmt(m.price, ['BTC','ETH','SOL','NVDA','AAPL','MSFT','VOO'].includes(m.ticker) ? 'USD':'RUB')}</div>
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
  if(!total){
    $('#sectorBreakdown').innerHTML = '<div class="empty"><div class="empty-icon">🧩</div>Нет активов для анализа секторов.</div>';
  }else
  $('#sectorBreakdown').innerHTML = Object.entries(bySector).sort((a,b)=>b[1]-a[1]).map(([sec,val])=>{
    const pct = total? val/total*100:0;
    const info = SECTORS[sec]||{label:sec,color:'#888'};
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:10px;height:10px;border-radius:50%;background:${info.color}"></div><div style="flex:1"><div style="display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:600">${info.label}</span><span class="mini muted">${pct.toFixed(1)}% • ${fmt(val,'RUB')}</span></div><div class="progress" style="margin-top:6px"><div class="progress-bar" style="width:${pct}%;background:${info.color}"></div></div></div></div>`;
  }).join('');

  // Recommendations
  const recs = generateRecommendations();
  $('#recommendations').innerHTML = recs.map(r=>`
    <div style="padding:14px;border-radius:12px;background:linear-gradient(135deg, ${r.gradient});border:1px solid ${r.border};margin-bottom:10px">
      <div style="display:flex;gap:10px;align-items:flex-start"><div style="font-size:18px">${r.icon}</div><div><div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.title}</div><div class="mini" style="line-height:1.5;opacity:0.85">${r.text}</div>${r.action? `<button class="btn btn-sm" data-rec-action="${r.action}" style="margin-top:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);cursor:pointer">${r.action}</button>`:''}</div></div>
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
  if(!holdings.length) return { score:0, label:'Пусто', desc:'Добавьте активы, чтобы рассчитать диверсификацию.', hhi:1 };
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
  if(!holdings.length) return { value:0, label:'Нет данных', desc:'Добавьте активы, чтобы оценить риск-профиль.' };
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
  const cashPct = (cashHolding && m.totalValueRUB)? (cashHolding.qty*cashHolding.price)/m.totalValueRUB*100:0;
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

function renderDividends(){
  const list = $('#dividendsList');
  if(!list) return;
  const divTickers = {
    SBER: { yield: 0.11, date: 'ближ. в дек', per: 33.3 },
    LKOH: { yield: 0.07, date: '2 раза/год', per: 450 },
    TCSG: { yield: 0.04, date: 'годовые', per: 90 },
    YDEX: { yield: 0, date: 'нет', per: 0 },
    'SU26238': { yield: 0.12, date: 'купоны 4×/год', per: 35, bond: true },
    VOO: { yield: 0.013, date: 'квартально', per: 1.65, usd: true },
  };
  const items = [];
  state.holdings.forEach(h=>{
    const t = divTickers[h.ticker];
    if(!t || !t.per) return;
    const income = h.qty * t.per;
    const cur = t.usd ? 'USD' : 'RUB';
    items.push({
      ticker: h.ticker, name: h.name,
      sub: t.date + (t.per ? ` • ${t.per} ${cur==='USD'?'$':'₽'}/шт` : ''),
      amount: income, cur
    });
  });
  if(!items.length){
    list.innerHTML = '<div class="empty" style="padding:18px"><div class="empty-icon">💸</div>Пока нет активов с прогнозируемыми выплатами. Добавьте дивидендные акции или ОФЗ.</div>';
    return;
  }
  list.innerHTML = items.map(it=>`
    <div style="display:flex;justify-content:space-between;padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">
      <div><b>${it.ticker}</b><div class="mini muted">${it.sub}</div></div>
      <b style="color:var(--green)">+${fmt(it.amount, it.cur)}/${it.cur==='USD'?'год':'год'}</b>
    </div>`).join('');
}

function renderStressTest(){
  const el = $('#stressTestList');
  if(!el) return;
  const m = totalMetrics();
  if(!state.holdings.length || !m.totalValueRUB){
    el.innerHTML = '<div class="mini muted">Добавьте активы, чтобы рассчитать сценарии.</div>';
    return;
  }
  // Compute weights per asset class
  const byType = {};
  state.holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : h.qty*h.price;
    byType[h.type] = (byType[h.type]||0) + v;
  });
  const tot = m.totalValueRUB || 1;
  const stockW = (byType.stock||0)/tot;
  const bondW  = (byType.bond||0)/tot + ((byType.etf||0)/tot)*0.3; // rough
  const cashW  = (byType.cash||0)/tot;
  const cryptoW= (byType.crypto||0)/tot;
  const scenarios = [
    { name:'Кризис 2008 (-50% акции, -30% crypto)', pct: -(stockW*50 + cryptoW*30 - bondW*5 - cashW*0) },
    { name:'Ковид 2020 (-33% акции, -40% crypto)', pct: -(stockW*33 + cryptoW*40 - bondW*3 - cashW*0) },
    { name:'Рост ставок +3%', pct: bondW*2 + cashW*1 - stockW*6 - cryptoW*8 },
  ];
  el.innerHTML = scenarios.map(s=>{
    const neg = s.pct<0;
    return `<div style="display:flex;justify-content:space-between;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border)">
      <span class="mini">${s.name}</span>
      <span class="mini pill ${neg?'pill-red':'pill-green'}">${s.pct>=0?'+':''}${s.pct.toFixed(1)}% портфеля</span>
    </div>`;
  }).join('');
}

function renderGoals(){
  const grid = $('#goalsGrid');
  const summary = $('#goalsSummary');
  const navBadge = $('#goalsNavBadge');
  const saved = state.goals.reduce((s,g)=>s+(+g.current||0),0);
  const target = state.goals.reduce((s,g)=>s+(+g.target||0),0);
  if(navBadge) navBadge.textContent = state.goals.length;
  if(summary){
    if(!state.goals.length) summary.textContent = '0 целей';
    else summary.textContent = `${state.goals.length} цел${state.goals.length===1?'ь':(state.goals.length<5?'и':'ей')} • ${fmt(saved,'RUB')} накоплено`;
  }
  if(!grid) return;
  if(!state.goals.length){
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:40px"><div class="empty-icon">🎯</div>Целей пока нет. Создайте первую цель ниже — выберите тип: своя, пенсия или закрытие долга.</div>';
    return;
  }
  grid.innerHTML = state.goals.map(g=>{
    if(g.goalType==='retirement'){
      const pct = g.target ? Math.min(100, g.current/g.target*100) : 0;
      const yearsLeft = g.currentAge && g.retAge ? g.retAge - g.currentAge : 0;
      return `<div class="card goal-card-retirement">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08));border:1px solid rgba(34,197,94,0.25);display:grid;place-items:center;font-size:20px">${g.icon||'🏖️'}</div><div><div style="font-weight:700">${g.name}</div><div class="mini muted">Пенсия ${fmt(g.pension,'RUB')}/мес • через ${yearsLeft} лет (в ${g.retAge||'?'})</div></div></div>
          <button class="btn-ghost btn-sm" style="border:1px solid var(--border)" data-del-goal="${g.id}">✕</button>
        </div>
        <div class="goal-metrics">
          <div class="goal-metric"><div class="goal-metric-label">Нужно капитала</div><div class="goal-metric-value">${fmt(g.requiredCapital||g.target,'RUB')}</div></div>
          <div class="goal-metric"><div class="goal-metric-label">Копить /мес</div><div class="goal-metric-value" style="color:var(--accent)">${fmt(g.monthlyNeeded||0,'RUB')}</div></div>
          <div class="goal-metric"><div class="goal-metric-label">Ставка изъятия</div><div class="goal-metric-value">${g.withdrawalRate||4}%</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="mini muted">Накоплено ${fmt(g.current,'RUB')}</span><span class="mini muted">${pct.toFixed(1)}%</span></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%;background:linear-gradient(90deg, #22c55e, #4ade80)"></div></div>
        <div class="mini muted" style="margin-top:8px;text-align:center">${g.monthlyNeeded>0 ? `Откладывая ${fmt(g.monthlyNeeded,'RUB')}/мес при ${g.expectedReturn||10}% годовых — достигнете к ${new Date(g.date).toLocaleDateString('ru-RU')}` : 'Цель достигнута!'}</div>
      </div>`;
    } else if(g.goalType==='debt'){
      const pctPaid = g.originalAmount ? Math.min(100, (g.debtPaid||0)/g.originalAmount*100) : 0;
      const remaining = Math.max(0, (g.debtAmount||0) - (g.debtPaid||0));
      const debtTypeLabels = {credit_card:'Кредитная карта', mortgage:'Ипотека', car_loan:'Автокредит', personal_loan:'Потреб. кредит', other:'Долг'};
      return `<div class="card goal-card-debt">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08));border:1px solid rgba(239,68,68,0.25);display:grid;place-items:center;font-size:20px">${g.icon||'💳'}</div><div><div style="font-weight:700">${g.name}</div><div class="mini muted">${debtTypeLabels[g.debtType]||g.debtType} • ${g.debtRate||0}% годовых</div></div></div>
          <button class="btn-ghost btn-sm" style="border:1px solid var(--border)" data-del-goal="${g.id}">✕</button>
        </div>
        <div class="goal-metrics">
          <div class="goal-metric"><div class="goal-metric-label">Остаток долга</div><div class="goal-metric-value" style="color:var(--red)">${fmt(remaining,'RUB')}</div></div>
          <div class="goal-metric"><div class="goal-metric-label">Платёж /мес</div><div class="goal-metric-value">${fmt(g.monthlyPayment||0,'RUB')}</div></div>
          <div class="goal-metric"><div class="goal-metric-label">Переплата</div><div class="goal-metric-value" style="color:#f59e0b">${fmt(g.totalInterest||0,'RUB')}</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="mini muted">Погашено ${fmt(g.debtPaid||0,'RUB')}</span><span class="mini muted">${pctPaid.toFixed(1)}%</span></div>
        <div class="progress"><div class="progress-bar debt-bar" style="width:${pctPaid}%"></div></div>
        <div class="mini muted" style="margin-top:8px;text-align:center">${remaining>0 ? `Погасите к ${new Date(g.date).toLocaleDateString('ru-RU')} (через ${g.monthsToPayoff||'?'} мес.)` : '🎉 Долг полностью погашен!'}</div>
      </div>`;
    } else {
      const pct = Math.min(100, g.current/g.target*100);
      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:42px;height:42px;border-radius:12px;background:var(--card2);border:1px solid var(--border);display:grid;place-items:center;font-size:20px">${g.icon||'🎯'}</div><div><div style="font-weight:700">${g.name}</div><div class="mini muted">до ${new Date(g.date||'2030-12-31').toLocaleDateString('ru-RU')}</div></div></div>
          <button class="btn-ghost btn-sm" style="border:1px solid var(--border)" data-del-goal="${g.id}">✕</button>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="mini muted">${fmt(g.current,'RUB')}</span><span class="mini muted">${fmt(g.target,'RUB')}</span></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px"><span class="pill pill-blue">${pct.toFixed(1)}%</span><span class="mini muted">Осталось ${fmt(Math.max(0,g.target-g.current),'RUB')}</span></div>
      </div>`;
    }
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
  if(charts.perf){ charts.perf.destroy(); charts.perf=null; }
  const total = totalMetrics().totalValueRUB;
  if(!total || !state.holdings.length){
    // Empty-state flat line
    const labels = ['','','','','','',''];
    const zero = [0,0,0,0,0,0,0];
    charts.perf = new Chart(canvas, {
      type:'line',
      data:{ labels, datasets:[
        { label:'Портфель', data:zero, borderColor:'#4f7cff', borderDash:[4,4], borderWidth:2, pointRadius:0, tension:0 },
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{
          x:{ grid:{display:false}, ticks:{color:'#5a6d95', font:{size:11}} },
          y:{ grid:{color:'rgba(255,255,255,0.06)'}, ticks:{color:'#5a6d95', font:{size:11}, callback:()=>'0'} }
        },
        plugins:{ legend:{display:false}, tooltip:{enabled:false} }
      }
    });
    return;
  }
  if(!perfHistory){
    perfHistory = {
      '1M': generateHistory(total, 1, 0.03, 0.015),
      '3M': generateHistory(total*0.92, 3, 0.04, 0.01),
      '1Y': generateHistory(total*0.78, 12, 0.05, 0.008),
      'ALL': generateHistory(total*0.55, 24, 0.06, 0.012)
    };
  }
  const hist = perfHistory[range] || perfHistory['1Y'];
  // benchmark IMOEX
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

let allocMode = 'type';
function renderAllocChart(force=false){
  const canvas = $('#allocChart');
  if(!canvas) return;
  if(charts.alloc){ charts.alloc.destroy(); charts.alloc=null; }
  const groups={};
  state.holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : (h.currency==='EUR'? h.qty*h.price*FX.EUR_RUB : h.qty*h.price);
    const key = allocMode==='sector' ? (h.sector||'other') : allocMode==='currency' ? (h.currency||'RUB') : (h.type||'other');
    groups[key]=(groups[key]||0)+v;
  });
  const typeNames = {stock:'Акции', etf:'ETF Фонды', bond:'Облигации', crypto:'Крипта', cash:'Кэш'};
  const typeColors = {stock:'#4f7cff', etf:'#8b5cf6', bond:'#06b6d4', crypto:'#f97316', cash:'#64748b'};
  const curColors = {RUB:'#4f7cff', USD:'#22c55e', EUR:'#f59e0b'};
  const labels = Object.keys(groups).map(k=>
    allocMode==='sector' ? (SECTORS[k]?.label || k) :
    allocMode==='currency' ? k : (typeNames[k]||k));
  const data = Object.values(groups);
  const colors = Object.keys(groups).map(k=>
    allocMode==='sector' ? (SECTORS[k]?.color || '#888') :
    allocMode==='currency' ? (curColors[k]||'#888') : (typeColors[k]||'#888'));

  if(!data.length){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

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
  if(charts.corr){ charts.corr.destroy(); charts.corr=null; }
  if(c1){
    if(!state.holdings.length){
      charts.corr = new Chart(c1, { type:'bar', data:{labels:[],datasets:[]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}} });
    } else {
      charts.corr = new Chart(c1, {
        type:'bar',
        data:{
          labels: state.holdings.map(h=>h.ticker),
          datasets:[{ label:'Корреляция с портфелем', data: state.holdings.map((_,i)=>{
            // Deterministic pseudo-correlation per position instead of Math.random() flicker
            const v = ((i*7919)%100)/100*0.4+0.5;
            return +v.toFixed(2);
          }), backgroundColor:'#4f7cff', borderRadius:8 }]
        },
        options:{ responsive:true, maintainAspectRatio:false, scales:{ x:{ grid:{display:false}}, y:{ grid:{color:'rgba(255,255,255,0.06)'}, min:0, max:1 } }, plugins:{ legend:{display:false} } }
      });
    }
  }
  const c2 = $('#growthChart');
  if(charts.growth){ charts.growth.destroy(); charts.growth=null; }
  if(c2){
    const total = totalMetrics().totalValueRUB;
    if(!total || !state.holdings.length){
      charts.growth = new Chart(c2, { type:'line', data:{labels:[],datasets:[]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}} });
    } else {
      const hist = generateHistory(total*0.55, 36, 0.06, 0.009);
      charts.growth = new Chart(c2, {
        type:'line',
        data:{ labels:hist.labels, datasets:[{ data:hist.data, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.12)', fill:true, tension:0.4, borderWidth:2, pointRadius:0 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(255,255,255,0.06)'}}} }
      });
    }
  }
}

// Modals
function openOrderBook(ticker){
  const item = mergedMarket.find(m=>m.ticker===ticker);
  if(!item) return;
  $('#obTickerTitle').textContent = item.ticker + ' — Стакан';
  const price = item.price || 100;
  const bids = [
    {qty: 10, price: Math.round(price*0.998)},
    {qty: 25, price: Math.round(price*0.994)},
    {qty: 40, price: Math.round(price*0.990)},
    {qty: 100, price: Math.round(price*0.985)},
  ];
  const asks = [
    {qty: 15, price: Math.round(price*1.002)},
    {qty: 30, price: Math.round(price*1.006)},
    {qty: 55, price: Math.round(price*1.010)},
    {qty: 90, price: Math.round(price*1.015)},
  ];
  $('#obBids').innerHTML = bids.map(b=>`<div style="display:flex;justify-content:space-between;color:#22c55e"><span>${b.qty}</span><span>${fmt(b.price,'RUB')}</span></div>`).join('');
  $('#obAsks').innerHTML = asks.map(a=>`<div style="display:flex;justify-content:space-between;color:#ef4444"><span>${a.qty}</span><span>${fmt(a.price,'RUB')}</span></div>`).join('');
  $('#orderBookModal').classList.add('open');
}

function openBuyModal(prefilled=null){
  const modal = $('#buyModal');
  if(!modal) return;
  modal.classList.add('open');
  const form = $('#holdingForm');
  if(form) form.reset();
  if(prefilled){
    $('#buyTicker').value = prefilled.ticker || '';
    $('#buyName').value = prefilled.name || '';
    $('#buyPrice').value = prefilled.price ?? '';
    const isRu = ['SBER','YDEX','TCSG','LKOH','TMOS','SU26238','LQDT','GAZP','GMKN','ROSN','MAGN','NVTK','PLZL','SNGS','TATN','CHMF','IRAO','VTBR','ALRS','AFLT','HYDR','PIKK','DSKY','OZON','FIVE','POLY','RUAL','TRNFP','UPRO','PHOR','WUSH','MGNT','MTSS'].includes(prefilled.ticker) || (prefilled.sector && prefilled.sector!=='crypto' && prefilled.cap && String(prefilled.cap).includes('RUB'));
    $('#buyCurrency').value = isRu ? 'RUB':'USD';
    // Focus qty
    setTimeout(()=>$('#buyQty')?.focus(), 60);
  }else{
    setTimeout(()=>$('#buyTicker')?.focus(), 60);
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
  const existingMarket = mergedMarket.find(m=>m.ticker===ticker) || {};
  const existing = state.holdings.find(h=>h.ticker===ticker);
  if(existing){
    const totalCost = existing.qty*existing.avgPrice + qty*price;
    const totalQty = existing.qty + qty;
    existing.avgPrice = totalCost/totalQty;
    existing.qty = totalQty;
    if(!existing.price){
      existing.price = existingMarket.price !== undefined ? existingMarket.price : price;
    }
  }else{
    // Smart defaulting for custom tickers (not in MARKET)
    let type = existingMarket.type || 'stock';
    let sector = existingMarket.sector || 'tech';
    let color = existingMarket.color || '#4f7cff';
    let icon = existingMarket.icon || ticker.slice(0,2).toUpperCase();
    if(!existingMarket.type){
      if(/BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|AVAX|MATIC|LINK|LTC|TRX/.test(ticker)){ type='crypto'; sector='crypto'; color='#f97316'; }
      else if(/ОФЗ|SU|OB|RU\d|OFZ/.test(ticker)){ type='bond'; sector='bond'; color='#0ea5e9'; }
      else if(/ETF|TMOS|VOO|VEA|VWO|QQQ|SPY|IWM|DIA|ARK|FX[A-Z]/.test(ticker)){ type='etf'; sector='etf'; color='#8b5cf6'; }
      else if(/LQDT|RMM|RUB/.test(ticker)){ type='etf'; sector='cash'; color='#64748b'; }
      if(currency==='RUB'){
        // russian tickers are usually cyrillic-like 4-5 letter latin codes (SBER, LKOH). Keep stock.
      }
    }
    state.holdings.push({
      id:'h_'+Math.random().toString(36).slice(2,9),
      ticker, name, qty,
      price: existingMarket.price !== undefined ? existingMarket.price : price,
      avgPrice:price, currency,
      type, sector, color, icon
    });
  }
  state.transactions.unshift({
    id:'tx_'+Math.random().toString(36).slice(2,9),
    ticker, type:'buy', qty, price, total:qty*price, date:new Date().toISOString(),
    currency
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
  const activeTab = document.querySelector('.tabs[data-tabs="goalType"] .tab.active');
  const goalType = activeTab ? activeTab.dataset.goalType : 'custom';

  if(goalType==='retirement'){
    const name = $('#retGoalName').value.trim() || 'Пенсия';
    const pension = parseFloat($('#retGoalPension').value);
    const wr = parseFloat($('#retGoalWR').value)||4;
    const retReturn = parseFloat($('#retGoalReturn').value)||10;
    const retAge = parseInt($('#retGoalAge').value);
    const curAge = parseInt($('#retGoalCurAge').value)||30;
    const current = parseFloat($('#retGoalCurrent').value)||0;
    if(!pension || !retAge) return alert('Введите желаемую пенсию и возраст выхода');
    if(retAge <= curAge) return alert('Возраст выхода на пенсию должен быть больше текущего возраста');
    // 4% rule: required_capital = (pension * 12) / withdrawal_rate
    const requiredCapital = Math.round((pension * 12) / (wr / 100));
    const monthsToRetire = (retAge - curAge) * 12;
    const r = retReturn/100/12;
    let monthlyNeeded = 0;
    if(r>0){
      const fv = requiredCapital - current * Math.pow(1+r, monthsToRetire);
      if(fv>0) monthlyNeeded = Math.round(fv * r / (Math.pow(1+r, monthsToRetire)-1));
    } else {
      monthlyNeeded = Math.round((requiredCapital - current) / monthsToRetire);
    }
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + Math.round(monthsToRetire/12));
    state.goals.push({
      id:'g_'+Math.random().toString(36).slice(2,7),
      name, target: requiredCapital, current,
      date: targetDate.toISOString().slice(0,10),
      icon:'🏖️',
      goalType:'retirement',
      pension, withdrawalRate:wr, expectedReturn:retReturn,
      retirementAge:retAge, currentAge:curAge, monthlyNeeded,
      requiredCapital, retAge
    });
    saveState(); renderGoals();
    $('#retGoalName').value=''; $('#retGoalPension').value=''; $('#retGoalAge').value='';
    $('#retGoalCurAge').value='30'; $('#retGoalCurrent').value='';
    toast(`Цель «Пенсия»: нужно ${fmt(requiredCapital,'RUB')}, откладывать ~${fmt(monthlyNeeded,'RUB')}/мес`);
  } else if(goalType==='debt'){
    const name = $('#debtGoalName').value.trim() || 'Долг';
    const amount = parseFloat($('#debtGoalAmount').value);
    const rate = parseFloat($('#debtGoalRate').value)||0;
    const payment = parseFloat($('#debtGoalPayment').value);
    const paid = parseFloat($('#debtGoalPaid').value)||0;
    const debtType = $('#debtGoalType').value;
    if(!amount || !payment) return alert('Введите сумму долга и ежемесячный платёж');
    if(payment <= 0) return alert('Платёж должен быть больше нуля');
    const monthlyRate = rate/100/12;
    let monthsToPayoff = 0;
    let totalInterest = 0;
    let remaining = amount - paid;
    if(monthlyRate===0){
      monthsToPayoff = Math.ceil(remaining/payment);
      totalInterest = 0;
    } else {
      // Standard amortization: months = log(payment/(payment - rate*balance)) / log(1+rate)
      const minPayment = remaining * monthlyRate;
      if(payment <= minPayment){
        return alert(`Платёж (${fmt(payment,'RUB')}) должен быть больше процентов (${fmt(Math.round(minPayment),'RUB')}/мес), иначе долг не будет уменьшаться.`);
      }
      monthsToPayoff = Math.ceil(Math.log(payment/(payment - monthlyRate*remaining)) / Math.log(1+monthlyRate));
      totalInterest = Math.round(payment * monthsToPayoff - remaining);
    }
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);
    const debtIcons = {credit_card:'💳', mortgage:'🏠', car_loan:'🚗', personal_loan:'💰', other:'📋'};
    const debtLabels = {credit_card:'Кредитная карта', mortgage:'Ипотека', car_loan:'Автокредит', personal_loan:'Потреб. кредит', other:'Долг'};
    state.goals.push({
      id:'g_'+Math.random().toString(36).slice(2,7),
      name, target:0, current: amount-paid,
      date: payoffDate.toISOString().slice(0,10),
      icon: debtIcons[debtType]||'💳',
      goalType:'debt',
      debtAmount:amount, debtRate:rate, monthlyPayment:payment,
      debtPaid:paid, monthsToPayoff, totalInterest, debtType,
      originalAmount:amount
    });
    saveState(); renderGoals();
    $('#debtGoalName').value=''; $('#debtGoalAmount').value=''; $('#debtGoalRate').value='';
    $('#debtGoalPayment').value=''; $('#debtGoalPaid').value='';
    toast(`Долг погасится через ${monthsToPayoff} мес. (${new Date(payoffDate).toLocaleDateString('ru-RU')}), переплата ~${fmt(totalInterest,'RUB')}`);
  } else {
    const name = $('#newGoalName').value.trim();
    const target = parseFloat($('#newGoalTarget').value);
    const current = parseFloat($('#newGoalCurrent').value)||0;
    const date = $('#newGoalDate').value;
    if(!name || !target) return alert('Введите название и цель');
    state.goals.push({ id:'g_'+Math.random().toString(36).slice(2,7), name, target, current, date:date||'2028-12-31', icon:'🎯', goalType:'custom' });
    saveState(); renderGoals();
    $('#newGoalName').value=''; $('#newGoalTarget').value=''; $('#newGoalCurrent').value='';
    toast('Цель добавлена');
  }
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
      if(parsed && Array.isArray(parsed.holdings)){
        state = {
          profile: parsed.profile || state.profile || { name:'Инвестор' },
          holdings: parsed.holdings || [],
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
          goals: Array.isArray(parsed.goals) ? parsed.goals : [],
          settings: Object.assign({ currency:'RUB', showRUB:true }, parsed.settings || {})
        };
        saveState(); perfHistory=null; renderAll();
        toast('Импорт выполнен');
      } else {
        alert('Файл не содержит holdings');
      }
    }catch(err){ alert('Ошибка файла: '+err.message); }
    e.target.value = '';
  };
  reader.readAsText(file);
}
function resetData(){
  if(confirm('Удалить все данные портфеля?')){
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


function showRebalance(){
  const m = totalMetrics();
  if(!state.holdings.length){
    toast('Портфель пуст — сначала добавьте активы');
    return;
  }
  const target = { stock:0.5, etf:0.2, bond:0.2, crypto:0.05, cash:0.05 };
  const byType={};
  state.holdings.forEach(h=>{
    const v = h.currency==='USD'? h.qty*h.price*FX.USD_RUB : (h.currency==='EUR'? h.qty*h.price*FX.EUR_RUB : h.qty*h.price);
    byType[h.type]=(byType[h.type]||0)+v;
  });
  const names = {stock:'Акции', etf:'ETF', bond:'Облигации', crypto:'Крипта', cash:'Кэш'};
  const lines = Object.keys(target).map(t=>{
    const cur = byType[t]||0;
    const curPct = m.totalValueRUB? cur/m.totalValueRUB*100 : 0;
    const tgtPct = target[t]*100;
    const delta = (tgtPct-curPct)/100*m.totalValueRUB;
    const act = Math.abs(delta) < m.totalValueRUB*0.02 ? 'ОК' : (delta>0? 'Докупить '+fmt(delta,'RUB') : 'Сократить '+fmt(-delta,'RUB'));
    return `${names[t]}: ${curPct.toFixed(1)}% → ${tgtPct.toFixed(0)}%  •  ${act}`;
  });
  alert('План ребалансировки (целевая модель 50/20/20/5/5):\n\n' + lines.join('\n'));
}

// expose
window.app={ toggleWatchlist, openBuyModal, showRebalance };

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

async function fetchMoexBoard(board) {
  try {
    const res = await fetch(`https://iss.moex.com/iss/engines/stock/markets/shares/boards/${board}/securities.json`);
    if(!res.ok) return {};
    const data = await res.json();
    const result = {};
    const secIdIdx = data.securities.columns.indexOf('SECID');
    const nameIdx = data.securities.columns.indexOf('SHORTNAME');
    const mktIdIdx = data.marketdata.columns.indexOf('SECID');
    const lastIdx = data.marketdata.columns.indexOf('LAST');
    const changeIdx = data.marketdata.columns.indexOf('CHANGE');
    const mktMap = {};
    data.marketdata.data.forEach(row => {
      mktMap[row[mktIdIdx]] = { price: row[lastIdx], change: row[changeIdx] };
    });
    data.securities.data.forEach(row => {
      const ticker = row[secIdIdx];
      const m = mktMap[ticker];
      if(m && m.price) {
        result[ticker] = { ticker, name: row[nameIdx], price: m.price, change: m.change || 0 };
      }
    });
    return result;
  } catch(e) { return {}; }
}

async function fetchMoexBonds(board) {
  try {
    const res = await fetch(`https://iss.moex.com/iss/engines/stock/markets/bonds/boards/${board}/securities.json`);
    if(!res.ok) return {};
    const data = await res.json();
    const result = {};
    const secIdIdx = data.securities.columns.indexOf('SECID');
    const nameIdx = data.securities.columns.indexOf('SHORTNAME');
    const mktIdIdx = data.marketdata.columns.indexOf('SECID');
    const lastIdx = data.marketdata.columns.indexOf('LAST');
    const changeIdx = data.marketdata.columns.indexOf('CHANGE');
    const mktMap = {};
    data.marketdata.data.forEach(row => {
      mktMap[row[mktIdIdx]] = { price: row[lastIdx], change: row[changeIdx] };
    });
    data.securities.data.forEach(row => {
      const ticker = row[secIdIdx];
      const m = mktMap[ticker];
      if(m && m.price) {
        result[ticker] = { ticker, name: row[nameIdx], price: m.price, change: m.change || 0, type: 'bond' };
      }
    });
    return result;
  } catch(e) { return {}; }
}

async function updateLivePrices() {
  let updated = false;
  
  // MOEX Shares
  const moexShares = await fetchMoexBoard('TQBR');
  const moexEtfs = await fetchMoexBoard('TQTF');
  const moexOfz = await fetchMoexBonds('TQOB');
  const moexCbonds = await fetchMoexBonds('TQCB');

  const allMoex = { ...moexShares, ...moexEtfs, ...moexOfz, ...moexCbonds };

  MARKET.forEach(m => {
     if(allMoex[m.ticker]) { 
       m.price = allMoex[m.ticker].price; 
       m.change = allMoex[m.ticker].change;
       updated = true; 
     }
  });
  state.holdings.forEach(h => {
     if(allMoex[h.ticker]) { 
       h.price = allMoex[h.ticker].price; 
       updated = true; 
     }
  });

  // Augment mergedMarket with all securities from MOEX
  const tempMarket = [...MARKET];
  let added = false;
  Object.keys(allMoex).forEach(ticker => {
    if (!tempMarket.some(m => m.ticker === ticker)) {
      const s = allMoex[ticker];
      tempMarket.push({
        ticker: s.ticker,
        name: s.name,
        price: s.price,
        change: s.change,
        type: s.type || (ticker.length > 5 ? 'etf' : 'stock'),
        sector: s.type === 'bond' ? 'bond' : (ticker.length > 5 ? 'etf' : 'tech'),
        cap: '-',
        icon: ticker.slice(0, 2).toUpperCase(),
        color: '#64748b'
      });
      added = true;
    }
  });
  mergedMarket = tempMarket;
  if(added) updated = true;
  
  try {
    const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (binanceRes.ok) {
      const binanceData = await binanceRes.json();
      const cryptoPrices = {};
      binanceData.forEach(t => {
        if(t.symbol.endsWith('USDT')) {
          cryptoPrices[t.symbol.replace('USDT','')] = parseFloat(t.price);
        }
      });
      mergedMarket.forEach(m => {
         if(m.type==='crypto' && cryptoPrices[m.ticker]) { m.price = cryptoPrices[m.ticker]; updated = true; }
      });
      state.holdings.forEach(h => {
         if(cryptoPrices[h.ticker]) { h.price = cryptoPrices[h.ticker]; updated = true; }
      });
    }
  } catch(e) { console.warn("Binance update failed", e); }

  if(updated) {
    saveState();
    renderAll();
  }
}

async function updateFX() {
  let updated = false;

  // Try CBR mirror 1
  try {
    const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
    if (res.ok) {
      const data = await res.json();
      if (data.Valute && data.Valute.USD) {
        FX.USD_RUB = data.Valute.USD.Value;
        updated = true;
        toast('Курсы валют обновлены по данным ЦБ РФ');
      }
      if (data.Valute && data.Valute.EUR) {
        FX.EUR_RUB = data.Valute.EUR.Value;
        updated = true;
      }
    }
  } catch (e) { console.warn('CBR mirror 1 failed', e); }

  // Fallback to secondary source if primary failed
  if (!updated) {
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (res.ok) {
        const data = await res.json();
        if (data.usd && data.usd.rub) {
          FX.USD_RUB = data.usd.rub;
          updated = true;
        }
      }
      const resEur = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json');
      if (resEur.ok) {
        const dataEur = await resEur.json();
        if (dataEur.eur && dataEur.eur.rub) {
          FX.EUR_RUB = dataEur.eur.rub;
          updated = true;
        }
      }
    } catch (e) { console.warn('Fallback FX failed', e); }
  }

  if (updated) {
    saveState();
    renderAll();
  }
}
