// Hotel Planner — Step 3: 지상 볼륨 단면 조닝 다이어그램

const USE_TYPES = [
  {id:'hotel',   label:'관광숙박시설',  color:'#2563eb', floorH:3.6},
  {id:'office',  label:'업무시설',      color:'#7c3aed', floorH:4.0},
  {id:'retail',  label:'판매시설',      color:'#ea580c', floorH:4.5},
  {id:'culture', label:'문화집회시설',  color:'#16a34a', floorH:5.0},
  {id:'sports',  label:'운동시설',      color:'#0891b2', floorH:4.0},
  {id:'medical', label:'의료시설',      color:'#dc2626', floorH:3.6},
  {id:'edu',     label:'교육연구시설',  color:'#9333ea', floorH:3.6},
  {id:'reside',  label:'공동주택',      color:'#065f46', floorH:3.0},
  {id:'nr1',     label:'제1종근린생활', color:'#ca8a04', floorH:3.5},
  {id:'nr2',     label:'제2종근린생활', color:'#b45309', floorH:3.5},
  {id:'lodge',   label:'숙박시설',      color:'#1d4ed8', floorH:3.3},
  {id:'indust',  label:'제2종근린공업', color:'#475569', floorH:4.0},
  {id:'parking', label:'주차장',        color:'#94a3b8', floorH:3.0, fixed:true},
  {id:'mep',     label:'MEP',           color:'#64748b', floorH:3.0, fixed:true},
  {id:'common',  label:'공용부',        color:'#6b7280', floorH:3.5, fixed:true},
];
const USE_MAP = Object.fromEntries(USE_TYPES.map(u=>[u.id,u]));

const S2 = {
  activeUseIds: new Set(),
  floors: [],
  popupEl: null,
  dragSrcFi: null,
  selectedFloors: new Set(),
  selectedCells: new Set(),
  lastClickedFi: null,
};

function initStep2(){
  buildUseBtns();
  if(!state.maxGFA || state.maxGFA <= 0){
    const blocksEl = $('section-blocks');
    const infoEl   = $('section-info-col');
    if(blocksEl) blocksEl.innerHTML = '<div style="padding:40px;color:var(--text3);font-size:12px;text-align:center;">좌측에서 건폐율·용적률·높이를<br>입력한 후 [적용] 버튼을 누르세요</div>';
    if(infoEl)   infoEl.innerHTML   = '';
    if($('total-height-disp')) $('total-height-disp').textContent = '-';
    if($('remain-area-disp'))  $('remain-area-disp').textContent  = '-';
    return;
  }
  if(S2.floors.length === 0) buildFloors();
  renderDiagram();
}

function buildUseBtns(){
  const wrap = $('use-btn-list');
  if(!wrap) return;
  wrap.innerHTML = USE_TYPES.filter(u=>!u.fixed).map(u=>`
    <button class="use-btn" id="ubtn-${u.id}" onclick="toggleUse('${u.id}')"
      style="${S2.activeUseIds.has(u.id)?'background:'+u.color+';color:#fff;border-color:transparent;':''}"
    >${u.label}</button>
  `).join('');
}

function toggleUse(id){
  if(S2.activeUseIds.has(id)) S2.activeUseIds.delete(id);
  else S2.activeUseIds.add(id);
  const btn = $(`ubtn-${id}`);
  const u = USE_MAP[id];
  if(btn){
    btn.classList.toggle('active', S2.activeUseIds.has(id));
    btn.style.background = S2.activeUseIds.has(id) ? u.color : '';
    btn.style.color = S2.activeUseIds.has(id) ? '#fff' : '';
    btn.style.borderColor = S2.activeUseIds.has(id) ? 'transparent' : '';
  }
}

function buildFloors(){
  const maxH   = state.maxHeight || 90;
  const gfa    = state.maxGFA || 8000;
  const defaultH = 4.0;
  const floorCount = Math.floor(maxH / defaultH);
  const areaPerFloor = Math.round(gfa / floorCount);

  S2.floors = [];
  for(let i=0;i<floorCount;i++){
    S2.floors.push({
      cells:[{useId:null,ratio:1}],
      floorH: defaultH,
      area: areaPerFloor,
    });
  }
  updateTotals();
}

