// Hotel Planner — Step 4: 지하 볼륨 다이어그램

const SU = {
  floors: [],
  selectedFloors: new Set(),
  selectedCells: new Set(),
  lastClickedFi: null,
  popupEl: null,
  dragSrcFi: null,
};

function initUnderDiagram(){
  if(SU.floors.length > 0){
    const empty   = $('u-diagram-empty');
    const content = $('u-diagram-content');
    if(empty)   empty.style.display   = 'none';
    if(content) content.style.display = 'flex';
    renderUnderDiagram();
  }
}

function applyUnderFloors(){
  const cnt = Math.max(1, Math.min(10, ni('under-floor-count') || 1));
  buildUnderFloors(cnt);
  const empty = $('u-diagram-empty');
  const content = $('u-diagram-content');
  if(empty) empty.style.display = 'none';
  if(content){ content.style.display = 'flex'; }
}

function buildUnderFloors(cnt){
  const area = state.underDesignArea || state.siteArea || 2400;
  SU.floors = [];
  for(let i = 0; i < cnt; i++){
    SU.floors.push({
      cells: [{useId: null, ratio: 1}],
      floorH: 3.5,
      area: Math.round(area),
    });
  }
  SU.selectedFloors.clear();
  SU.selectedCells.clear();
  updateUnderTotals();
  renderUnderDiagram();
}

function updateUnderTotals(){
  const totalArea  = SU.floors.reduce((s,f) => s+f.area, 0);
  const totalDepth = SU.floors.reduce((s,f) => s+f.floorH, 0);
  if($('u-total-area-disp'))  $('u-total-area-disp').textContent  = Math.round(totalArea).toLocaleString() + '㎡';
  if($('u-total-depth-disp')) $('u-total-depth-disp').textContent = totalDepth.toFixed(2) + 'm';
}

