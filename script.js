
/* script.js - Chatbot logic, parsing numbers & currency, realistic financial calculations, learning */
const DB_KEY = 'finance_ai_chatbot_db_v1';
const MEMORY_KEY = 'finance_ai_chatbot_memory_v1';

// Helpers: storage
function loadDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)) || {conversations:[], profile:null} }catch(e){return {conversations:[], profile:null}} }
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)) }
function loadMemory(){ try{ return JSON.parse(localStorage.getItem(MEMORY_KEY)) || {vocab:{}, currencies:{'idr': 'IDR'}} }catch(e){ return {vocab:{}, currencies:{'idr':'IDR'}} } }
function saveMemory(mem){ localStorage.setItem(MEMORY_KEY, JSON.stringify(mem)) }

// Chat UI
const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettings');
const closeSettingsBtn = document.getElementById('closeSettings');
const themeSelect = document.getElementById('themeSelect');
const langTone = document.getElementById('langTone');
const notifPerm = document.getElementById('notifPerm');
const resetDataBtn = document.getElementById('resetData');

let db = loadDB();
let mem = loadMemory();

// initial greeting and state
let waitingFor = null; // what AI expects next: 'income','period','savings','target','duration','ask'
let currentProfile = db.profile || {income:null, period:null, savings:0, target:null, duration:null, currency:'IDR'};

// utils: number parsing tolerant
function normalizeNumberText(txt){
  if(!txt) return null;
  txt = txt.toString().toLowerCase().trim();
  // replace words for thousands/millions
  txt = txt.replace(/[^0-9a-z\.\,\s]/g,' ');
  txt = txt.replace(/\b(rp|idr|rupiah)\b/g,'');
  txt = txt.replace(/\b(ribu|rb)\b/g,'000');
  txt = txt.replace(/\bjuta\b/g,'000000');
  txt = txt.replace(/\bmiliar\b/g,'000000000');
  txt = txt.replace(/\bsetengah juta\b/g,'500000');
  txt = txt.replace(/\bsatu\b/g,'1');
  txt = txt.replace(/\bdua\b/g,'2');
  txt = txt.replace(/\btiga\b/g,'3');
  txt = txt.replace(/\bempat\b/g,'4');
  txt = txt.replace(/\blima\b/g,'5');
  txt = txt.replace(/\benam\b/g,'6');
  txt = txt.replace(/\btujuh\b/g,'7');
  txt = txt.replace(/\bdelapan\b/g,'8');
  txt = txt.replace(/\bsembilan\b/g,'9');
  // remove spaces and dots used as thousands separators
  txt = txt.replace(/\s+/g,'').replace(/\./g,'').replace(/,/g,'');
  // if contains letters like 'usd' try detect currency
  let currency = 'IDR';
  if(/\$|usd|dollar/.test(txt)) currency = 'USD';
  if(/eur|€/.test(txt)) currency = 'EUR';
  // extract digits
  const match = txt.match(/(\d+)/);
  if(!match) return {value:null,currency};
  const value = Number(match[1]);
  return {value,currency};
}

// format currency nicely
function fmt(n, currency='IDR'){
  if(n===null || n===undefined) return '-';
  return (currency==='IDR' ? 'Rp ' + Number(Math.round(n)).toLocaleString('id-ID') : (currency+' '+Number(Math.round(n)).toLocaleString()));
}

// chat rendering
function pushAI(text, opts={typing:false, delay:700}){
  const el = document.createElement('div'); el.className='msg ai';
  if(opts.typing){
    el.innerHTML = '<div class="typing"></div>';
    chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
    setTimeout(()=>{ el.textContent = text; saveConversation('ai',text); chatEl.scrollTop = chatEl.scrollHeight; }, opts.delay||800);
  } else {
    el.textContent = text; chatEl.appendChild(el); saveConversation('ai',text); chatEl.scrollTop = chatEl.scrollHeight;
  }
}
function pushUser(text){
  const el = document.createElement('div'); el.className='msg user'; el.textContent = text; chatEl.appendChild(el); saveConversation('user',text); chatEl.scrollTop = chatEl.scrollHeight;
}

function saveConversation(sender, text){
  db.conversations = db.conversations || [];
  db.conversations.push({sender, text, ts: new Date().toISOString()});
  saveDB(db);
}