function updateTotals(){
  const totalH    = S2.floors.reduce((s,f)=>s+f.floorH, 0);
  const totalArea = S2.floors.reduce((s,f)=>s+f.area, 0);
  const maxH      = state.maxHeight || 0;
  const maxGFA    = state.maxGFA || 0;
  const maxCov    = state.maxCoverage || 0;
  const remain    = maxGFA - totalArea;
  const heightOver = totalH - maxH;

  if($('total-height-disp')){
    $('total-height-disp').textContent = totalH.toFixed(1) + 'm';
    $('total-height-disp').style.color = heightOver > 0.1 ? 'var(--red)' : 'var(--text)';
  }
  if($('max-height-disp')) $('max-height-disp').textContent = maxH;

  if($('total-area-disp')) $('total-area-disp').textContent = Math.round(totalArea).toLocaleString() + '㎡';
  if($('max-gfa-disp')) $('max-gfa-disp').textContent = Math.round(maxGFA).toLocaleString();
  if($('remain-area-disp')){
    $('remain-area-disp').textContent = (remain >= 0 ? '+' : '') + Math.round(remain).toLocaleString();
    $('remain-area-disp').style.color = Math.abs(remain) < 1 ? 'var(--red)' : remain < 0 ? 'var(--red)' : 'var(--accent)';
  }

  const maxFloorArea = S2.floors.length > 0 ? Math.max(...S2.floors.map(f=>f.area)) : 0;
  const covRemain = maxCov - maxFloorArea;
  if($('total-coverage-disp')) $('total-coverage-disp').textContent = maxFloorArea.toLocaleString() + '㎡';
  if($('max-coverage-disp')) $('max-coverage-disp').textContent = maxCov.toLocaleString();

  const hRemain = (maxH - totalH);
  if($('total-height-disp')){
    $('total-height-disp').textContent = totalH.toFixed(2) + 'm';
    $('total-height-disp').style.color = hRemain < -0.01 ? 'var(--red)' : 'var(--text)';
  }
  if($('max-height-disp')) $('max-height-disp').textContent = maxH.toFixed(2);

  const siteArea = state.siteArea || 1;
  const currentBCR = maxFloorArea / siteArea * 100;
  const currentFAR = totalArea / siteArea * 100;
  const maxBCR = state.bcr || 0;
  const maxFAR = state.far || 0;
  const bcrEl = $('bcr-disp');
  if(bcrEl){
    bcrEl.textContent = currentBCR.toFixed(2) + '%';
    bcrEl.style.color = currentBCR > maxBCR + 0.01 ? 'var(--red)' : 'var(--accent)';
  }
  const farEl = $('far-disp');
  if(farEl){
    farEl.textContent = currentFAR.toFixed(2) + '%';
    farEl.style.color = currentFAR > maxFAR + 0.01 ? 'var(--red)' : 'var(--accent)';
  }
  const remHEl = $('remain-height-disp');
  if(remHEl){
    remHEl.textContent = (hRemain >= 0 ? '+' : '') + hRemain.toFixed(2);
    remHEl.style.color = Math.abs(hRemain) < 0.01 ? 'var(--red)' : hRemain < 0 ? 'var(--red)' : 'var(--accent)';
  }

  const covRemainEl = $('remain-coverage-disp');
  if(covRemainEl){
    covRemainEl.textContent = (covRemain >= 0 ? '+' : '') + covRemain.toFixed(2);
    covRemainEl.style.color = Math.abs(covRemain) < 0.01 ? 'var(--red)' : covRemain < 0 ? 'var(--red)' : 'var(--accent)';
  }
}

function getUseColor(useId){ return useId ? (USE_MAP[useId]?.color||'#e2e4ea') : '#e2e4ea'; }
function getUseLabel(useId){ return useId ? (USE_MAP[useId]?.label||useId) : '미지정'; }

