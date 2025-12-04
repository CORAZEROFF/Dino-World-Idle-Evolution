// ==============================
// game.js - Dino World (CLEAN & OFFLINE)
// ==============================

// ------------- CONFIG / SAVE KEY -------------
const SAVE_KEY = 'dinoSave_v2';

// ------------- GAME STATE -------------
let state = {
  points: 0,
  fossils: 0,
  nests: 0, gravers: 0, farms: 0, pteros: 0, trikes: 0, tars: 0, statues: 0,
  babyDinos: 0,
  tapPower: 1,
  evoPoints: 0,
  globalMultiplier: 1,
  prestigeMultiplier: 1,
  offlineBonusPct: 0.8,
  dpsHistory: [],
  prestigeTree: {
    tap: { owned:0, cost:1 },
    prod: { owned:2, cost:2 },
    trike: { owned:0, cost:3 },
    tapBoost: { owned:0, cost:4 },
    offline: { owned:0, cost:5 }
  },
  unlockedDinos: ['trex'],
  repeatableUpgrades: {},
  research: {},
  lastSaveTimestamp: Date.now()
};

// ------------- CONSTANTS / DEFINITIONS -------------
const BUILDINGS = [
  { id:'nest', name:'Nest', baseCost:50, baseDPS:1 },
  { id:'graver', name:'Fossil Digger', baseCost:100, baseDPS:0 },
  { id:'farm', name:'Dino Farm', baseCost:500, baseDPS:10 },
  { id:'ptero', name:'Pterodactyl Nest', baseCost:2500, baseDPS:50 },
  { id:'trike', name:'Trike Herd', baseCost:2000, baseDPS:200, unlock:'trike' },
  { id:'tar', name:'Tar Pit Extractor', baseCost:5000, baseDPS:0 },
  { id:'statue', name:'Ancient Statue', baseCost:15000, baseDPS:0 }
];

const PERMANENT_UPGRADES = [
  { id:'sharp_claws', title:'Sharper Claws', desc:'+50% tap power', cost:500, apply: ()=> state.tapPower *= 1.5, required:{} },
  { id:'moss_nests', title:'Improved Nests', desc:'Nests +25% production', cost:800, apply: ()=> state.globalMultiplier *= 1.25, required:{owns:{nest:5}} },
  { id:'twin_hatch', title:'Twin Hatchlings', desc:'Eggs hatch into 2 baby dinos', cost:2000, apply: ()=> state.research.twins = true, required:{owns:{farm:3}} },
  { id:'click_master', title:'Click Mastery', desc:'+100% tap power', cost:5000, apply: ()=> state.tapPower *= 2, required:{evo:1} }
];

const REPEATABLES = [
  { id:'finger_strength', title:'Finger Strength', desc:'Tap power +1', baseCost:300, effect: lvl => ({tapAdd: lvl}) },
  { id:'nest_quality', title:'Nest Quality', desc:'Nests +10% per level', baseCost:400, effect: lvl => ({nestPct: 1 + lvl*0.10}) },
  { id:'farm_feed', title:'Feeding Machines', desc:'Farms +20% per level', baseCost:1200, effect: lvl => ({farmPct: 1 + lvl*0.20}) },
  { id:'trike_alpha', title:'Alpha Trike', desc:'Trikes +100 DPS each level', baseCost:5000, effect: lvl => ({trikeFlat: lvl*100}) }
];

const LAB_RESEARCH = [
  { id:'dna1', title:'DNA Synthesis I', desc:'+15% global production', cost:5, apply: ()=> state.globalMultiplier *= 1.15 },
  { id:'egg_mutation', title:'Egg Mutation', desc:'+200% egg spawn rate', cost:10, apply: ()=> state.research.eggBoost = (state.research.eggBoost||1) * 3 },
  { id:'shadow_event', title:'Shadow Event', desc:'Unlock Shadow Dino events', cost:30, apply: ()=> state.research.shadow = true }
];

const GOLDEN_VARIANTS = [
  { id:'common', chance:0.984, mult:1 },
  { id:'rare', chance:0.013, mult:3 },
  { id:'epic', chance:0.0025, mult:6 },
  { id:'legend', chance:0.0005, mult:12 }
];