// initial welcome
function welcome(){
  pushAI('Halo! Saya asisten keuanganmu 🤖💰. Berapa penghasilan kamu? (ketik angka atau teks, contoh: 5.000 atau lima ribu)',{typing:true,delay:900});
  waitingFor = 'income';
}
welcome();

// main message handler
sendBtn.addEventListener('click', ()=>handleInput());
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); handleInput(); } });

function handleInput(){
  const raw = inputEl.value.trim();
  if(!raw) return;
  pushUser(raw); inputEl.value='';
  processUserMessage(raw);
}

function processUserMessage(msg){
  // learn mappings: if msg contains phrase mapping like 'setengah juta' etc, store
  learnFromText(msg);

  // try parse numbers and currency
  const parsed = normalizeNumberText(msg);
  // if user asks question like "jika penghasilan perhari ku 10000 maka butuh berapa?"
  if(/jika|kalau|berapa|butuh/.test(msg.toLowerCase()) && /penghasil|penghasilan|gaji/.test(msg.toLowerCase())){
    // attempt quick simulation parse
    simulateFromText(msg);
    return;
  }

  if(waitingFor==='income'){
    if(parsed && parsed.value){
      currentProfile.income = parsed.value;
      currentProfile.currency = parsed.currency || 'IDR';
      pushAI(`Baik. Apakah itu penghasilan per hari, per bulan, atau per tahun? (ketik: hari / bulan / tahun)`, {typing:true, delay:600});
      waitingFor = 'period';
      return;
    } else {
      pushAI('Maaf, saya belum mengenali jumlahnya. Bisa tulis angka saja atau teks seperti "5 ribu"?', {typing:true, delay:500}); return;
    }
  }

  if(waitingFor==='period'){
    const p = msg.toLowerCase();
    if(/hari/.test(p)) currentProfile.period='day';
    else if(/bulan/.test(p)) currentProfile.period='month';
    else if(/tahun|tahun/.test(p)) currentProfile.period='year';
    else { pushAI('Pilih salah satu: hari / bulan / tahun.', {typing:true, delay:400}); return; }
    pushAI('Berapa jumlah uang yang sudah ada di tabunganmu sekarang? (ketik angka)', {typing:true, delay:600});
    waitingFor='savings';
    return;
  }

  if(waitingFor==='savings'){
    const parsed = normalizeNumberText(msg);
    if(parsed && parsed.value!==null){
      currentProfile.savings = parsed.value;
      pushAI('Apakah kamu punya target tabungan tertentu? Jika iya tulis angka, jika tidak ketik "tidak".', {typing:true, delay:600});
      waitingFor='target';
      return;
    } else {
      pushAI('Tolong masukkan jumlah tabungan saat ini (angka atau teks seperti "200 ribu")', {typing:true, delay:400}); return;
    }
  }

  if(waitingFor==='target'){
    if(/tidak/.test(msg.toLowerCase())){
      currentProfile.target = null;
      pushAI('Oke. Dalam berapa lama (hari/bulan/tahun) kamu ingin mencapai target atau mengecek rencana? Jika belum mau, ketik "nanti".', {typing:true, delay:600});
      waitingFor='duration';
      return;
    }
    const parsed = normalizeNumberText(msg);
    if(parsed && parsed.value){
      currentProfile.target = parsed.value;
      pushAI('Berapa lama kamu ingin mencapai target tersebut? (contoh: 30 hari atau 2 bulan)', {typing:true, delay:600});
      waitingFor='duration';
      return;
    }
    pushAI('Tolong masukkan angka target yang valid (misal: 500000)', {typing:true, delay:400}); return;
  }

  if(waitingFor==='duration'){
    if(/nanti/.test(msg.toLowerCase())){
      currentProfile.duration = null;
      finalizeProfileAndAnalyze();
      return;
    }
    // try detect days/months/years in msg
    const num = normalizeNumberText(msg);
    let unit = 'day';
    if(/bulan|bln/.test(msg.toLowerCase())) unit='month';
    if(/tahun|thn/.test(msg.toLowerCase())) unit='year';
    if(num && num.value){
      currentProfile.duration = {amount: num.value, unit};
      finalizeProfileAndAnalyze();
      return;
    }
    pushAI('Mohon sebutkan durasi yang jelas, contoh: "30 hari" atau "2 bulan"', {typing:true, delay:400}); return;
  }

  // generic free question: try to answer simulation or simple queries
  if(/jika|kalau|berapa|butuh|berapa lama/.test(msg.toLowerCase())){
    simulateFromText(msg);
    return;
  }

  // fallback: echo or prompt
  pushAI('Maaf, saya belum mengerti. Coba tulis: "50000" untuk penghasilan atau tanya: "Jika penghasilan per hari ku 10000 maka butuh berapa?"', {typing:true, delay:600});
}