function renderDiagram(){
  const blocksEl = $('section-blocks');
  const infoEl   = $('section-info-col');
  if(!blocksEl||!infoEl) return;

  const PX_PER_M = 12;
  const maxCov = state.maxCoverage || Math.max(...S2.floors.map(f=>f.area), 1);
  blocksEl.innerHTML = '';
  infoEl.innerHTML   = '';

  S2.floors.forEach((floor, fi)=>{
    const h = Math.max(floor.floorH * PX_PER_M, 28);
    const widthPct = Math.min(100, Math.round(floor.area / maxCov * 100));

    const rowWrap = document.createElement('div');
    rowWrap.style.cssText = `height:${h}px;display:flex;align-items:stretch;justify-content:center;`;
    rowWrap.dataset.fi = fi;

    const row = document.createElement('div');
    row.className = 'sec-block-row';
    const blockW = Math.max(60, Math.round(widthPct / 100 * 500));
    const isSelected = S2.selectedFloors.has(fi);
    row.style.cssText = `height:${h}px;border-radius:6px;overflow:hidden;box-sizing:border-box;width:${blockW}px;min-width:60px;max-width:500px;border:${isSelected?'2.5px solid var(--accent)':'1px solid rgba(80,80,80,0.35)'};`;
    row.dataset.fi = fi;

    const isSplit = floor.cells.length > 1;

    if(!isSplit){
      row.addEventListener('click', e=>{
        if(e.target.classList.contains('sec-divider')) return;
        if(e.shiftKey && S2.lastClickedFi !== null){
          const lo=Math.min(S2.lastClickedFi,fi), hi=Math.max(S2.lastClickedFi,fi);
          for(let i=lo;i<=hi;i++){ if(S2.floors[i].cells.length===1) S2.selectedFloors.add(i); }
          S2.lastClickedFi=fi;
        } else {
          if(S2.selectedFloors.has(fi)) S2.selectedFloors.delete(fi);
          else { S2.selectedFloors.add(fi); S2.lastClickedFi=fi; }
        }
        renderDiagram();
      });
    }

    row.addEventListener('contextmenu', e=>{ e.preventDefault(); openUseMenu(e, fi, null); });

    row.addEventListener('mousedown', e=>{
      if(e.button!==0) return;
      if(e.target.classList.contains('sec-divider')) return;
      const startX=e.clientX, startY=e.clientY; let dragging=false;
      function onMove(me){
        if(!dragging&&(Math.abs(me.clientX-startX)>4||Math.abs(me.clientY-startY)>4)){ dragging=true; startFloorDrag(e,fi); }
      }
      function onUp(){ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
    });

    floor.cells.forEach((cell, ci)=>{
      const cellKey = `${fi}:${ci}`;
      const isCellSelected = S2.selectedCells.has(cellKey);
      const cellEl = document.createElement('div');
      cellEl.className = 'sec-block-cell';
      const cellColor = getUseColor(cell.useId);
      const cellTextColor = cell.useId ? '#fff' : 'var(--text2)';
      const cellBorder = isCellSelected ? 'box-shadow:inset 0 0 0 2.5px #fff,inset 0 0 0 4px var(--accent);' : '';
      cellEl.style.cssText = `flex:${cell.ratio};background:${cellColor};height:100%;color:${cellTextColor};${cellBorder}`;
      cellEl.dataset.fi = fi;
      cellEl.dataset.ci = ci;
      if(h > 20){
        const lbl = document.createElement('span');
        lbl.style.cssText = 'pointer-events:none;font-size:11px;font-weight:600;padding:0 4px;text-align:center;' + (cell.useId?'text-shadow:0 1px 2px rgba(0,0,0,0.3);':'');
        lbl.textContent = getUseLabel(cell.useId);
        cellEl.appendChild(lbl);
      }

      if(isSplit){
        cellEl.addEventListener('click', e=>{
          e.stopPropagation();
          if(S2.selectedCells.has(cellKey)) S2.selectedCells.delete(cellKey);
          else S2.selectedCells.add(cellKey);
          renderDiagram();
        });
        cellEl.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); openUseMenu(e, fi, ci); });
      }

      cellEl.addEventListener('dblclick', e=>{ e.stopPropagation(); openPopup(e, fi, ci); });
      row.appendChild(cellEl);

      if(ci < floor.cells.length-1){
        const div = document.createElement('div');
        div.className = 'sec-divider';
        div.addEventListener('mousedown', e=>{ e.stopPropagation(); startDividerDrag(e, fi, ci); });
        row.appendChild(div);
      }
    });
    updateDividers(row, floor);

    if(S2.dragSrcFi === fi){
      row.style.outline = '3px solid #f59e0b';
      row.style.outlineOffset = '2px';
    }

    rowWrap.appendChild(row);
    blocksEl.appendChild(rowWrap);

    const infoRow = document.createElement('div');
    infoRow.className = 'sec-info-row';
    infoRow.style.cssText = `height:${h}px;width:166px;border-bottom:1px dashed #6b7280;box-sizing:border-box;display:flex;align-items:center;background:transparent;`;
    infoRow.dataset.fi = fi;

    const floorLabel = document.createElement('span');
    floorLabel.style.cssText = 'width:36px;text-align:center;font-size:10px;font-weight:700;color:var(--text2);flex-shrink:0;';
    floorLabel.textContent = (fi+1)+'F';

    const hInput = document.createElement('input');
    hInput.type='number';
    hInput.style.cssText='width:50px;border:1px solid var(--border2);border-radius:3px;background:#fafafa;font-size:10px;text-align:center;color:var(--text);font-family:inherit;outline:none;padding:1px 2px;flex-shrink:0;';
    hInput.value=parseFloat(floor.floorH).toFixed(2); hInput.step=0.1; hInput.min=2.4;
    hInput.addEventListener('mousedown',e=>e.stopPropagation());
    hInput.addEventListener('change',()=>{
      S2.floors[fi].floorH = parseFloat(hInput.value)||4;
      updateTotals(); renderDiagram();
    });

    const aInput = document.createElement('input');
    aInput.type='number';
    aInput.style.cssText='flex:1;min-width:60px;border:1px solid var(--border2);border-radius:3px;background:#fafafa;font-size:10px;text-align:right;color:var(--text);font-family:inherit;outline:none;padding:1px 4px;margin-left:2px;';
    aInput.value=parseFloat(floor.area).toFixed(2); aInput.step=1;
    aInput.addEventListener('mousedown',e=>e.stopPropagation());
    aInput.addEventListener('change',()=>{
      const maxCov = state.maxCoverage || Infinity;
      let val = parseInt(aInput.value)||0;
      if(val > maxCov){
        showToast(`⚠️ 최대 건축면적 ${Math.round(maxCov).toLocaleString()}㎡를 초과할 수 없습니다`);
        val = Math.round(maxCov);
        aInput.value = val;
      }
      S2.floors[fi].area = val;
      updateTotals(); renderDiagram();
    });

    infoRow.addEventListener('mousedown', e=>e.stopPropagation());
    infoRow.addEventListener('click', e=>e.stopPropagation());
    infoRow.appendChild(floorLabel);
    infoRow.appendChild(hInput);
    infoRow.appendChild(aInput);
    infoEl.appendChild(infoRow);
  });

  const wrap = $('section-diagram-wrap');
  if(wrap){
    wrap.onclick = ev=>{
      if(!ev.target.closest('.sec-block-row')){
        S2.selectedFloors.clear();
        S2.lastClickedFi = null;
        renderDiagram();
      }
    };
  }

  if(!window._s2EscRegistered){
    window._s2EscRegistered = true;
    document.addEventListener('keydown', ev=>{
      if(ev.key==='Escape' && (S2.selectedFloors.size > 0 || S2.selectedCells.size > 0)){
        S2.selectedFloors.clear();
        S2.selectedCells.clear();
        S2.lastClickedFi = null;
        renderDiagram();
      }
    });
  }
}