const EGG_RARITIES = [
  { id:'common', chance:0.7, babyDPS:0.5 },
  { id:'uncommon', chance:0.2, babyDPS:1 },
  { id:'rare', chance:0.08, babyDPS:3 },
  { id:'epic', chance:0.018, babyDPS:8 },
  { id:'legend', chance:0.002, babyDPS:40 }
];

// ------------- DOM HELPERS -------------
function by(id){ return document.getElementById(id); }
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }

// ------------- UI INIT -------------
function initUI(){
  // Quick buildings
  const quick = by('quickBuildings'); if(quick){
    quick.innerHTML='';
    BUILDINGS.forEach(b=>{
      const box = el('div','shop-item');
      box.innerHTML = `<h3>${b.name}</h3><p>Owned: <span id="${b.id}Count">0</span></p>
        <button id="buy_${b.id}" class="btn">Buy (${b.baseCost})</button>`;
      quick.appendChild(box);
      by(`buy_${b.id}`).onclick = ()=> buyBuilding(b.id);
    });
  }

  // Full buildings list
  const grid = by('buildingsGrid'); if(grid){
    grid.innerHTML='';
    BUILDINGS.forEach(b=>{
      const box = el('div','shop-item');
      box.innerHTML = `<h3>${b.name}</h3><p>${b.baseDPS} DPS each</p>
        Owned: <span id="${b.id}Count2">0</span><br>
        <button id="buy2_${b.id}" class="btn">Buy (${b.baseCost})</button>`;
      grid.appendChild(box);
      by(`buy2_${b.id}`).onclick = ()=> buyBuilding(b.id);
    });
  }

  // Repeatable upgrades
  const ru = by('repeatableUpgrades'); if(ru){
    ru.innerHTML='';
    REPEATABLES.forEach(r=>{
      const card = el('div','upgrade-card');
      card.innerHTML = `
        <h4>${r.title}</h4>
        <p>${r.desc}</p>
        Next Cost: <span id="cost_${r.id}">${r.baseCost}</span><br>
        Level: <span id="lvl2_${r.id}">0</span><br>
        <button id="buyr2_${r.id}" class="btn">Buy</button>`;
      ru.appendChild(card);
      by(`buyr2_${r.id}`).onclick = ()=> buyRepeatable(r.id);
    });
  }

  // Permanent upgrades
  const pu = by('permanentUpgrades'); if(pu){
    pu.innerHTML='';
    PERMANENT_UPGRADES.forEach(u=>{
      const card = el('upgrade-card','upgrade-card');
      card.innerHTML = `
        <h4>${u.title}</h4>
        <p>${u.desc}</p>
        <p>Cost: ${u.cost}</p>
        <button id="perm_${u.id}" class="btn">Buy</button>`;
      pu.appendChild(card);
      by(`perm_${u.id}`).onclick = ()=> buyPermanent(u.id);
    });
  }

  // Prestige tree
  const pt = by('prestigeTreeGrid'); if(pt){
    pt.innerHTML='';
    Object.keys(state.prestigeTree).forEach(k=>{
      const n = state.prestigeTree[k];
      const card = el('div','tree-node');
      card.innerHTML = `
        <h4>${k}</h4>
        Cost: <span id="pt_cost_${k}">${n.cost}</span><br>
        Owned: <span id="pt_owned_${k}">${n.owned}</span><br>
        <button id="pt_buy_${k}" class="btn">Buy</button>`;
      pt.appendChild(card);
      by(`pt_buy_${k}`).onclick = ()=> buyPrestigeNode(k);
    });
  }

  // Lab research
  const lg = by('labGrid'); if(lg){
    lg.innerHTML='';
    LAB_RESEARCH.forEach(r=>{
      const card = el('div','upgrade-card');
      card.innerHTML = `
        <h4>${r.title}</h4><p>${r.desc}</p>
        <p>Cost: ${r.cost} fossils</p>
        <button id="lab_${r.id}" class="btn">Research</button>`;
      lg.appendChild(card);
      by(`lab_${r.id}`).onclick = ()=> buyResearch(r.id);
    });
  }

  renderAllCounts();
}