// learning simple terms
function learnFromText(txt){
  // find expressions like 'setengah juta' or 'ribu' etc and store mapping
  const lower = txt.toLowerCase();
  if(lower.includes('setengah juta')){ mem.vocab['setengah juta'] = 500000; saveMemory(mem); }
  // more learning heuristics can be added
}

// finalize and compute recommendations
function finalizeProfileAndAnalyze(){
  db.profile = currentProfile; saveDB(db);
  computeAndReport(currentProfile);
  waitingFor = null;
}

// core compute function with realistic caps
function computeAndReport(profile){
  const income = profile.income || 0;
  const period = profile.period || 'month'; // day, month, year
  const savingsNow = profile.savings || 0;
  const target = profile.target || null;
  const currency = profile.currency || 'IDR';

  // Convert everything to per-day baseline for calculation only, but preserve display per user's period
  let incomePerDay = income;
  if(period==='month') incomePerDay = income / 30;
  if(period==='year') incomePerDay = income / 365;

  // Percentage rules that scale with income level (small incomes -> slightly different recommendation)
  let savePct = 0.25; // default 25%
  let emergencyPct = 0.08; // 8%
  let spendPct = 1 - savePct - emergencyPct;
  // ensure not negative
  if(spendPct < 0){ spendPct = Math.max(0, 1 - (savePct + emergencyPct)); }

  // compute per day values
  const savePerDay = Math.max(0, Math.round(incomePerDay * savePct));
  const emergencyPerDay = Math.max(0, Math.round(incomePerDay * emergencyPct));
  const spendPerDay = Math.max(0, Math.round(incomePerDay * spendPct));

  // produce user-facing numbers according to their chosen period
  let multiplier = 1;
  if(profile.period==='month') multiplier = 30;
  if(profile.period==='year') multiplier = 365;

  const savePeriod = Math.round(savePerDay * multiplier);
  const emergencyPeriod = Math.round(emergencyPerDay * multiplier);
  const spendPeriod = Math.round(spendPerDay * multiplier);

  // Safety: ensure sums do not exceed income (adjust rounding)
  let totalAllocated = savePeriod + emergencyPeriod + spendPeriod;
  let adjustedSpend = spendPeriod;
  if(totalAllocated > income){
    const diff = totalAllocated - income;
    adjustedSpend = Math.max(0, spendPeriod - diff);
    totalAllocated = savePeriod + emergencyPeriod + adjustedSpend;
  }

  // Build explanation with emoji and formality depending on mem tone
  const tone = (localStorage.getItem('finance_ai_tone')) || 'formal';
  const greet = tone==='formal' ? 'Berikut analisisnya:' : 'Cek ini ya 😊:';

  // if user set target, calculate time estimate and check realism
  let estimateTxt = '';
  if(target){
    const remaining = Math.max(0, target - savingsNow);
    if(savePerDay <= 0){
      estimateTxt = '⚠️ Tabungan harian yang dihitung adalah 0, target tidak dapat dicapai. Pertimbangkan menaikkan persentase tabungan.';
    } else {
      const daysNeeded = Math.ceil(remaining / savePerDay);
      estimateTxt = `Estimasi waktu mencapai target ${fmt(target, currency)}: sekitar ${daysNeeded} hari (~${Math.round(daysNeeded/30)} bulan).`;
      if(daysNeeded < 1){
        estimateTxt = '⚠️ Target tercapai di bawah 1 hari — periksa input penghasilan/target.';
      }
      if(daysNeeded > 36500){
        estimateTxt = '⚠️ Estimasi waktu sangat panjang (lebih dari 100 tahun). Target tampak tidak realistis dibandingkan penghasilan.';
      }
    }
  }

  // push to chat
  const lines = [];
  lines.push(`${greet}`);
  lines.push(`• Jenis penghasilan: ${profile.period==='day'?'per hari':profile.period==='month'?'per bulan':'per tahun'}`);
  lines.push(`• Total penghasilan (${profile.period}): ${fmt(income, currency)}`);
  lines.push(`\nRekomendasi alokasi (perkiraan):`);
  lines.push(`• Tabungan: ${fmt(savePeriod, currency)} (${Math.round(savePct*100)}% ${profile.period})`);
  lines.push(`• Pengeluaran: ${fmt(adjustedSpend, currency)} (${Math.round(spendPct*100)}% ${profile.period})`);
  lines.push(`• Dana darurat: ${fmt(emergencyPeriod, currency)} (${Math.round(emergencyPct*100)}% ${profile.period})`);
  if(target) lines.push(`\n${estimateTxt}`);
  lines.push(`\n💡 Catatan: Semua angka adalah estimasi. AI menyesuaikan jika kamu update progres tabungan.`);

  pushAI(lines.join('\n'), {typing:true, delay:700});

  // save snapshot and memory
  db.profile = profile; saveDB(db);
  mem.currencies = mem.currencies || {'IDR':'IDR'}; saveMemory(mem);

  // set up reminder permission (optional)
  requestNotificationPermissionIfNeeded();
}

