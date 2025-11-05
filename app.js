// app.js — glue code, UI interactions, charts, storage
// Storage format in localStorage: key "finance_ai_adv_db_v1" -> {transactions:[], wishlist:[], meta:{}}
// Model is managed in ai.js and saved to IndexedDB.

const DB_KEY = 'finance_ai_adv_db_v1';

function loadDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)) || {transactions:[], wishlist:[], meta:{recentIncomes:[]}} }catch(e){ return {transactions:[], wishlist:[], meta:{recentIncomes:[]}} } }
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)) }

function human(n){ return Number(n).toLocaleString('id-ID') }

// UI elements
const incomeInput = document.getElementById('incomeInput');
const periodSelect = document.getElementById('periodSelect');
const analyzeBtn = document.getElementById('analyzeBtn');
const predictBtn = document.getElementById('predictBtn');
const summaryBox = document.getElementById('summaryBox');
const txView = document.getElementById('txView');
const txDesc = document.getElementById('txDesc');
const txAmt = document.getElementById('txAmt');
const txCat = document.getElementById('txCat');
const addTx = document.getElementById('addTx');
const clearData = document.getElementById('clearData');
const txCanvas = document.getElementById('pieChart');
const lineCanvas = document.getElementById('lineChart');
const wishlistView = document.getElementById('wishlistView');
const savingsInput = document.getElementById('savingsInput');
const wantSelect = document.getElementById('wantSelect');
const wishForm = document.getElementById('wishForm');
const wishName = document.getElementById('wishName');
const wishPrice = document.getElementById('wishPrice');
const addWish = document.getElementById('addWish');
const themeToggle = document.getElementById('themeToggle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const defaultTheme = document.getElementById('defaultTheme');
const autoTrain = document.getElementById('autoTrain');
const confThresh = document.getElementById('confThresh');
const settingsBtnClose = document.getElementById('closeSettings');


// Charts
let pieChart = null, lineChart = null;
function initCharts(){
  const pieCtx = txCanvas.getContext('2d');
  pieChart = new Chart(pieCtx, {type:'pie', data:{labels:['Essentials','Savings','Wants'], datasets:[{data:[1,1,1], label:'Alokasi'}]}, options:{responsive:true}});
  const lineCtx = lineCanvas.getContext('2d');
  lineChart = new Chart(lineCtx, {type:'line', data:{labels:[], datasets:[{label:'Total Pengeluaran', data:[], fill:true}]}, options:{responsive:true}});
}

// Render db views
function renderTX(){
  const db = loadDB();
  if(db.transactions.length===0){ txView.innerHTML='(kosong)'; return }
  txView.innerHTML = db.transactions.slice().reverse().map(t=>`<div class="tx-item"><strong>${t.desc}</strong> — Rp ${human(t.amt)} <span class="small muted">[${t.cat}] ${new Date(t.ts).toLocaleString()}</span></div>`).join('');
}

function renderWishlist(){
  const db = loadDB();
  if(!db.wishlist || db.wishlist.length===0){ wishlistView.innerHTML='(kosong)'; return }
  wishlistView.innerHTML = db.wishlist.map((w,i)=>`<div class="wishlist-item"><div>${w.name} — Rp ${human(w.price)}</div><div><button data-idx="${i}" class="btn small buyBtn">Hitung</button> <button data-idx="${i}" class="btn ghost small delBtn">Hapus</button></div></div>`).join('');
  // attach listeners
  document.querySelectorAll('.buyBtn').forEach(b=>b.addEventListener('click', e=>{ const idx=Number(e.target.dataset.idx); evaluateWish(idx); }));
  document.querySelectorAll('.delBtn').forEach(b=>b.addEventListener('click', e=>{ const idx=Number(e.target.dataset.idx); deleteWish(idx); }));
}

function evaluateWish(idx){
  const db=loadDB(); const wish=db.wishlist[idx]; if(!wish) return;
  const savings = Number(savingsInput.value) || 0;
  const diff = wish.price - savings;
  const msg = diff<=0 ? `🎉 Anda sudah punya cukup tabungan untuk membeli ${wish.name}.` : `🔎 Anda perlu menabung tambahan Rp ${human(diff)} untuk membeli ${wish.name}.`;
  alert(msg);
}

function deleteWish(idx){ const db=loadDB(); db.wishlist.splice(idx,1); saveDB(db); renderWishlist(); }

// Add transaction
addTx.addEventListener('click', async ()=>{
  const desc = txDesc.value.trim() || 'Tanpa keterangan';
  const amt = Number(txAmt.value); const cat = txCat.value;
  if(!amt || amt<=0){ alert('Masukkan jumlah transaksi valid'); return }
  const db=loadDB(); db.transactions.push({desc,amt,cat,ts:new Date().toISOString()});
  db.meta.recentIncomes = db.meta.recentIncomes || [];
  // push income sample if incomeInput filled
  const inc = Number(incomeInput.value); if(inc && inc>0){ db.meta.recentIncomes.push(inc); if(db.meta.recentIncomes.length>50) db.meta.recentIncomes.shift(); }
  saveDB(db); renderTX(); renderWishlist();
  // auto-train if enabled
  const auto = localStorage.getItem('finance_ai_adv_settings_autoTrain') || 'yes';
  if(auto==='yes'){ await trainModelFromDB(); }
  txDesc.value=''; txAmt.value='';
})

// Wishlist
wantSelect.addEventListener('change', ()=>{ if(wantSelect.value==='yes') wishForm.classList.remove('hidden'); else wishForm.classList.add('hidden'); })
addWish.addEventListener('click', ()=>{
  const name = wishName.value.trim() || 'Keinginan';
  const price = Number(wishPrice.value) || 0;
  if(price<=0){ alert('Masukkan harga valid'); return }
  const db=loadDB(); db.wishlist = db.wishlist || []; db.wishlist.push({name,price,ts:new Date().toISOString()}); saveDB(db); renderWishlist();
  wishName.value=''; wishPrice.value=''; wantSelect.value='no'; wishForm.classList.add('hidden');
})

// Delete all data
clearData.addEventListener('click', ()=>{ if(confirm('Hapus seluruh data lokal (transaksi, wishlist, meta)?')){ localStorage.removeItem(DB_KEY); // also remove model from indexeddb not done here
  alert('Data lokal dihapus. Model tersimpan di IndexedDB tetap ada jika sebelumnya disimpan.'); renderTX(); renderWishlist(); }});

// train model helper
async function trainModelFromDB(){
  const db = loadDB();
  // ensure AI available
  if(!window.AI){ console.warn('AI module belum siap'); return }
  // try to create/load model and train
  try{
    let m = await window.AI.loadModel();
    if(!m){ m = await window.AI.createModelAdv(); }
    await window.AI.trainFromDB(m, db, 25);
    window.__AI_MODEL = m;
    console.log('Training selesai');
  }catch(e){ console.error(e); }
}

// Analyze & present results
analyzeBtn.addEventListener('click', async ()=>{
  const income = Number(incomeInput.value); const period = periodSelect.value;
  if(!income || income<=0){ alert('Masukkan penghasilan yang valid'); return }
  const db = loadDB();
  db.meta.recentIncomes = db.meta.recentIncomes || [];
  db.meta.recentIncomes.push(income); if(db.meta.recentIncomes.length>50) db.meta.recentIncomes.shift();
  saveDB(db);

  // get prediction & present
  const out = await window.AI.predictAdvanced(income, db);
  const ratios = out.ratios; const conf = out.confidence;
  const totals = {income, essentials:Math.round(income*ratios[0]), savings:Math.round(income*ratios[1]), wants:Math.round(income*ratios[2])};
  const spent = db.transactions.reduce((a,t)=>a+t.amt,0);
  const left = income - spent;
  // Build lines
  const lines = [];
  lines.push(`📊 Rangkuman (${period==='daily'?'Per Hari':'Per Bulan'})`);
  lines.push(`➡️ Total: Rp ${human(totals.income)}`);
  lines.push(`🔎 Rekomendasi alokasi (AI):`);
  lines.push(`• Essentials: Rp ${human(totals.essentials)} — ${(ratios[0]*100).toFixed(1)}%`);
  lines.push(`• Savings: Rp ${human(totals.savings)} — ${(ratios[1]*100).toFixed(1)}%`);
  lines.push(`• Wants: Rp ${human(totals.wants)} — ${(ratios[2]*100).toFixed(1)}%`);
  lines.push(`
💡 Confidence model: ${(conf*100).toFixed(1)}%`);
  lines.push(`
💸 Pengeluaran tercatat: Rp ${human(spent)} (${db.transactions.length} items)`);
  lines.push(`Sisa setelah pengeluaran tercatat: Rp ${human(left)} (perhitungan kasar)`);
  lines.push(`
🧠 Catatan: AI belajar dari data Anda dan model disimpan di browser. Untuk publik, pastikan user diberi opsi backup/ekspor.`);

  summaryBox.textContent = lines.join('\n');
  // update charts
  updateCharts(ratios, db);
  renderTX(); renderWishlist();
});

predictBtn.addEventListener('click', async ()=>{
  const income = Number(incomeInput.value)||1000000; const db = loadDB();
  const out = await window.AI.predictAdvanced(income, db);
  alert('Prediksi alokasi:\n' + `Essentials ${(out.ratios[0]*100).toFixed(1)}%\nSavings ${(out.ratios[1]*100).toFixed(1)}%\nWants ${(out.ratios[2]*100).toFixed(1)}%`);
})

// charts update
function updateCharts(ratios, db){
  if(pieChart){
    pieChart.data.datasets[0].data = [ratios[0], ratios[1], ratios[2]];
    pieChart.update();
  }
  // line chart: push total spent per day last 14 days (simulate if none)
  const hist = generateSpendingHistory(db);
  lineChart.data.labels = hist.labels;
  lineChart.data.datasets[0].data = hist.data;
  lineChart.update();
}

function generateSpendingHistory(db){
  // group transactions by date for last 14 days
  const days = 14;
  const today = new Date(); const labels = []; const data = [];
  for(let i=days-1;i>=0;i--){
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i);
    const key = d.toISOString().slice(0,10);
    labels.push(key);
    const sum = db.transactions.filter(t=>t.ts.slice(0,10)===key).reduce((a,b)=>a+b.amt,0);
    data.push(sum);
  }
  return {labels, data};
}