function updateDividers(rowEl, floor){
  const dividers = rowEl.querySelectorAll('.sec-divider');
  let cum = 0;
  const total = floor.cells.reduce((s,c)=>s+c.ratio,0);
  dividers.forEach((d,i)=>{ cum+=floor.cells[i].ratio; d.style.left=(cum/total*100)+'%'; });
}

function openPopup(e, fi, ci){
  closePopup();
  const floor = S2.floors[fi];
  const cell  = floor.cells[ci];

  const popup = document.createElement('div');
  popup.className = 'sec-popup';
  popup.style.left = Math.min(e.clientX+4, window.innerWidth-200)+'px';
  popup.style.top  = Math.min(e.clientY-10, window.innerHeight-200)+'px';
  popup.addEventListener('click', e=>e.stopPropagation());
  popup.addEventListener('mousedown', e=>e.stopPropagation());

  const btns = document.createElement('div');
  btns.className = 'sec-popup-btns';

  const splitBtn = document.createElement('button');
  splitBtn.textContent = '⊢ 분할';
  splitBtn.addEventListener('mousedown', e=>e.stopPropagation());
  splitBtn.onclick = ()=>{ splitCell(fi,ci); closePopup(); };

  const mergeBtn = document.createElement('button');
  mergeBtn.textContent = '⊣ 병합';
  mergeBtn.disabled = floor.cells.length<=1;
  mergeBtn.addEventListener('mousedown', e=>e.stopPropagation());
  mergeBtn.onclick = ()=>{ mergeCell(fi,ci); closePopup(); };

  btns.appendChild(splitBtn);
  btns.appendChild(mergeBtn);

  const btns2 = document.createElement('div');
  btns2.className = 'sec-popup-btns';
  btns2.style.marginTop = '4px';

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 층 추가';
  addBtn.style.cssText='flex:1;padding:4px 2px;font-size:10px;border-radius:4px;border:1px solid var(--border2);cursor:pointer;background:var(--bg3);color:var(--text2);font-family:inherit;';
  addBtn.addEventListener('mousedown', e=>e.stopPropagation());
  addBtn.onclick = ()=>{ addFloor(fi); closePopup(); };

  const delBtn = document.createElement('button');
  delBtn.textContent = '− 층 삭제';
  delBtn.disabled = S2.floors.length<=1;
  delBtn.style.cssText='flex:1;padding:4px 2px;font-size:10px;border-radius:4px;border:1px solid var(--border2);cursor:pointer;background:var(--bg3);color:var(--red);font-family:inherit;';
  delBtn.addEventListener('mousedown', e=>e.stopPropagation());
  delBtn.onclick = ()=>{ deleteFloor(fi); closePopup(); };

  btns2.appendChild(addBtn);
  btns2.appendChild(delBtn);

  if(floor.cells.length>1){
    const total=floor.cells.reduce((s,c)=>s+c.ratio,0);
    const pct=Math.round(cell.ratio/total*100);
    const pWrap=document.createElement('div');
    pWrap.style.cssText='display:flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;';
    const pLbl=document.createElement('span');
    pLbl.style.color='var(--text3)'; pLbl.textContent='비율';
    const pInput=document.createElement('input');
    pInput.type='number'; pInput.min=5; pInput.max=95; pInput.value=pct;
    pInput.style.cssText='width:50px;padding:3px 5px;border:1px solid var(--border2);border-radius:4px;font-size:11px;font-family:inherit;';
    pInput.addEventListener('mousedown',e=>e.stopPropagation());
    pInput.addEventListener('change',()=>{
      const newPct=Math.max(5,Math.min(95,parseInt(pInput.value)||50));
      const others=floor.cells.filter((_,i)=>i!==ci);
      const otherTotal=others.reduce((s,c)=>s+c.ratio,0);
      if(otherTotal>0){
        S2.floors[fi].cells[ci].ratio=newPct;
        const scale=(100-newPct)/otherTotal;
        others.forEach((c,i)=>{ const idx=i<ci?i:i+1; S2.floors[fi].cells[idx].ratio=Math.max(1,c.ratio*scale); });
      }
      renderDiagram();
    });
    pWrap.appendChild(pLbl); pWrap.appendChild(pInput); pWrap.appendChild(document.createTextNode('%'));
    popup.appendChild(pWrap);
  }

  popup.appendChild(btns);
  popup.appendChild(btns2);
  document.body.appendChild(popup);
  S2.popupEl = popup;
  setTimeout(()=>document.addEventListener('click', closePopup, {once:true}), 100);
}