function renderUnderDiagram(){
  const blocksEl = $('u-section-blocks');
  const infoEl   = $('u-section-info-col');
  if(!blocksEl || !infoEl) return;
  const empty = $('u-diagram-empty');
  const content = $('u-diagram-content');
  if(empty) empty.style.display = 'none';
  if(content) content.style.display = 'flex';

  const PX_PER_M = 12;
  const maxArea = SU.floors.length > 0 ? Math.max(...SU.floors.map(f=>f.area), 1) : 1;
  blocksEl.innerHTML = '';
  infoEl.innerHTML   = '';

  SU.floors.forEach((floor, fi) => {
    const h = Math.max(floor.floorH * PX_PER_M, 28);
    const widthPct = Math.min(100, Math.round(floor.area / maxArea * 100));
    const blockW   = Math.max(60, Math.round(widthPct / 100 * 500));
    const isSelected = SU.selectedFloors.has(fi);

    const rowWrap = document.createElement('div');
    rowWrap.style.cssText = `height:${h}px;display:flex;align-items:stretch;justify-content:center;`;
    rowWrap.dataset.fi = fi;

    const row = document.createElement('div');
    row.className = 'sec-block-row';
    row.style.cssText = `height:${h}px;border-radius:6px;overflow:hidden;box-sizing:border-box;width:${blockW}px;min-width:60px;max-width:500px;border:${isSelected?'2.5px solid var(--accent)':'1px solid rgba(80,80,80,0.35)'};`;
    row.dataset.fi = fi;

    const isSplit = floor.cells.length > 1;

    if(!isSplit){
      row.addEventListener('click', e=>{
        if(e.target.classList.contains('sec-divider')) return;
        if(e.shiftKey && SU.lastClickedFi !== null){
          const lo=Math.min(SU.lastClickedFi,fi), hi=Math.max(SU.lastClickedFi,fi);
          for(let i=lo;i<=hi;i++){ if(SU.floors[i].cells.length===1) SU.selectedFloors.add(i); }
          SU.lastClickedFi=fi;
        } else {
          if(SU.selectedFloors.has(fi)) SU.selectedFloors.delete(fi);
          else { SU.selectedFloors.add(fi); SU.lastClickedFi=fi; }
        }
        renderUnderDiagram();
      });
    }
    row.addEventListener('contextmenu', e=>{ e.preventDefault(); openUnderUseMenu(e, fi, null); });
    row.addEventListener('mousedown', e=>{
      if(e.button!==0||e.target.classList.contains('sec-divider')) return;
      const sx=e.clientX, sy=e.clientY; let dragging=false;
      function onMove(me){
        if(!dragging&&(Math.abs(me.clientX-sx)>4||Math.abs(me.clientY-sy)>4)){ dragging=true; startUnderFloorDrag(e,fi); }
      }
      function onUp(){ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
    });

    floor.cells.forEach((cell, ci) => {
      const cellKey = `${fi}:${ci}`;
      const isCellSel = SU.selectedCells.has(cellKey);
      const cellEl = document.createElement('div');
      cellEl.className = 'sec-block-cell';
      const col = getUseColor(cell.useId);
      const txtCol = cell.useId ? '#fff' : 'var(--text2)';
      const cellBorder = isCellSel ? 'box-shadow:inset 0 0 0 2.5px #fff,inset 0 0 0 4px var(--accent);' : '';
      cellEl.style.cssText = `flex:${cell.ratio};background:${col};height:100%;color:${txtCol};${cellBorder}`;
      cellEl.dataset.fi=fi; cellEl.dataset.ci=ci;
      if(h>20){
        const lbl=document.createElement('span');
        lbl.style.cssText='pointer-events:none;font-size:11px;font-weight:600;padding:0 4px;text-align:center;'+(cell.useId?'text-shadow:0 1px 2px rgba(0,0,0,0.3);':'');
        lbl.textContent=getUseLabel(cell.useId);
        cellEl.appendChild(lbl);
      }
      if(isSplit){
        cellEl.addEventListener('click', e=>{
          e.stopPropagation();
          if(SU.selectedCells.has(cellKey)) SU.selectedCells.delete(cellKey);
          else SU.selectedCells.add(cellKey);
          renderUnderDiagram();
        });
        cellEl.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); openUnderUseMenu(e,fi,ci); });
      }
      cellEl.addEventListener('dblclick', e=>{ e.stopPropagation(); openUnderPopup(e,fi,ci); });
      row.appendChild(cellEl);
      if(ci < floor.cells.length-1){
        const div=document.createElement('div');
        div.className='sec-divider';
        div.addEventListener('mousedown', e=>{ e.stopPropagation(); startUnderDividerDrag(e,fi,ci); });
        row.appendChild(div);
      }
    });
    updateUnderDividers(row, floor);

    if(SU.dragSrcFi===fi){ row.style.outline='3px solid #f59e0b'; row.style.outlineOffset='2px'; }

    rowWrap.appendChild(row);
    blocksEl.appendChild(rowWrap);

    const infoRow = document.createElement('div');
    infoRow.className = 'sec-info-row';
    infoRow.style.cssText = `height:${h}px;width:166px;border-bottom:1px dashed #6b7280;box-sizing:border-box;display:flex;align-items:center;background:transparent;`;
    infoRow.dataset.fi = fi;

    const floorLabel = document.createElement('span');
    floorLabel.style.cssText = 'width:36px;text-align:center;font-size:10px;font-weight:700;color:var(--text2);flex-shrink:0;';
    floorLabel.textContent = `B${fi+1}F`;

    const hInput = document.createElement('input');
    hInput.type='number';
    hInput.style.cssText='width:50px;border:1px solid var(--border2);border-radius:3px;background:#fafafa;font-size:10px;text-align:center;color:var(--text);font-family:inherit;outline:none;padding:1px 2px;flex-shrink:0;';
    hInput.value=parseFloat(floor.floorH).toFixed(2); hInput.step=0.1; hInput.min=2.4;
    hInput.addEventListener('mousedown',e=>e.stopPropagation());
    hInput.addEventListener('change',()=>{
      SU.floors[fi].floorH=parseFloat(hInput.value)||3.5;
      updateUnderTotals(); renderUnderDiagram();
    });

    const aInput = document.createElement('input');
    aInput.type='number';
    aInput.style.cssText='flex:1;min-width:60px;border:1px solid var(--border2);border-radius:3px;background:#fafafa;font-size:10px;text-align:right;color:var(--text);font-family:inherit;outline:none;padding:1px 4px;margin-left:2px;';
    aInput.value=parseFloat(floor.area).toFixed(2); aInput.step=1;
    aInput.addEventListener('mousedown',e=>e.stopPropagation());
    aInput.addEventListener('change',()=>{
      SU.floors[fi].area=parseInt(aInput.value)||0;
      updateUnderTotals(); renderUnderDiagram();
    });

    infoRow.addEventListener('mousedown',e=>e.stopPropagation());
    infoRow.addEventListener('click',e=>e.stopPropagation());
    infoRow.appendChild(floorLabel);
    infoRow.appendChild(hInput);
    infoRow.appendChild(aInput);
    infoEl.appendChild(infoRow);
  });

  const wrap = $('u-section-diagram-wrap');
  if(wrap){
    wrap.onclick = ev=>{
      if(!ev.target.closest('.sec-block-row')){
        SU.selectedFloors.clear(); SU.lastClickedFi=null; renderUnderDiagram();
      }
    };
  }

  if(!window._suEscRegistered){
    window._suEscRegistered = true;
    document.addEventListener('keydown', ev=>{
      if(ev.key==='Escape' && (SU.selectedFloors.size > 0 || SU.selectedCells.size > 0)){
        SU.selectedFloors.clear();
        SU.selectedCells.clear();
        SU.lastClickedFi = null;
        renderUnderDiagram();
      }
    });
  }

  updateUnderTotals();
}