// Theme & settings persistence
function applyTheme(t){
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('finance_ai_adv_settings_theme', t);
}
themeToggle.addEventListener('click', ()=>{
  const cur = document.body.getAttribute('data-theme') || 'dark';
  applyTheme(cur==='dark'?'bright':'dark');
});

settingsBtn.addEventListener('click', ()=>{ settingsModal.classList.remove('hidden'); // load current settings
  defaultTheme.value = localStorage.getItem('finance_ai_adv_settings_theme') || 'dark';
  autoTrain.value = localStorage.getItem('finance_ai_adv_settings_autoTrain') || 'yes';
  confThresh.value = localStorage.getItem('finance_ai_adv_settings_confThresh') || '0.6';
});

closeSettings.addEventListener('click', ()=>{ settingsModal.classList.add('hidden'); });
saveSettings.addEventListener('click', ()=>{
  localStorage.setItem('finance_ai_adv_settings_theme', defaultTheme.value);
  localStorage.setItem('finance_ai_adv_settings_autoTrain', autoTrain.value);
  localStorage.setItem('finance_ai_adv_settings_confThresh', confThresh.value);
  applyTheme(defaultTheme.value);
  alert('Pengaturan disimpan');
  settingsModal.classList.add('hidden');
});

// init
(function init(){
  initCharts();
  renderTX(); renderWishlist();
  const theme = localStorage.getItem('finance_ai_adv_settings_theme') || 'dark';
  applyTheme(theme);
  // try load model into memory if exists
  (async ()=>{ if(window.AI){ const m = await window.AI.loadModel(); if(m) window.__AI_MODEL = m; } })();
})();

// expose train function
async function trainModelFromDB(){ await trainModelFromDB; }