function openUseMenu(e, fi, ci){
  closePopup();
  const floor = S2.floors[fi];
  const isSplit = floor.cells.length > 1;
  const isCellMode = ci !== null && ci !== undefined;

  const cellKey = `${fi}:${ci}`;
  if(isCellMode && !S2.selectedCells.has(cellKey)){
    S2.selectedCells.add(cellKey);
  }

  if(!isCellMode && !isSplit && !S2.selectedFloors.has(fi)){
    S2.selectedFloors.add(fi);
    S2.lastClickedFi = fi;
  }

  const floorTargets = [...S2.selectedFloors];
  const cellTargets = [...S2.selectedCells];

  let hdrText = '';
  if(isCellMode){
    hdrText = `용도 지정 — ${fi+1}F 셀${ci+1} (${cellTargets.length}개 셀 선택)`;
  } else {
    hdrText = `용도 지정 (${floorTargets.length}개 층 선택)`;
  }

  const currentUseId = isCellMode
    ? (floor.cells[ci]?.useId || '')
    : (floor.cells[0]?.useId || '');

  const menu = document.createElement('div');
  menu.className = 'sec-popup';
  menu.style.left = Math.min(e.clientX+4, window.innerWidth-220)+'px';
  menu.style.top  = Math.min(e.clientY-4, window.innerHeight-200)+'px';
  menu.style.minWidth = '180px';
  menu.addEventListener('click', ev=>ev.stopPropagation());
  menu.addEventListener('mousedown', ev=>ev.stopPropagation());
  menu.addEventListener('contextmenu', ev=>ev.preventDefault());

  const hdr = document.createElement('div');
  hdr.style.cssText='font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px;';
  hdr.textContent = hdrText;

  const sel = document.createElement('select');
  sel.style.cssText='width:100%;padding:5px 6px;border-radius:5px;border:1px solid var(--border2);font-size:11px;font-family:inherit;margin-bottom:8px;';
  const opts=[
    {id:'', label:'미지정'},
    ...[...S2.activeUseIds].map(id=>USE_MAP[id]).filter(Boolean),
    USE_MAP['parking'], USE_MAP['mep'], USE_MAP['common']
  ];
  opts.forEach(u=>{
    const o=document.createElement('option');
    o.value=u?.id||'';
    o.textContent=u?.label||'미지정';
    if((u?.id||'')===currentUseId) o.selected=true;
    sel.appendChild(o);
  });
  sel.addEventListener('mousedown', ev=>ev.stopPropagation());

  const applyBtn = document.createElement('button');
  applyBtn.textContent='적용';
  applyBtn.style.cssText='width:100%;padding:6px;font-size:11px;font-weight:600;border-radius:4px;border:none;cursor:pointer;background:var(--accent);color:#fff;font-family:inherit;';
  applyBtn.addEventListener('mousedown', ev=>ev.stopPropagation());
  applyBtn.onclick = ()=>{
    const useId = sel.value || null;
    if(isCellMode){
      S2.selectedCells.forEach(key=>{
        const [f,c]=key.split(':').map(Number);
        if(S2.floors[f]?.cells[c]) S2.floors[f].cells[c].useId=useId;
      });
      S2.selectedCells.clear();
    } else {
      S2.selectedFloors.forEach(i=>{
        if(S2.floors[i]) S2.floors[i].cells[0].useId=useId;
      });
      S2.selectedFloors.clear();
      S2.lastClickedFi=null;
    }
    renderDiagram();
    closePopup();
  };

  menu.appendChild(hdr);
  menu.appendChild(sel);
  menu.appendChild(applyBtn);
  document.body.appendChild(menu);
  S2.popupEl=menu;
  setTimeout(()=>document.addEventListener('click', closePopup, {once:true}), 100);
}