// ------------- RENDER COUNTS -------------
function renderAllCounts(){
  BUILDINGS.forEach(b=>{
    const c = state[b.id+'s'];
    if(by(`${b.id}Count`)) by(`${b.id}Count`).innerText = c;
    if(by(`${b.id}Count2`)) by(`${b.id}Count2`).innerText = c;
  });

  if(by('points')) by('points').innerText = Math.floor(state.points).toLocaleString();
  if(by('fossils')) by('fossils').innerText = Math.floor(state.fossils);
  if(by('fossilsUI')) by('fossilsUI').innerText = Math.floor(state.fossils);
  if(by('evoPointsUI')) by('evoPointsUI').innerText = state.evoPoints;
}

// ------------- BUY BUILDINGS -------------
function buyBuilding(id){
  const b = BUILDINGS.find(x=>x.id===id);
  if(!b) return;

  const owned = state[id+'s'];
  const cost = Math.ceil(b.baseCost * Math.pow(1.15, owned));

  if(state.points < cost) return log('Not enough points');

  state.points -= cost;
  state[id+'s']++;

  if(b.unlock && !state.unlockedDinos.includes(b.unlock))
    state.unlockedDinos.push(b.unlock);

  if(id === 'statue') state.globalMultiplier *= 1.2;

  play('buySound');
  log(`Bought ${b.name} (cost ${cost})`);

  renderAllCounts();
  updateDPS();
}

// ------------- BUY PERMANENT UPGRADE -------------
function buyPermanent(id){
  const i = PERMANENT_UPGRADES.findIndex(x=>x.id===id);
  if(i < 0) return;

  const u = PERMANENT_UPGRADES[i];
  if(state.points < u.cost) return log('Not enough points');

  // requirements check
  if(u.required && u.required.owns){
    for(const k in u.required.owns){
      if(state[k+'s'] < u.required.owns[k])
        return log('Requirement not met');
    }
  }

  state.points -= u.cost;
  u.apply();

  PERMANENT_UPGRADES.splice(i,1);

  play('buySound');
  log(`Purchased ${u.title}`);

  initUI();
  renderAllCounts();
  updateDPS();
}

// ------------- BUY REPEATABLE -------------
function buyRepeatable(id){
  const r = REPEATABLES.find(x=>x.id===id);
  if(!r) return;

  const lvl = state.repeatableUpgrades[id] || 0;
  const cost = Math.ceil(r.baseCost * Math.pow(1.5, lvl));

  if(state.points < cost) return log('Not enough points');

  state.points -= cost;
  state.repeatableUpgrades[id] = lvl + 1;

  play('buySound');
  log(`Bought ${r.title} level ${lvl+1}`);

  if(by(`lvl2_${id}`))
    by(`lvl2_${id}`).innerText = state.repeatableUpgrades[id];

  if(by(`cost_${id}`))
    by(`cost_${id}`).innerText = Math.ceil(r.baseCost * Math.pow(1.5, lvl+1));

  renderAllCounts();
  updateDPS();
}

// ------------- PRESTIGE -------------
function buyPrestigeNode(key){
  const node = state.prestigeTree[key];
  if(!node) return;

  if(state.evoPoints < node.cost)
    return log('Not enough evolution points');

  state.evoPoints -= node.cost;
  node.owned++;
  node.cost = Math.ceil(node.cost * 2);

  if(key==='tap') state.tapPower += 1;
  if(key==='prod') state.globalMultiplier *= 1.10;
  if(key==='trike') if(!state.unlockedDinos.includes('trike')) state.unlockedDinos.push('trike');
  if(key==='tapBoost') state.tapPower = Math.ceil(state.tapPower * 1.25);
  if(key==='offline') state.offlineBonusPct += 0.25;

  initUI();
  renderAllCounts();
  updateDPS();

  log(`Prestige node ${key} purchased`);
}

// ------------- RESEARCH -------------
function buyResearch(id){
  const r = LAB_RESEARCH.find(x=>x.id===id);
  if(!r) return;

  if(state.fossils < r.cost || state.research[id])
    return log('Not enough fossils or already researched');

  state.fossils -= r.cost;
  state.research[id] = true;
  r.apply();

  play('buySound');
  log(`Research ${r.title} complete`);

  initUI();
  renderAllCounts();
  updateDPS();
}