function updateUnderDividers(rowEl, floor){
  const dividers=rowEl.querySelectorAll('.sec-divider');
  let cum=0;
  const total=floor.cells.reduce((s,c)=>s+c.ratio,0);
  dividers.forEach((d,i)=>{ cum+=floor.cells[i].ratio; d.style.left=(cum/total*100)+'%'; });
}

function openUnderUseMenu(e, fi, ci){
  closeUnderPopup();
  const floor=SU.floors[fi];
  const isSplit=floor.cells.length>1;
  const isCellMode=ci!==null&&ci!==undefined;
  const cellKey=`${fi}:${ci}`;
  if(isCellMode&&!SU.selectedCells.has(cellKey)) SU.selectedCells.add(cellKey);
  if(!isCellMode&&!isSplit&&!SU.selectedFloors.has(fi)){ SU.selectedFloors.add(fi); SU.lastClickedFi=fi; }

  const floorTargets=[...SU.selectedFloors];
  const cellTargets=[...SU.selectedCells];
  const hdrText = isCellMode
    ? `용도 지정 — B${fi+1}F 셀${ci+1} (${cellTargets.length}개 셀 선택)`
    : `용도 지정 (${floorTargets.length}개 층 선택)`;
  const currentUseId = isCellMode ? (floor.cells[ci]?.useId||'') : (floor.cells[0]?.useId||'');

  const menu=document.createElement('div');
  menu.className='sec-popup';
  menu.style.left=Math.min(e.clientX+4,window.innerWidth-220)+'px';
  menu.style.top=Math.min(e.clientY-4,window.innerHeight-200)+'px';
  menu.style.minWidth='180px';
  menu.addEventListener('click',ev=>ev.stopPropagation());
  menu.addEventListener('mousedown',ev=>ev.stopPropagation());
  menu.addEventListener('contextmenu',ev=>ev.preventDefault());

  const hdr=document.createElement('div');
  hdr.style.cssText='font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px;';
  hdr.textContent=hdrText;

  const sel=document.createElement('select');
  sel.style.cssText='width:100%;padding:5px 6px;border-radius:5px;border:1px solid var(--border2);font-size:11px;font-family:inherit;margin-bottom:8px;';
  const opts=[
    {id:'',label:'미지정'},
    ...[...S2.activeUseIds].map(id=>USE_MAP[id]).filter(Boolean),
    USE_MAP['parking'], USE_MAP['mep'], USE_MAP['common']
  ];
  opts.forEach(u=>{
    const o=document.createElement('option');
    o.value=u?.id||''; o.textContent=u?.label||'미지정';
    if((u?.id||'')===currentUseId) o.selected=true;
    sel.appendChild(o);
  });
  sel.addEventListener('mousedown',ev=>ev.stopPropagation());

  const applyBtn=document.createElement('button');
  applyBtn.textContent='적용';
  applyBtn.style.cssText='width:100%;padding:6px;font-size:11px;font-weight:600;border-radius:4px;border:none;cursor:pointer;background:var(--accent);color:#fff;font-family:inherit;';
  applyBtn.addEventListener('mousedown',ev=>ev.stopPropagation());
  applyBtn.onclick=()=>{
    const useId=sel.value||null;
    if(isCellMode){
      SU.selectedCells.forEach(key=>{ const[f,c]=key.split(':').map(Number); if(SU.floors[f]?.cells[c]) SU.floors[f].cells[c].useId=useId; });
      SU.selectedCells.clear();
    } else {
      SU.selectedFloors.forEach(i=>{ if(SU.floors[i]) SU.floors[i].cells[0].useId=useId; });
      SU.selectedFloors.clear(); SU.lastClickedFi=null;
    }
    renderUnderDiagram(); closeUnderPopup();
  };
  menu.appendChild(hdr); menu.appendChild(sel); menu.appendChild(applyBtn);
  document.body.appendChild(menu);
  SU.popupEl=menu;
  setTimeout(()=>document.addEventListener('click',closeUnderPopup,{once:true}),100);
}