function closePopup(){
  if(S2.popupEl){ S2.popupEl.remove(); S2.popupEl=null; }
}

function splitCell(fi, ci){
  const cells=S2.floors[fi].cells;
  const orig=cells[ci];
  const half=orig.ratio/2;
  cells.splice(ci,1,{useId:orig.useId,ratio:half},{useId:null,ratio:half});
  renderDiagram();
}

function mergeCell(fi, ci){
  const cells=S2.floors[fi].cells;
  if(cells.length<=1) return;
  const tgt=ci<cells.length-1?ci+1:ci-1;
  cells[tgt].ratio+=cells[ci].ratio;
  cells.splice(ci,1);
  renderDiagram();
}

function addFloor(fi){
  const defaultH = 4.0;
  const areaPerFloor = S2.floors.length > 0
    ? Math.round(S2.floors.reduce((s,f)=>s+f.area,0) / S2.floors.length)
    : Math.round((state.maxGFA||8000) / 20);
  S2.floors.splice(fi+1, 0, {
    cells: [{useId:null, ratio:1}],
    floorH: defaultH,
    area: areaPerFloor,
  });
  updateTotals();
  renderDiagram();
}

function deleteFloor(fi){
  if(S2.floors.length <= 1) return;
  S2.floors.splice(fi, 1);
  updateTotals();
  renderDiagram();
}