// ------------- DPS CALC -------------
function calcDPS(){
  const nestsD = state.nests * 1;
  const farmsD = state.farms * 10;
  const pterosD = state.pteros * 50;
  const trikesD = state.trikes * 200;
  const babyD = state.babyDinos * 0.5;

  let nestPct = 1, farmPct = 1, trikeFlat = 0;

  REPEATABLES.forEach(r=>{
    const lvl = state.repeatableUpgrades[r.id] || 0;
    if(lvl){
      const eff = r.effect(lvl);
      if(eff.nestPct) nestPct = eff.nestPct;
      if(eff.farmPct) farmPct = eff.farmPct;
      if(eff.trikeFlat) trikeFlat = eff.trikeFlat;
    }
  });

  const base = 
    nestsD * nestPct +
    farmsD * farmPct +
    pterosD +
    (trikesD + trikeFlat) +
    babyD;

  return base * state.globalMultiplier * state.prestigeMultiplier;
}

// ------------- CLICK HANDLER -------------
const clickBtn = by('clickDino');
if(clickBtn){
  clickBtn.addEventListener('click', ()=>{
    const lvl = state.repeatableUpgrades['finger_strength'] || 0;
    let gain = state.tapPower + lvl;

    gain *= state.globalMultiplier * state.prestigeMultiplier;

    state.points += gain;

    spawnParticle(`+${Math.floor(gain)}`, {x: window.innerWidth/2, y:window.innerHeight/2});
    play('clickSound');
    renderAllCounts();

    const eggChance = state.research.eggBoost ? 0.06 : 0.02;
    if(Math.random() < eggChance) spawnEgg();
  });
}

// ------------- PARTICLES -------------
function spawnParticle(text,pos){
  const p = el('div','particle');
  const container = by('particles');
  p.innerText = text;

  const x = pos.x + (Math.random()*80-40);
  const y = pos.y + (Math.random()*40-20);

  p.style.left = x+'px';
  p.style.top = y+'px';

  container.appendChild(p);
  setTimeout(()=>p.remove(),900);
}

// ------------- EGGS -------------
function spawnEgg(){
  const egg = by('eggDrop');
  if(!egg) return;

  egg.style.display='block';
  const hide = setTimeout(()=> egg.style.display='none', 10000);

  egg.onclick = ()=>{
    egg.style.display='none';
    clearTimeout(hide);

    const rarity = pickByChance(EGG_RARITIES);
    state.babyDinos++;

    log(`🥚 Hatched ${rarity.id} baby dino (+${rarity.babyDPS} DPS)`);
    play('eventSound');

    renderAllCounts();
  };
}

// ------------- GOLDEN DINO -------------
let goldenActive = false;

function maybeGolden(){
  if(!goldenActive && Math.random() < 0.008)
    spawnGolden();
}

function spawnGolden(){
  goldenActive = true;
  const g = by('goldenDino');

  g.style.display='block';

  const variant = pickByChance(GOLDEN_VARIANTS);
  g.dataset.mult = variant.mult;

  const timeout = setTimeout(()=>{
    g.style.display='none';
    goldenActive=false;
  },9000);

  g.onclick = ()=>{
    const base = 500 + Math.floor(Math.random()*1500);
    const bonus = Math.floor(base * state.prestigeMultiplier * variant.mult);

    state.points += bonus;
    log(`Golden (${variant.id}) clicked: +${bonus}`);

    play('eventSound');
    renderAllCounts();

    clearTimeout(timeout);
    g.style.display='none';
    goldenActive=false;
  };
}

// ------------- PRESTIGE BUTTON -------------
const prestigeBtn = by('prestigeBtn');
if(prestigeBtn){
  prestigeBtn.addEventListener('click', ()=>{
    if(state.points < 50000) return log('Need 50k points to evolve.');

    state.evoPoints++;
    state.prestigeMultiplier *= 2.5;

    state.points = 0;
    state.fossils = 0;
    state.nests = state.gravers = state.farms = state.pteros = state.trikes = state.tars = state.statues = 0;
    state.babyDinos = 0;
    state.tapPower = 1;
    state.globalMultiplier = 1;

    log('Evolved! Prestige increased.');
    play('prestigeSound');

    renderAllCounts();
    updateDPS();
  });
}

