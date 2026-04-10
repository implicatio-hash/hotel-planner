// Hotel Planner — Shared State & Utilities
'use strict';

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const state = {
  siteArea: 0, bcr: 0, far: 0,
  maxCoverage: 0, maxGFA: 0,
  aboveFloors: 20, underFloors: 4,
  floorHeight: 3.5, lobbyHeight: 6.0,
  coreRatio: 18,
  parkingReq: 200, underArea: 0,
  bohTotal: 20, bohUnder: 62,
  selectedAlt: null,
  selectedLots: new Set(),
  searchMarker: null,
  floors: [],
  changeLogs: [],
};

// ═══════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════
function $(id){ return document.getElementById(id); }
function n(id){ return parseFloat($(id)?.value)||0; }
function ni(id){ return parseInt($(id)?.value)||0; }

let toastTimer;
function showToast(msg, dur=2800){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}

function goStep(idx){
  document.querySelectorAll('.step-panel').forEach((p,i)=>{
    p.classList.toggle('active', i+1===idx);
  });
  document.querySelectorAll('.step-btn').forEach(b=>{
    b.classList.toggle('active',+b.dataset.step===idx);
  });
  if(idx===1){ if(vMap){ vMap.updateSize(); } else initVMap(); }
  if(idx===2){ syncStep1(); drawLotOutline(); }
  if(idx===3){ initStep2(); }
  if(idx===4){ initUnderDiagram(); }
  if(idx===5){ initBoundaryStep(); }
  if(idx===6){ initFloorPlanStep(); }
}