// simulation from free text like "jika penghasilan perhari ku 10000 maka butuh berapa"
function simulateFromText(msg){
  const parsed = normalizeNumberText(msg);
  if(!parsed || !parsed.value){
    pushAI('Saya belum mengenali angka di kalimatmu. Bisa ketik angka atau gunakan format "10.000" atau "sepuluh ribu".', {typing:true, delay:500}); return;
  }
  let period = 'day';
  if(/bulan|perbulan|per bulan/.test(msg.toLowerCase())) period='month';
  if(/tahun|pertahun|per tahun/.test(msg.toLowerCase())) period='year';
  const tempProfile = {income: parsed.value, period, savings:0, target:null, currency: parsed.currency||'IDR'};
  const matchTarget = msg.match(/(?:mencapai|target|butuh|untuk)\s+([0-9\.\,krtjbana-z]+)/i);
  if(matchTarget && matchTarget[1]){
    const t = normalizeNumberText(matchTarget[1]);
    if(t && t.value) tempProfile.target = t.value;
  }
  computeAndReport(tempProfile);
}

// notification permission
function requestNotificationPermissionIfNeeded(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    pushAI('Bolehkah saya mengirim pengingat notifikasi (misal: pengingat tabungan harian)? Jika setuju, buka Pengaturan dan aktifkan notifikasi.', {typing:true, delay:600});
  }
}

// settings interactions
settingsBtn.addEventListener('click', ()=>{ settingsModal.classList.remove('hidden');
  const savedTheme = localStorage.getItem('finance_ai_theme') || 'amoled';
  document.body.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;
  langTone.value = localStorage.getItem('finance_ai_tone') || 'formal';
  notifPerm.checked = Notification && Notification.permission === 'granted';
});

closeSettingsBtn.addEventListener('click', ()=>{ settingsModal.classList.add('hidden'); });
saveSettingsBtn.addEventListener('click', ()=>{
  const t = themeSelect.value; document.body.setAttribute('data-theme', t); localStorage.setItem('finance_ai_theme', t);
  localStorage.setItem('finance_ai_tone', langTone.value);
  if(notifPerm.checked && Notification.permission !== 'granted') Notification.requestPermission().then(p=>{ if(p==='granted') alert('Notifikasi diizinkan.'); });
  settingsModal.classList.add('hidden');
});

resetDataBtn.addEventListener('click', ()=>{
  if(confirm('Reset semua data lokal (percakapan, profil, memori)?')){ localStorage.removeItem(DB_KEY); localStorage.removeItem(MEMORY_KEY); db = {conversations:[], profile:null}; mem = {vocab:{}, currencies:{'idr':'IDR'}}; location.reload(); }
});

// restore previous conversations
function restoreConversations(){
  if(!db.conversations || db.conversations.length===0) return;
  db.conversations.forEach(c=>{
    if(c.sender==='user'){ pushUser(c.text); } else { pushAI(c.text); }
  });
}
restoreConversations();