function openUnderPopup(e, fi, ci){
  closeUnderPopup();
  const floor=SU.floors[fi];
  const cell=floor.cells[ci];

  const popup=document.createElement('div');
  popup.className='sec-popup';
  popup.style.left=Math.min(e.clientX+4,window.innerWidth-200)+'px';
  popup.style.top=Math.min(e.clientY-10,window.innerHeight-200)+'px';
  popup.addEventListener('click',e=>e.stopPropagation());
  popup.addEventListener('mousedown',e=>e.stopPropagation());

  const btns=document.createElement('div'); btns.className='sec-popup-btns';
  const splitBtn=document.createElement('button'); splitBtn.textContent='⊢ 분할';
  splitBtn.addEventListener('mousedown',e=>e.stopPropagation());
  splitBtn.onclick=()=>{ splitUnderCell(fi,ci); closeUnderPopup(); };
  const mergeBtn=document.createElement('button'); mergeBtn.textContent='⊣ 병합';
  mergeBtn.disabled=floor.cells.length<=1;
  mergeBtn.addEventListener('mousedown',e=>e.stopPropagation());
  mergeBtn.onclick=()=>{ mergeUnderCell(fi,ci); closeUnderPopup(); };
  btns.appendChild(splitBtn); btns.appendChild(mergeBtn);

  const btns2=document.createElement('div'); btns2.className='sec-popup-btns'; btns2.style.marginTop='4px';
  const addBtn=document.createElement('button'); addBtn.textContent='+ 층 추가';
  addBtn.style.cssText='flex:1;padding:4px 2px;font-size:10px;border-radius:4px;border:1px solid var(--border2);cursor:pointer;background:var(--bg3);color:var(--text2);font-family:inherit;';
  addBtn.addEventListener('mousedown',e=>e.stopPropagation());
  addBtn.onclick=()=>{ addUnderFloor(fi); closeUnderPopup(); };
  const delBtn=document.createElement('button'); delBtn.textContent='− 층 삭제';
  delBtn.disabled=SU.floors.length<=1;
  delBtn.style.cssText='flex:1;padding:4px 2px;font-size:10px;border-radius:4px;border:1px solid var(--border2);cursor:pointer;background:var(--bg3);color:var(--red);font-family:inherit;';
  delBtn.addEventListener('mousedown',e=>e.stopPropagation());
  delBtn.onclick=()=>{ deleteUnderFloor(fi); closeUnderPopup(); };
  btns2.appendChild(addBtn); btns2.appendChild(delBtn);

  popup.appendChild(btns); popup.appendChild(btns2);
  document.body.appendChild(popup);
  SU.popupEl=popup;
  setTimeout(()=>document.addEventListener('click',closeUnderPopup,{once:true}),100);
}