function startDividerDrag(e, fi, ci){
  e.preventDefault();
  const rowEl=document.querySelector(`.sec-block-row[data-fi="${fi}"]`);
  if(!rowEl) return;
  const startX=e.clientX;
  const rowW=rowEl.getBoundingClientRect().width;
  const floor=S2.floors[fi];
  const total=floor.cells.reduce((s,c)=>s+c.ratio,0);
  const sL=floor.cells[ci].ratio;
  const sR=floor.cells[ci+1].ratio;
  const sLR=sL+sR;
  function onMove(me){
    const dR=(me.clientX-startX)/rowW*total;
    const nL=Math.max(0.05,sL+dR);
    const nR=Math.max(0.05,sLR-nL);
    S2.floors[fi].cells[ci].ratio=nL;
    S2.floors[fi].cells[ci+1].ratio=nR;
    updateDividers(rowEl,S2.floors[fi]);
    rowEl.querySelectorAll('.sec-block-cell').forEach((c,i)=>{ c.style.flex=S2.floors[fi].cells[i]?.ratio||1; });
  }
  function onUp(){ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
}

function startFloorDrag(e, fi){
  e.preventDefault();
  closePopup();
  const blocksEl=$('section-blocks');
  const rowWraps = Array.from(blocksEl.children);
  const wrapRects = rowWraps.map(w => w.getBoundingClientRect());
  let curFi=fi;
  S2.dragSrcFi=fi;

  function onMove(me){
    let newFi = curFi;
    let minDist = Infinity;
    wrapRects.forEach((r, i) => {
      const centerY = (r.top + r.bottom) / 2;
      const dist = Math.abs(me.clientY - centerY);
      if(dist < minDist){ minDist = dist; newFi = i; }
    });
    newFi = Math.max(0, Math.min(S2.floors.length-1, newFi));
    if(newFi!==curFi){
      const tmp=S2.floors[curFi].area;
      S2.floors[curFi].area=S2.floors[newFi].area;
      S2.floors[newFi].area=tmp;
      const tmpCells=S2.floors[curFi].cells;
      S2.floors[curFi].cells=S2.floors[newFi].cells;
      S2.floors[newFi].cells=tmpCells;
      curFi=newFi;
      S2.dragSrcFi=curFi;
      renderDiagram();
    }
  }
  function onUp(){
    S2.dragSrcFi=null;
    window.removeEventListener('mousemove',onMove);
    window.removeEventListener('mouseup',onUp);
    renderDiagram();
  }
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
}

function generateAlternatives(){
  const fh=n('floor-height')||3.5;
  const lh=n('lobby-height')||6.0;
  const cr=n('core-ratio')||18;
  const sa=state.siteArea||2400;
  const bcr=state.bcr||60;
  const mgfa=state.maxGFA||(sa*8);

  state.floorHeight=fh; state.lobbyHeight=lh; state.coreRatio=cr;

  const footprint=Math.floor(sa*bcr/100);
  const netRatio=(100-cr)/100;
  const floorGFA=Math.floor(footprint);

  function makeAlt(name, ratio, desc){
    const floors=Math.round(mgfa*ratio/(floorGFA));
    const height=Math.round((lh+(floors-1)*fh)*10)/10;
    const gfa=floorGFA*floors;
    return {name,floors,height,gfa,desc};
  }

  const alts=[
    makeAlt('안 A — 표준형',0.85,'균형잡힌 볼륨. 일반적 호텔 규모'),
    makeAlt('안 B — 고층형',1.0,'최대 용적률 활용. 객실 수 극대화'),
    makeAlt('안 C — 저층형',0.70,'저층·고급 유형. 층당 서비스 향상'),
  ];

  const wrap=$('alt-cards-wrap');
  wrap.innerHTML=`<div class="alt-cards">${alts.map((a,i)=>`
    <div class="alt-card" id="alt-${i}" onclick="selectAlt(${i})">
      <div class="alt-name">${a.name}</div>
      <div class="alt-floors">${a.floors}<span style="font-size:16px;font-weight:400;color:var(--text3);">F</span></div>
      <div class="alt-sub">${a.height}m</div>
      <div style="margin-top:10px;font-size:10px;color:var(--text3);line-height:1.5;">${a.desc}</div>
      <div style="margin-top:8px;font-size:10px;color:var(--text2);">연면적 <b>${a.gfa.toLocaleString()}</b> m²</div>
    </div>`).join('')}</div>`;
  window._alts=alts;
}

function selectAlt(i){
  document.querySelectorAll('.alt-card').forEach((c,j)=>c.classList.toggle('selected',j===i));
  const a=window._alts[i];
  state.selectedAlt=a; state.aboveFloors=a.floors;
  $('selected-alt-info').style.display='block';
  $('selected-alt-name').textContent=a.name;
  $('selected-floors').textContent=a.floors;
  $('selected-height').textContent=a.height+' m';
  generateFloorPlan();
}
