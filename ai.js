// ai.js — TF.js powered assistant logic (client-side heavy)
// Responsibilities:
// - Maintain a lightweight model that predicts allocation ratios [essentials, savings, wants]
// - Continuous learning: update model on new transactions (online/incremental training)
// - Provide insights and confidence scores
// - Persist model to IndexedDB and metadata to localStorage

const AI_DB_KEY = 'finance_ai_adv_db_v1';
const AI_MODEL_NAME = 'indexeddb://finance-ai-adv-model-v1';

async function createModelAdv(){
  const model = tf.sequential();
  model.add(tf.layers.dense({inputShape:[6],units:32,activation:'relu'}));
  model.add(tf.layers.dense({units:24,activation:'relu'}));
  model.add(tf.layers.dense({units:3,activation:'softmax'}));
  model.compile({optimizer: tf.train.adam(0.005), loss: 'meanSquaredError'});
  return model;
}

async function saveModel(m){
  try{ await m.save(AI_MODEL_NAME); console.log('Model saved to IndexedDB'); }catch(e){ console.warn('Save fail',e) }
}

async function loadModel(){
  try{ const m = await tf.loadLayersModel(AI_MODEL_NAME); console.log('Loaded model from IndexedDB'); return m }catch(e){ console.log('No saved model'); return null }
}

// Build training tensors from DB
function buildTrainingData(db){
  const tx = db.transactions || [];
  // create synthetic examples: for windows of recent transactions, compute ratios
  const examples = [];
  for(let window=3; window<=Math.min(30, tx.length); window+=3){
    const slice = tx.slice(-window);
    const total = slice.reduce((a,b)=>a+b.amt,0) || 1;
    const sums = {essentials:0,savings:0,wants:0};
    slice.forEach(t=>{ if(sums[t.cat]!==undefined) sums[t.cat]+=t.amt });
    const ratios = [sums.essentials/total, sums.savings/total, sums.wants/total];
    // features: avg income normalized, counts, recent ratios, stddev proxy
    const incomes = db.meta && db.meta.recentIncomes ? db.meta.recentIncomes.slice(-10) : [1000000];
    const avgIncome = incomes.reduce((a,b)=>a+b,0)/incomes.length/1e6;
    const feat = [avgIncome, window/30, slice.length/30, ratios[0], ratios[1], ratios[2]];
    examples.push({x:feat, y:ratios});
  }
  // fallback: if no examples, use rule-of-thumb
  if(examples.length===0){
    examples.push({x:[1,0.1,0.1,0.5,0.2,0.3], y:[0.5,0.2,0.3]});
  }
  const xs = tf.tensor2d(examples.map(e=>e.x));
  const ys = tf.tensor2d(examples.map(e=>e.y));
  return {xs, ys};
}

// Train model with DB (incremental)
async function trainFromDB(m, db, epochs=30){
  const data = buildTrainingData(db);
  await m.fit(data.xs, data.ys, {epochs, batchSize:Math.min(16, data.xs.shape[0]), verbose:0});
  data.xs.dispose(); data.ys.dispose();
  await saveModel(m);
  return m;
}

// Predict ratios given income & db state
async function predictAdvanced(income, db){
  let m = window.__AI_MODEL || null;
  if(!m){ m = await loadModel(); if(!m){ m = await createModelAdv(); } window.__AI_MODEL = m; }
  const learned = computeLearnedRatios(db.transactions) || [0.5,0.2,0.3];
  const avgIncome = (db.meta && db.meta.recentIncomes && db.meta.recentIncomes.length>0) ? (db.meta.recentIncomes.reduce((a,b)=>a+b,0)/db.meta.recentIncomes.length)/1e6 : (income/1e6);
  const x = tf.tensor2d([[avgIncome, Math.min(1, (db.transactions.length||0)/30), Math.min(1, (db.transactions.slice(-7).length||0)/7), learned[0], learned[1], learned[2]]]);
  const out = m.predict(x);
  const data = await out.data();
  x.dispose(); out.dispose();
  const sum = data[0]+data[1]+data[2] || 1;
  const ratios = [data[0]/sum, data[1]/sum, data[2]/sum];
  // Confidence: closeness to learned ratios
  const conf = 1 - (Math.abs(ratios[0]-learned[0])+Math.abs(ratios[1]-learned[1])+Math.abs(ratios[2]-learned[2]))/3;
  return {ratios, confidence: Math.max(0, Math.min(1, conf))};
}

function computeLearnedRatios(transactions){
  if(!transactions || transactions.length===0) return null;
  const total = transactions.reduce((a,t)=>a+t.amt,0) || 1;
  const sums = {essentials:0,savings:0,wants:0};
  transactions.forEach(t=>{ if(sums[t.cat]!==undefined) sums[t.cat]+=t.amt });
  return [sums.essentials/total, sums.savings/total, sums.wants/total];
}

// Exposed API
window.AI = {
  createModelAdv, loadModel, saveModel, trainFromDB, predictAdvanced, buildTrainingData
};