function closeUnderPopup(){
  if(SU.popupEl){ SU.popupEl.remove(); SU.popupEl=null; }
}

function splitUnderCell(fi,ci){
  const cells=SU.floors[fi].cells;
  const orig=cells[ci]; const half=orig.ratio/2;
  cells.splice(ci,1,{useId:orig.useId,ratio:half},{useId:null,ratio:half});
  renderUnderDiagram();
}
function mergeUnderCell(fi,ci){
  const cells=SU.floors[fi].cells;
  if(cells.length<=1) return;
  const tgt=ci<cells.length-1?ci+1:ci-1;
  cells[tgt].ratio+=cells[ci].ratio;
  cells.splice(ci,1);
  renderUnderDiagram();
}
function addUnderFloor(fi){
  const avg=SU.floors.length>0?Math.round(SU.floors.reduce((s,f)=>s+f.area,0)/SU.floors.length):2400;
  SU.floors.splice(fi+1,0,{cells:[{useId:null,ratio:1}],floorH:3.5,area:avg});
  updateUnderTotals(); renderUnderDiagram();
}
function deleteUnderFloor(fi){
  if(SU.floors.length<=1) return;
  SU.floors.splice(fi,1);
  updateUnderTotals(); renderUnderDiagram();
}

function startUnderDividerDrag(e,fi,ci){
  e.preventDefault();
  const rowEl=document.querySelector(`#u-section-blocks .sec-block-row[data-fi="${fi}"]`);
  if(!rowEl) return;
  const startX=e.clientX, rowW=rowEl.getBoundingClientRect().width;
  const floor=SU.floors[fi];
  const total=floor.cells.reduce((s,c)=>s+c.ratio,0);
  const sL=floor.cells[ci].ratio, sR=floor.cells[ci+1].ratio, sLR=sL+sR;
  function onMove(me){
    const dR=(me.clientX-startX)/rowW*total;
    const nL=Math.max(0.05,sL+dR), nR=Math.max(0.05,sLR-nL);
    SU.floors[fi].cells[ci].ratio=nL; SU.floors[fi].cells[ci+1].ratio=nR;
    updateUnderDividers(rowEl,SU.floors[fi]);
    rowEl.querySelectorAll('.sec-block-cell').forEach((c,i)=>{ c.style.flex=SU.floors[fi].cells[i]?.ratio||1; });
  }
  function onUp(){ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
  window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
}

function startUnderFloorDrag(e, fi){
  e.preventDefault();
  closeUnderPopup();
  const blocksEl=$('u-section-blocks');
  const rowWraps=Array.from(blocksEl.children);
  const wrapRects=rowWraps.map(w=>w.getBoundingClientRect());
  let curFi=fi;
  SU.dragSrcFi=fi;
  function onMove(me){
    let newFi=curFi, minDist=Infinity;
    wrapRects.forEach((r,i)=>{ const cy=(r.top+r.bottom)/2, dist=Math.abs(me.clientY-cy); if(dist<minDist){minDist=dist;newFi=i;} });
    newFi=Math.max(0,Math.min(SU.floors.length-1,newFi));
    if(newFi!==curFi){
      const tmp=SU.floors[curFi].area; SU.floors[curFi].area=SU.floors[newFi].area; SU.floors[newFi].area=tmp;
      const tmpC=SU.floors[curFi].cells; SU.floors[curFi].cells=SU.floors[newFi].cells; SU.floors[newFi].cells=tmpC;
      curFi=newFi; SU.dragSrcFi=curFi; renderUnderDiagram();
    }
  }
  function onUp(){ SU.dragSrcFi=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); renderUnderDiagram(); }
  window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
}