// ------------- UTILS -------------
function pickByChance(list){
  const r = Math.random();
  let acc = 0;
  for(const item of list){
    acc += item.chance;
    if(r <= acc) return item;
  }
  return list[list.length-1];
}

function play(id){
  const s = by(id);
  if(!s) return;
  s.currentTime = 0;
  s.play().catch(()=>{});
}

function log(text){
  const box = by('eventOutput');
  if(!box) return;

  const p = el('p');
  p.innerText = text;
  box.prepend(p);

  while(box.children.length > 80)
    box.removeChild(box.lastChild);
}

// ------------- DPS GRAPH -------------
const canvas = by('dpsCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

function drawGraph(){
  if(!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const hist = state.dpsHistory;
  if(hist.length === 0) return;

  const max = Math.max(...hist,1);

  ctx.strokeStyle='#ffd26a';
  ctx.lineWidth=2;
  ctx.beginPath();

  hist.forEach((v,i)=>{
    const x = (i/(120-1))*canvas.width;
    const y = canvas.height - (v/max)*(canvas.height-20) - 10;
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
  ctx.fillStyle='white';
  ctx.fillText(`Max: ${Math.round(max)}`,8,14);
}

// ------------- OFFLINE REWARD -------------
function handleOffline(){
  const now = Date.now();
  let elapsed = Math.floor((now - state.lastSaveTimestamp)/1000);

  if(elapsed < 5){
    state.lastSaveTimestamp = now;
    return;
  }

  const cap = 21600;
  if(elapsed > cap) elapsed = cap;

  const offlinePoints = Math.floor(calcDPS() * elapsed * state.offlineBonusPct);

  if(offlinePoints <= 0){
    state.lastSaveTimestamp = now;
    return;
  }

  const modal = by('offlineModal');
  by('offlineTime').innerText = elapsed;
  by('offlinePoints').innerText = offlinePoints.toLocaleString();

  modal.style.display='flex';

  by('claimOffline').onclick = ()=>{
    state.points += offlinePoints;
    modal.style.display='none';
    state.lastSaveTimestamp = Date.now();
    renderAllCounts();
  };

  by('dismissOffline').onclick = ()=>{
    modal.style.display='none';
    state.lastSaveTimestamp = Date.now();
  };
}

// ------------- LOCAL SAVE / LOAD -------------
function saveAll(){
  state.lastSaveTimestamp = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadAll(){
  const saved = localStorage.getItem(SAVE_KEY);
  if(saved){
    Object.assign(state, JSON.parse(saved));
  }

  initUI();
  renderAllCounts();
  handleOffline();
  drawGraph();
}

// ------------- AUTO LOOPS -------------
function autoLoops(){
  setInterval(()=>{
    const d = calcDPS();
    state.dpsHistory.push(d);
    if(state.dpsHistory.length > 120)
      state.dpsHistory.shift();

    state.points += d;
    state.fossils += state.gravers;
    state.fossils += state.tars * 5;

    renderAllCounts();
    drawGraph();

  },1000);

  setInterval(maybeGolden,5000);
  setInterval(saveAll,3000);
}

// ------------- DPS UPDATE -------------
function updateDPS(){
  const d = calcDPS();
  if(by('dpsText')) by('dpsText').innerText = formatNumber(d);

  state.dpsHistory.push(d);
  if(state.dpsHistory.length > 120)
    state.dpsHistory.shift();

  drawGraph();
}

function formatNumber(n){
  if(n < 1000) return Math.floor(n);
  if(n < 1e6) return (n/1000).toFixed(1)+'k';
  return n.toExponential(2);
}

// ------------- TAB HANDLING -------------
document.querySelectorAll('.tab').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;

    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    const panel = document.getElementById(tab);
    if(panel) panel.classList.add('active');
  };
});

// ------------- INIT -------------
loadAll();
autoLoops();
updateDPS();

// Expose local-only save functions
window.getSaveState = ()=> structuredClone(state);
window.resetLocalSave = ()=> { localStorage.removeItem(SAVE_KEY); location.reload(); };
