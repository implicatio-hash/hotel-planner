// Hotel Planner — Step 6: 기준층 계획

function detectCoreGroups(){
  const els=CD.elements;
  const visited=new Set();
  const groups=[];

  function adjacent(a,b){
    const overlapX=a.x_mm<b.x_mm+b.w_mm && a.x_mm+a.w_mm>b.x_mm;
    const overlapY=a.y_mm<b.y_mm+b.h_mm && a.y_mm+a.h_mm>b.y_mm;
    const touchL=a.x_mm===b.x_mm+b.w_mm, touchR=b.x_mm===a.x_mm+a.w_mm;
    const touchT=a.y_mm===b.y_mm+b.h_mm, touchB=b.y_mm===a.y_mm+a.h_mm;
    return (overlapY&&(touchL||touchR))||(overlapX&&(touchT||touchB));
  }

  els.forEach(el=>{
    if(visited.has(el.uid)) return;
    const group=[], queue=[el];
    visited.add(el.uid);
    while(queue.length){
      const cur=queue.shift(); group.push(cur);
      els.forEach(other=>{ if(visited.has(other.uid)) return; if(adjacent(cur,other)){ visited.add(other.uid); queue.push(other); } });
    }
    groups.push(group);
  });
  return groups;
}

function groupBBox(group){
  const minX=Math.min(...group.map(e=>e.x_mm));
  const minY=Math.min(...group.map(e=>e.y_mm));
  const maxX=Math.max(...group.map(e=>e.x_mm+e.w_mm));
  const maxY=Math.max(...group.map(e=>e.y_mm+e.h_mm));
  return { x_mm:minX, y_mm:minY, w_mm:maxX-minX, h_mm:maxY-minY };
}

let FL = {
  instances: [],
  nextId: 1,
  selected: null,
  drag: null,
  placedGroups: new Set(),
  siteOverlay: null,
  siteDrag: null,
  siteRotate: null,
  selectedFloorType: null,
  _prevOutsideCount: 0,
  roomTypes: [{ id:'A', w_mm:4500, d_mm:9000, locked:true }],
  roomInstances: [],
  roomNextId: 1,
  selectedRoom: null,
  roomDrag: null,
};

async function initFloorPlanStep(){
  if(!FL.siteOverlay) await buildSiteOverlay();
  renderFloorTypeList();
  renderFloorCoreList();
  renderRoomTypeList();
  renderFloorPlan();
  initFloorSVGEvents();
}

function renderFloorTypeList(){
  const list = $('fl-floor-type-list');
  if(!list) return;
  list.innerHTML = '';

  const HOTEL_IDS = ['hotel', 'lodge'];

  const hotelFloors = [];
  S2.floors.forEach((floor, fi)=>{
    floor.cells.forEach(cell=>{
      if(!cell.useId) return;
      if(!HOTEL_IDS.includes(cell.useId)) return;
      const totalRatio = floor.cells.reduce((s,c)=>s+c.ratio, 0);
      const cellArea = Math.round(floor.area * cell.ratio / totalRatio);
      hotelFloors.push({ fi, area: cellArea, floorH: USE_MAP[cell.useId]?.floorH || 3.6 });
    });
  });

  if(!hotelFloors.length){
    list.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:4px;">3페이지에서 관광숙박시설 용도를 지정하세요.</div>';
    return;
  }

  const areaGroups = new Map();
  hotelFloors.forEach(({fi, area, floorH})=>{
    if(!areaGroups.has(area)){
      areaGroups.set(area, { area, floorH, floors: [] });
    }
    areaGroups.get(area).floors.push(fi);
  });

  const sorted = [...areaGroups.values()].sort((a,b)=>b.area-a.area);
  const hotelColor = USE_MAP['hotel']?.color || '#2563eb';

  sorted.forEach(group=>{
    const areaKey = group.area;
    const isSelected = FL.selectedFloorType?.areaKey === areaKey;

    const sortedFloors = [...group.floors].sort((a,b)=>a-b);
    const floorLabel = summarizeFloors(sortedFloors);

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 4px;border-radius:5px;
      background:${isSelected ? hotelColor+'15' : 'var(--bg2)'};
      border:1px solid ${isSelected ? hotelColor : 'var(--border2)'};
      margin-bottom:2px;
      opacity:${FL.selectedFloorType && !isSelected ? '0.4' : '1'};
      pointer-events:${FL.selectedFloorType && !isSelected ? 'none' : 'auto'};`;

    const dot = document.createElement('div');
    dot.style.cssText = `width:8px;height:8px;border-radius:2px;background:${hotelColor};flex-shrink:0;`;

    const lbl = document.createElement('div');
    lbl.style.cssText = 'flex:1;font-size:10px;font-weight:600;color:var(--text);';
    lbl.innerHTML = `${group.area.toLocaleString()}㎡<br>
      <span style="font-size:9px;font-weight:400;color:var(--text3);">${floorLabel} · ${group.floors.length}개층</span>`;

    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    if(isSelected){
      btn.textContent = '선택됨';
      btn.style.cssText = `font-size:10px;padding:3px 8px;background:${hotelColor};color:#fff;border:none;`;
      btn.onclick = ()=>{ FL.selectedFloorType=null; renderFloorTypeList(); updateFloorAreaBar(); };
    } else {
      btn.textContent = '선택';
      btn.style.cssText = 'font-size:10px;padding:3px 8px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);';
      btn.onclick = ()=>selectFloorType(areaKey, group);
    }

    row.append(dot, lbl, btn);
    list.appendChild(row);
  });
}

function summarizeFloors(floors){
  if(!floors.length) return '';
  const ranges = [];
  let start = floors[0], prev = floors[0];
  for(let i=1; i<=floors.length; i++){
    if(i<floors.length && floors[i]===prev+1){
      prev=floors[i];
    } else {
      ranges.push(start===prev ? `${start+1}F` : `${start+1}~${prev+1}F`);
      if(i<floors.length){ start=floors[i]; prev=floors[i]; }
    }
  }
  return ranges.join(', ');
}

function selectFloorType(areaKey, group){
  FL.selectedFloorType = {
    areaKey,
    area: group.area,
    floorH: group.floorH,
    floors: group.floors,
    label: `${group.area.toLocaleString()}㎡`,
  };
  renderFloorTypeList();
  updateFloorAreaBar();
}

function updateFloorAreaBar(){
  const bar = $('fl-area-bar');
  if(!bar) return;

  const ft = FL.selectedFloorType;
  if(!ft){ bar.style.display='none'; return; }

  bar.style.display = 'flex';

  const foyerIds = ['foyer-emg','foyer-evac','foyer-ev','foyer-st'];
  let foyerArea = 0;
  FL.instances.forEach(inst=>{
    if(!inst.group) return;
    inst.group.forEach(el=>{
      if(foyerIds.includes(el.defId)) foyerArea += (el.w_mm/1000)*(el.h_mm/1000);
    });
  });

  let roomArea = 0;
  FL.roomInstances.forEach(inst=>{
    const rt=FL.roomTypes.find(r=>r.id===inst.typeId);
    if(rt) roomArea += (rt.w_mm/1000)*(rt.d_mm/1000);
  });

  const remain = ft.area - foyerArea - roomArea;
  const remainEl = $('fl-remain-area');
  if($('fl-sel-area')) $('fl-sel-area').textContent = Math.round(ft.area).toLocaleString() + '㎡';
  if(remainEl){
    remainEl.textContent = Math.abs(remain).toFixed(1) + '㎡';
    remainEl.style.color = remain < 0 ? 'var(--red)' : 'var(--accent)';
  }
}

function renderRoomTypeList(){
  const list = $('fl-room-type-list');
  if(!list) return;
  list.innerHTML = '';

  FL.roomTypes.forEach(rt=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px;flex-wrap:wrap;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--text2);min-width:34px;';
    lbl.textContent = `Type ${rt.id}`;

    const wWrap = document.createElement('div');
    wWrap.style.cssText = 'display:flex;align-items:center;gap:2px;';
    const wLbl = document.createElement('span');
    wLbl.style.cssText = 'font-size:9px;color:var(--text3);';
    wLbl.textContent = '폭';
    const wInput = document.createElement('input');
    wInput.type='number'; wInput.min='1'; wInput.step='0.1';
    wInput.value = (rt.w_mm/1000).toFixed(2);
    wInput.style.cssText = 'width:52px;padding:3px 4px;border:1px solid var(--border2);border-radius:4px;font-size:10px;font-family:inherit;text-align:center;';
    wInput.onchange = ()=>{ rt.w_mm = Math.round(parseFloat(wInput.value||4.5)*1000); renderFloorPlan(); updateFloorAreaBar(); };
    wWrap.append(wLbl, wInput);

    const dWrap = document.createElement('div');
    dWrap.style.cssText = 'display:flex;align-items:center;gap:2px;';
    const dLbl = document.createElement('span');
    dLbl.style.cssText = 'font-size:9px;color:var(--text3);';
    dLbl.textContent = '깊';
    const dInput = document.createElement('input');
    dInput.type='number'; dInput.min='1'; dInput.step='0.1';
    dInput.value = (rt.d_mm/1000).toFixed(2);
    dInput.style.cssText = 'width:52px;padding:3px 4px;border:1px solid var(--border2);border-radius:4px;font-size:10px;font-family:inherit;text-align:center;';
    dInput.onchange = ()=>{ rt.d_mm = Math.round(parseFloat(dInput.value||9)*1000); renderFloorPlan(); updateFloorAreaBar(); };
    dWrap.append(dLbl, dInput);

    const placeBtn = document.createElement('button');
    placeBtn.className = 'btn btn-sm';
    placeBtn.textContent = '배치';
    placeBtn.style.cssText = 'font-size:10px;padding:3px 8px;background:var(--accent);color:#fff;border:none;cursor:pointer;';
    placeBtn.onclick = ()=> addRoomInstance(rt.id);

    row.append(lbl, wWrap, dWrap, placeBtn);

    if(!rt.locked){
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm';
      delBtn.textContent = '×';
      delBtn.title = `Type ${rt.id} 삭제`;
      delBtn.style.cssText = 'font-size:11px;padding:2px 6px;background:none;color:var(--red);border:1px solid var(--border2);cursor:pointer;';
      delBtn.onclick = ()=> removeRoomType(rt.id);
      row.append(delBtn);
    }

    list.appendChild(row);
  });
}

function addRoomType(){
  const ids = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const usedIds = new Set(FL.roomTypes.map(r=>r.id));
  const nextId = [...ids].find(c=>!usedIds.has(c));
  if(!nextId){ showToast('더 이상 Type을 추가할 수 없습니다.'); return; }
  FL.roomTypes.push({ id:nextId, w_mm:4500, d_mm:9000, locked:false });
  renderRoomTypeList();
}

function removeRoomType(id){
  if(id==='A') return;
  FL.roomTypes = FL.roomTypes.filter(r=>r.id!==id);
  FL.roomInstances = FL.roomInstances.filter(i=>i.typeId!==id);
  renderRoomTypeList();
  renderFloorPlan();
  updateFloorAreaBar();
}

function addRoomInstance(typeId){
  const rt = FL.roomTypes.find(r=>r.id===typeId);
  if(!rt) return;
  let pos = {x_mm:0, y_mm:0};
  outer: for(let y=0; y<40*CELL_MM; y+=SNAP_MM){
    for(let x=0; x<40*CELL_MM; x+=SNAP_MM){
      const roomOvlp = FL.roomInstances.some(i=>{
        const iw=roomInstW(i), ih=roomInstH(i);
        return x < i.x_mm+iw && x+rt.w_mm > i.x_mm &&
               y < i.y_mm+ih && y+rt.d_mm > i.y_mm;
      });
      if(roomOvlp) continue;
      const coreOvlp = FL.instances.some(inst=>{
        const grp=inst.group, bbox=inst.bbox;
        if(!grp||!bbox) return false;
        return grp.some(el=>{
          const ex=inst.x_mm+(el.x_mm-bbox.x_mm);
          const ey=inst.y_mm+(el.y_mm-bbox.y_mm);
          return x < ex+el.w_mm && x+rt.w_mm > ex &&
                 y < ey+el.h_mm && y+rt.d_mm > ey;
        });
      });
      if(!coreOvlp){ pos={x_mm:x,y_mm:y}; break outer; }
    }
  }
  FL.roomInstances.push({ uid:FL.roomNextId++, typeId, x_mm:pos.x_mm, y_mm:pos.y_mm, rotation:0 });
  renderFloorPlan();
  updateFloorAreaBar();
}

function removeRoomInstance(uid){
  FL.roomInstances = FL.roomInstances.filter(i=>i.uid!==uid);
  if(FL.selectedRoom===uid) FL.selectedRoom=null;
  renderFloorPlan();
  updateFloorAreaBar();
}

function rotateRoomInstance(uid){
  const inst = FL.roomInstances.find(i=>i.uid===uid);
  if(!inst) return;
  inst.rotation = (inst.rotation+90)%360;
  renderFloorPlan();
}

function roomInstW(inst){
  const rt=FL.roomTypes.find(r=>r.id===inst.typeId);
  if(!rt) return 0;
  return inst.rotation%180===0 ? rt.w_mm : rt.d_mm;
}
function roomInstH(inst){
  const rt=FL.roomTypes.find(r=>r.id===inst.typeId);
  if(!rt) return 0;
  return inst.rotation%180===0 ? rt.d_mm : rt.w_mm;
}

function isRoomOutsideBuildable(inst){
  if(!FL.siteOverlay?.buildableCoords) return false;
  const x0=inst.x_mm, y0=inst.y_mm;
  const x1=x0+roomInstW(inst), y1=y0+roomInstH(inst);
  for(const [cx,cy] of [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]){
    if(!pointInBuildable(cx,cy)) return true;
  }
  return false;
}

function roomsOverlap(a, b){
  const ax1=a.x_mm, ay1=a.y_mm, ax2=ax1+roomInstW(a), ay2=ay1+roomInstH(a);
  const bx1=b.x_mm, by1=b.y_mm, bx2=bx1+roomInstW(b), by2=by1+roomInstH(b);
  return ax2>bx1 && ax1<bx2 && ay2>by1 && ay1<by2;
}
function roomCollidesWithOthers(moving){
  if(FL.roomInstances.some(i=> i.uid!==moving.uid && roomsOverlap(moving,i))) return true;
  const rx1=moving.x_mm, ry1=moving.y_mm;
  const rx2=rx1+roomInstW(moving), ry2=ry1+roomInstH(moving);
  return FL.instances.some(inst=>{
    const grp=inst.group; const bbox=inst.bbox;
    if(!grp||!bbox) return false;
    return grp.some(el=>{
      const ex=inst.x_mm+(el.x_mm-bbox.x_mm);
      const ey=inst.y_mm+(el.y_mm-bbox.y_mm);
      const ex2=ex+el.w_mm, ey2=ey+el.h_mm;
      return rx2>ex && rx1<ex2 && ry2>ey && ry1<ey2;
    });
  });
}

function renderFloorCoreList(){
  const list = $('fl-core-list');
  if(!list) return;
  list.innerHTML = '';

  const groups = detectCoreGroups();
  if(!groups.length){
    list.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:4px;">5페이지에서 코어를 먼저 배치하세요.</div>';
    return;
  }

  renderSVGWithGroups(groups);

  groups.forEach((group, i) => {
    const bbox = groupBBox(group);
    const w = (bbox.w_mm/1000).toFixed(1);
    const h = (bbox.h_mm/1000).toFixed(1);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 4px;border-radius:5px;background:var(--bg2);border:1px solid var(--border2);margin-bottom:2px;';

    const dot = document.createElement('div');
    dot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${CORE_COLORS[i % CORE_COLORS.length]};flex-shrink:0;`;

    const lbl = document.createElement('div');
    lbl.style.cssText = 'flex:1;font-size:11px;font-weight:600;color:var(--text);';
    lbl.innerHTML = `코어 ${i+1}<br><span style="font-size:9px;font-weight:400;color:var(--text3);">${w}×${h}m / ${group.length}개 요소</span>`;

    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    const alreadyPlaced = FL.placedGroups.has(i);
    btn.textContent = alreadyPlaced ? '배치됨' : '배치';
    btn.disabled = alreadyPlaced;
    btn.style.cssText = alreadyPlaced
      ? 'font-size:10px;padding:3px 8px;background:var(--bg3);color:var(--text3);border:1px solid var(--border2);cursor:not-allowed;'
      : 'font-size:10px;padding:3px 8px;background:var(--accent);color:#fff;border:none;cursor:pointer;';
    if(!alreadyPlaced) btn.onclick = () => addFloorInstance(i);

    row.append(dot, lbl, btn);
    list.appendChild(row);
  });
}

const CORE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

function addFloorInstance(groupIdx){
  const groups=detectCoreGroups();
  const group=groups[groupIdx];
  if(!group) return;
  if(FL.placedGroups.has(groupIdx)) return;
  const bbox=groupBBox(group);
  const pos=findFloorFreePos(bbox.w_mm, bbox.h_mm);
  FL.instances.push({
    uid:FL.nextId++, groupIdx,
    x_mm:pos.x_mm, y_mm:pos.y_mm,
    w_mm:bbox.w_mm, h_mm:bbox.h_mm,
    rotation:0, flipX:false, group, bbox,
  });
  FL.placedGroups.add(groupIdx);
  FL.selected=FL.instances[FL.instances.length-1].uid;
  renderFloorPlan();
  renderFloorCoreList();
  updateFloorAreaBar();
}

function findFloorFreePos(w_mm, h_mm){
  for(let y=0; y<40*CELL_MM; y+=CELL_MM){
    for(let x=0; x<40*CELL_MM; x+=CELL_MM){
      const coreOverlap=FL.instances.some(i=>
        x < i.x_mm+i.w_mm && x+w_mm > i.x_mm &&
        y < i.y_mm+i.h_mm && y+h_mm > i.y_mm
      );
      if(coreOverlap) continue;
      const roomOverlap=FL.roomInstances.some(i=>{
        const iw=roomInstW(i), ih=roomInstH(i);
        return x < i.x_mm+iw && x+w_mm > i.x_mm &&
               y < i.y_mm+ih && y+h_mm > i.y_mm;
      });
      if(!roomOverlap) return {x_mm:x, y_mm:y};
    }
  }
  return {x_mm:0, y_mm:0};
}

function renderFloorPlan(){
  const svg=$('fl-svg');
  if(!svg) return;

  const padMm=2*CELL_MM;
  let maxX=FL.instances.reduce((m,i)=>Math.max(m,i.x_mm+i.w_mm),16*CELL_MM)+padMm;
  let maxY=FL.instances.reduce((m,i)=>Math.max(m,i.y_mm+i.h_mm),12*CELL_MM)+padMm;
  FL.roomInstances.forEach(i=>{ maxX=Math.max(maxX,i.x_mm+roomInstW(i)+padMm); maxY=Math.max(maxY,i.y_mm+roomInstH(i)+padMm); });
  if(FL.siteOverlay){
    const so=FL.siteOverlay, allPts=so.lotCoords.flat();
    if(allPts.length){
      maxX=Math.max(maxX, so.x_mm+Math.max(...allPts.map(p=>Math.abs(p.x)))+padMm);
      maxY=Math.max(maxY, so.y_mm+Math.max(...allPts.map(p=>Math.abs(p.y)))+padMm);
    }
  }
  const W=mmToPx(maxX), H=mmToPx(maxY);
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

  const NS='http://www.w3.org/2000/svg';
  function mk(tag,attrs={}){ const el=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); return el; }

  svg.innerHTML='';
  svg.appendChild(mk('rect',{width:W,height:H,fill:'#f8f9fb'}));

  const gridG=mk('g',{stroke:'#dde0e8','stroke-width':'0.5'});
  for(let xm=0;xm<=maxX;xm+=CELL_MM){ const px=mmToPx(xm); gridG.appendChild(mk('line',{x1:px,y1:0,x2:px,y2:H})); }
  for(let ym=0;ym<=maxY;ym+=CELL_MM){ const py=mmToPx(ym); gridG.appendChild(mk('line',{x1:0,y1:py,x2:W,y2:py})); }
  svg.appendChild(gridG);

  const groups=detectCoreGroups();
  let newOutsideCount = 0;
  FL.instances.forEach(inst=>{
    const x=mmToPx(inst.x_mm), y=mmToPx(inst.y_mm);
    const w=mmToPx(inst.w_mm), h=mmToPx(inst.h_mm);
    const cx=x+w/2, cy=y+h/2;
    const isSel=FL.selected===inst.uid;
    const isOutside=isInstOutsideBuildable(inst);
    if(isOutside) newOutsideCount++;
    const color=CORE_COLORS[inst.groupIdx%CORE_COLORS.length];
    const g=mk('g');

    const group=groups[inst.groupIdx];
    const bbox=inst.bbox;
    if(group){
      group.forEach(el=>{
        const def=CORE_DEF.find(d=>d.id===el.defId); if(!def) return;
        const ex=x+mmToPx(el.x_mm-bbox.x_mm)+1;
        const ey=y+mmToPx(el.y_mm-bbox.y_mm)+1;
        const ew=mmToPx(el.w_mm)-2, eh=mmToPx(el.h_mm)-2;
        const stroke = isOutside ? '#dc2626' : (isSel?'#2563eb':'#9099a8');
        const strokeW = isOutside ? 2.5 : (isSel?2:1);
        const fill = isOutside ? '#fecaca' : '#c8cdd6';
        g.appendChild(mk('rect',{x:ex,y:ey,width:ew,height:eh,
          fill,stroke,'stroke-width':strokeW,rx:1}));
        const t=mk('text',{x:ex+ew/2,y:ey+eh/2+3,'text-anchor':'middle','font-size':'7',
          'font-family':'Pretendard,sans-serif',fill: isOutside?'#dc2626':'#444a56','pointer-events':'none','font-weight':'600'});
        t.textContent=def.label.replace('특별피난','특').replace('피난','피').replace(' EV','EV').replace(' 전실','전');
        g.appendChild(t);
      });
    } else {
      const stroke = isOutside?'#dc2626':(isSel?'#2563eb':color);
      g.appendChild(mk('rect',{x:x+1,y:y+1,width:w-2,height:h-2,
        fill:isOutside?'#fecaca':color+'22',stroke,'stroke-width':isOutside?2.5:(isSel?2.5:1.5),rx:2}));
    }

    const lbl=mk('text',{x:cx,y:y+14,'text-anchor':'middle','font-size':'10','font-weight':'700',
      'font-family':'Pretendard,sans-serif',fill:isOutside?'#dc2626':color,'pointer-events':'none'});
    lbl.textContent=`코어 ${inst.groupIdx+1} (${(inst.w_mm/1000).toFixed(1)}×${(inst.h_mm/1000).toFixed(1)}m)`;
    g.appendChild(lbl);

    svg.appendChild(g);
  });

  const prevOutside = FL._prevOutsideCount || 0;
  FL.roomInstances.forEach(i=>{ if(isRoomOutsideBuildable(i)) newOutsideCount++; });
  if(newOutsideCount > 0 && newOutsideCount !== prevOutside){
    showToast(`⚠️ ${newOutsideCount}개 요소가 건축한계선을 벗어났습니다.`, 3000);
  }
  FL._prevOutsideCount = newOutsideCount;

  FL.roomInstances.forEach(inst=>{
    const rt = FL.roomTypes.find(r=>r.id===inst.typeId);
    if(!rt) return;
    const isSel = FL.selectedRoom===inst.uid;
    const isOut = isRoomOutsideBuildable(inst);
    const iw=roomInstW(inst), ih=roomInstH(inst);
    const x=mmToPx(inst.x_mm), y=mmToPx(inst.y_mm);
    const w=mmToPx(iw), h=mmToPx(ih);
    const cx=x+w/2, cy=y+h/2;
    const rot = ((inst.rotation/90)%4+4)%4;

    const g=mk('g');

    g.appendChild(mk('rect',{x:x+1,y:y+1,width:w-2,height:h-2,
      fill: isOut?'#fecaca':'#fce7f3',
      stroke: isOut?'#dc2626':(isSel?'#2563eb':'#f472b6'),
      'stroke-width': isOut||isSel?2:1, rx:1}));

    const glassLine = [
      {x1:x+2,  y1:y+2,  x2:x+w-2,y2:y+2  },
      {x1:x+w-2,y1:y+2,  x2:x+w-2,y2:y+h-2},
      {x1:x+2,  y1:y+h-2,x2:x+w-2,y2:y+h-2},
      {x1:x+2,  y1:y+2,  x2:x+2,  y2:y+h-2},
    ][rot];
    g.appendChild(mk('line',{...glassLine, stroke:'#2563eb','stroke-width':'3','stroke-linecap':'round'}));

    const corrLine = [
      {x1:x+2,  y1:y+h-2,x2:x+w-2,y2:y+h-2},
      {x1:x+2,  y1:y+2,  x2:x+2,  y2:y+h-2},
      {x1:x+2,  y1:y+2,  x2:x+w-2,y2:y+2  },
      {x1:x+w-2,y1:y+2,  x2:x+w-2,y2:y+h-2},
    ][rot];
    g.appendChild(mk('line',{...corrLine, stroke:'#94a3b8','stroke-width':'1.5','stroke-dasharray':'4,3'}));

    const lbl=mk('text',{x:cx,y:cy+3,'text-anchor':'middle','font-size':'8','font-weight':'700',
      'font-family':'Pretendard,sans-serif',fill:isOut?'#dc2626':'#9d174d','pointer-events':'none'});
    lbl.textContent=`${rt.id} (${(rt.w_mm/1000).toFixed(1)}×${(rt.d_mm/1000).toFixed(1)})`;
    g.appendChild(lbl);

    if(isSel){
      const hc=mk('circle',{cx:x+w-10,cy:y+10,r:9,fill:'#2563eb',style:'cursor:pointer'});
      hc.addEventListener('mousedown',e=>{e.stopPropagation();rotateRoomInstance(inst.uid);});
      g.appendChild(hc);
      const ht=mk('text',{x:x+w-10,y:y+14,'text-anchor':'middle','font-size':'11',fill:'white','pointer-events':'none'});
      ht.textContent='↻'; g.appendChild(ht);
    }

    svg.appendChild(g);
  });

  const so = FL.siteOverlay;
  if(so){
    const ox = mmToPx(so.x_mm), oy = mmToPx(so.y_mm);
    const isSiteSel = so.selected;

    function coordsToPoints(ring){
      return ring.map(p=>`${ox+mmToPx(p.x)},${oy+mmToPx(p.y)}`).join(' ');
    }

    const siteG = mk('g');
    siteG.setAttribute('transform', `rotate(${so.rotation},${ox},${oy})`);
    siteG.setAttribute('data-site','1');

    so.lotCoords.forEach(ring=>{
      siteG.appendChild(mk('polygon',{
        points: coordsToPoints(ring),
        fill:'none', stroke: isSiteSel?'#dc2626':'#e74c3c',
        'stroke-width': isSiteSel?2.5:1.8, 'stroke-linejoin':'round',
      }));
    });

    if(so.buildableCoords){
      so.buildableCoords.forEach(ring=>{
        siteG.appendChild(mk('polygon',{
          points: coordsToPoints(ring),
          fill:'none', stroke: isSiteSel?'#ea580c':'#f97316',
          'stroke-width': isSiteSel?2:1.4,
          'stroke-dasharray':'8,4', 'stroke-linejoin':'round',
        }));
      });
    }

    if(isSiteSel){
      const allPts = so.lotCoords.flat();
      const bx1 = Math.min(...allPts.map(p=>mmToPx(p.x)));
      const by1 = Math.min(...allPts.map(p=>mmToPx(p.y)));
      const bx2 = Math.max(...allPts.map(p=>mmToPx(p.x)));
      const by2 = Math.max(...allPts.map(p=>mmToPx(p.y)));

      const corners = [
        {x: ox+bx1, y: oy+by1, idx:0},
        {x: ox+bx2, y: oy+by1, idx:1},
        {x: ox+bx2, y: oy+by2, idx:2},
        {x: ox+bx1, y: oy+by2, idx:3},
      ];

      corners.forEach(c=>{
        const hc = mk('circle',{
          cx:c.x, cy:c.y, r:8,
          fill:'#dc2626', stroke:'white', 'stroke-width':'2',
          style:'cursor:crosshair', 'data-rot-handle':c.idx,
        });
        hc.addEventListener('mousedown', ev=>{
          ev.stopPropagation(); ev.preventDefault();
          FL.siteRotate = {
            startAngle: Math.atan2(ev.clientY - (svg.getBoundingClientRect().top+oy),
                                   ev.clientX - (svg.getBoundingClientRect().left+ox)) * 180/Math.PI,
            startRotation: so.rotation,
          };
        });
        siteG.appendChild(hc);
        const ht = mk('text',{
          x:c.x, y:c.y+4, 'text-anchor':'middle',
          'font-size':'10', fill:'white', 'pointer-events':'none',
        });
        ht.textContent='↻'; siteG.appendChild(ht);
      });

      const siteLbl=mk('text',{
        x:ox+(bx1+bx2)/2, y:oy+by1-10,
        'text-anchor':'middle','font-size':'9','font-weight':'700',
        'font-family':'Pretendard,sans-serif',
        fill:'#dc2626','pointer-events':'none',
      });
      siteLbl.textContent=`대지 (${so.rotation}°)`;
      siteG.appendChild(siteLbl);
    } else {
      const allPts=so.lotCoords.flat();
      const bx1=Math.min(...allPts.map(p=>mmToPx(p.x)));
      const by1=Math.min(...allPts.map(p=>mmToPx(p.y)));
      const bx2=Math.max(...allPts.map(p=>mmToPx(p.x)));
      const siteLbl=mk('text',{
        x:ox+(bx1+bx2)/2, y:oy+by1-6,
        'text-anchor':'middle','font-size':'9','font-weight':'700',
        'font-family':'Pretendard,sans-serif',
        fill:'#e74c3c','pointer-events':'none',
      });
      siteLbl.textContent='대지';
      siteG.appendChild(siteLbl);
    }

    svg.appendChild(siteG);
  }
}

function rotateFloorInstance(uid){
  const inst=FL.instances.find(i=>i.uid===uid);
  if(!inst) return;
  inst.rotation=(inst.rotation+90)%360;
  const tmp=inst.w_mm; inst.w_mm=inst.h_mm; inst.h_mm=tmp;
  renderFloorPlan();
}

function flipFloorInstance(uid){
  const inst = FL.instances.find(i=>i.uid===uid);
  if(!inst) return;
  inst.flipX = !inst.flipX;
  renderFloorPlan();
}

function removeFloorInstance(uid){
  const inst = FL.instances.find(i=>i.uid===uid);
  if(inst){
    FL.placedGroups.delete(inst.groupIdx);
  }
  FL.instances = FL.instances.filter(i=>i.uid!==uid);
  if(FL.selected===uid) FL.selected=null;
  renderFloorPlan();
  renderFloorCoreList();
  updateFloorAreaBar();
}

async function buildSiteOverlay(){
  const mergedPoly = window._step1MergedPoly;
  if(!mergedPoly){
    const info = $('fl-site-info');
    if(info){ info.textContent = '2페이지에서 필지를 먼저 선택하세요.'; info.style.color='var(--text3)'; }
    return;
  }

  const outSrc = window._step1OutlineSource;
  const hasBuildable = outSrc?.getFeatures().some(f=>f.get('type')==='buildable'||f.get('type')==='setback');
  if(!hasBuildable){
    if(!_shpLoaded){
      const info = $('fl-site-info');
      if(info){ info.textContent = '건축한계선 데이터 로딩 중...'; info.style.color='var(--text3)'; }
      await loadSetbackLayer();
    }
    await computeBuildableQuiet();
  }

  function extractRings(geom){
    if(geom.type==='Polygon') return geom.coordinates;
    if(geom.type==='MultiPolygon') return geom.coordinates.flat(1);
    return [];
  }

  function lnglatToMm(coords, centerLng, centerLat){
    const R = 6371000;
    return coords.map(([lng, lat])=>{
      const dx = (lng - centerLng) * Math.cos(centerLat*Math.PI/180) * R * Math.PI/180;
      const dy = (lat - centerLat) * R * Math.PI/180;
      return { x: Math.round(dx*1000), y: Math.round(-dy*1000) };
    });
  }

  const center = turf.centroid(mergedPoly);
  const [centerLng, centerLat] = center.geometry.coordinates;

  const lotRings = extractRings(mergedPoly.geometry);
  const lotCoords = lotRings.map(ring => lnglatToMm(ring, centerLng, centerLat));

  let buildableCoords = null;
  if(outSrc){
    const bFeats = outSrc.getFeatures().filter(f=>f.get('type')==='buildable'||f.get('type')==='setback');
    if(bFeats.length){
      const fmt = new ol.format.GeoJSON();
      buildableCoords = [];
      bFeats.forEach(feat=>{
        const clone = feat.getGeometry().clone();
        clone.transform('EPSG:3857','EPSG:4326');
        const geom = JSON.parse(fmt.writeGeometry(clone));
        extractRings(geom).forEach(ring=>{
          buildableCoords.push(lnglatToMm(ring, centerLng, centerLat));
        });
      });
      if(!buildableCoords.length) buildableCoords = null;
    }
  }

  const canvasWrap = $('fl-canvas-wrap');
  const vpW_mm = (canvasWrap ? canvasWrap.clientWidth : 800) * MM_PER_PX;
  const vpH_mm = (canvasWrap ? canvasWrap.clientHeight : 600) * MM_PER_PX;

  FL.siteOverlay = {
    x_mm: snapMm(vpW_mm / 2),
    y_mm: snapMm(vpH_mm / 2),
    rotation: 0,
    lotCoords,
    buildableCoords,
    selected: false,
  };

  const info = $('fl-site-info');
  if(info){
    const area = turf.area(mergedPoly);
    info.textContent = `✅ 대지면적 ${area.toFixed(0)}㎡${buildableCoords?'\n건축한계선 포함':''}`;
    info.style.color = 'var(--green)';
  }

  renderFloorPlan();
}

async function computeBuildableQuiet(){
  const outSrc = window._step1OutlineSource;
  if(!outSrc || !window._step1MergedPoly) return;
  if(!_shpLoaded || !_shpGeoJSONs.length) return;

  const merged = window._step1MergedPoly;
  const fmt = new ol.format.GeoJSON();

  try {
    const insetPoly = sharpInsetPolygon(merged, 0.5);
    if(!insetPoly) return;

    const mBbox = turf.bbox(merged);
    const nearby = _shpGeoJSONs.filter(f=>{
      const b=turf.bbox(f);
      return !(b[2]<mBbox[0]||b[0]>mBbox[2]||b[3]<mBbox[1]||b[1]>mBbox[3]);
    });
    const allLines = [];
    nearby.forEach(f=>f.geometry.coordinates.forEach(line=>allLines.push([...line])));

    const filteredLines = allLines.filter(line=>{
      try{ return turf.booleanIntersects(turf.lineString(line), merged); }catch(e){ return false; }
    });

    outSrc.getFeatures().filter(f=>f.get('type')==='buildable').forEach(f=>outSrc.removeFeature(f));

    let final;
    if(!filteredLines.length){
      final = insetPoly;
    } else {
      const allCoords = filteredLines.reduce((acc,line)=>[...acc,...line],[]);
      const points = turf.featureCollection(allCoords.map(c=>turf.point(c)));
      const setbackHull = turf.concave(points,{maxEdge:0.1,units:'kilometers'});
      if(!setbackHull){ final=insetPoly; }
      else {
        const step1 = turf.intersect(setbackHull, merged);
        final = (step1 ? turf.intersect(step1, insetPoly) : null) || insetPoly;
      }
    }

    const olGeom = fmt.readGeometry(final.geometry,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
    const bf = new ol.Feature({geometry:olGeom});
    bf.set('type','buildable');
    outSrc.addFeature(bf);
    state.buildableArea = turf.area(final);
  } catch(e){ console.warn('computeBuildableQuiet 오류:', e); }
}

function resetFloorPlan(){
  FL.instances=[]; FL.nextId=1; FL.selected=null; FL.placedGroups=new Set();
  FL.siteOverlay=null; FL.siteDrag=null; FL.siteRotate=null;
  FL.selectedFloorType=null; FL._prevOutsideCount=0;
  FL.roomTypes=[{ id:'A', w_mm:4500, d_mm:9000, locked:true }];
  FL.roomInstances=[]; FL.roomNextId=1; FL.selectedRoom=null; FL.roomDrag=null;
  renderFloorPlan();
  renderFloorTypeList();
  renderFloorCoreList();
  renderRoomTypeList();
  updateFloorAreaBar();
}

function initFloorPlan(){
  FL.floorW = parseFloat($('fl-width')?.value||30);
  FL.floorH = parseFloat($('fl-height')?.value||20);
  renderFloorPlan();
}

function pointInBuildable(px_mm, py_mm){
  const so = FL.siteOverlay;
  if(!so || !so.buildableCoords || !so.buildableCoords.length) return true;
  const ox_mm = so.x_mm, oy_mm = so.y_mm;
  const rad = -so.rotation * Math.PI / 180;
  const dx = px_mm - ox_mm, dy = py_mm - oy_mm;
  const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
  const ly = dx*Math.sin(rad) + dy*Math.cos(rad);
  const ring = so.buildableCoords[0];
  let inside = false;
  for(let i=0, j=ring.length-1; i<ring.length; j=i++){
    const xi=ring[i].x, yi=ring[i].y, xj=ring[j].x, yj=ring[j].y;
    if(((yi>ly)!==(yj>ly)) && (lx < (xj-xi)*(ly-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

function isInstOutsideBuildable(inst){
  if(!FL.siteOverlay?.buildableCoords) return false;
  const bbox = inst.bbox;
  const group = inst.group;
  if(!group || !group.length) return false;
  for(const el of group){
    const x0 = inst.x_mm + (el.x_mm - bbox.x_mm);
    const y0 = inst.y_mm + (el.y_mm - bbox.y_mm);
    const x1 = x0 + el.w_mm, y1 = y0 + el.h_mm;
    const corners = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    for(const [cx,cy] of corners){
      if(!pointInBuildable(cx, cy)) return true;
    }
  }
  return false;
}

function flInstancesOverlap(a, b){
  const aEls = a.group || [];
  const bEls = b.group || [];
  if(!aEls.length || !bEls.length){
    return a.x_mm+a.w_mm > b.x_mm && a.x_mm < b.x_mm+b.w_mm &&
           a.y_mm+a.h_mm > b.y_mm && a.y_mm < b.y_mm+b.h_mm;
  }
  for(const ae of aEls){
    const ax1 = a.x_mm + (ae.x_mm - a.bbox.x_mm);
    const ay1 = a.y_mm + (ae.y_mm - a.bbox.y_mm);
    const ax2 = ax1 + ae.w_mm, ay2 = ay1 + ae.h_mm;
    for(const be of bEls){
      const bx1 = b.x_mm + (be.x_mm - b.bbox.x_mm);
      const by1 = b.y_mm + (be.y_mm - b.bbox.y_mm);
      const bx2 = bx1 + be.w_mm, by2 = by1 + be.h_mm;
      if(ax2 > bx1 && ax1 < bx2 && ay2 > by1 && ay1 < by2) return true;
    }
  }
  return false;
}
function flCollidesWithOthers(moving){
  if(FL.instances.some(i=> i.uid!==moving.uid && flInstancesOverlap(moving,i))) return true;
  const grp=moving.group; const bbox=moving.bbox;
  if(!grp||!bbox) return false;
  return grp.some(el=>{
    const ex=moving.x_mm+(el.x_mm-bbox.x_mm);
    const ey=moving.y_mm+(el.y_mm-bbox.y_mm);
    const ex2=ex+el.w_mm, ey2=ey+el.h_mm;
    return FL.roomInstances.some(room=>{
      const rx1=room.x_mm, ry1=room.y_mm;
      const rx2=rx1+roomInstW(room), ry2=ry1+roomInstH(room);
      return ex2>rx1 && ex<rx2 && ey2>ry1 && ey<ry2;
    });
  });
}

function initFloorSVGEvents(){
  const wrap=$('fl-canvas-wrap');
  if(!wrap||wrap._flInit) return;
  wrap._flInit=true;
  const svg=$('fl-svg');

  function svgPos(e){ const r=svg.getBoundingClientRect(); return {mx:e.clientX-r.left, my:e.clientY-r.top}; }
  function hitFL(mx,my){
    return FL.instances.find(i=>{
      const ix=mmToPx(i.x_mm),iy=mmToPx(i.y_mm),iw=mmToPx(i.w_mm),ih=mmToPx(i.h_mm);
      if(mx<ix||mx>=ix+iw||my<iy||my>=iy+ih) return false;
      const grp=i.group;
      if(!grp||!grp.length) return true;
      return grp.some(el=>{
        const ex=mmToPx(i.x_mm+(el.x_mm-i.bbox.x_mm));
        const ey=mmToPx(i.y_mm+(el.y_mm-i.bbox.y_mm));
        const ew=mmToPx(el.w_mm), eh=mmToPx(el.h_mm);
        return mx>=ex&&mx<ex+ew&&my>=ey&&my<ey+eh;
      });
    });
  }

  function hitRoom(mx,my){
    return FL.roomInstances.find(inst=>{
      const ix=mmToPx(inst.x_mm), iy=mmToPx(inst.y_mm);
      const iw=mmToPx(roomInstW(inst)), ih=mmToPx(roomInstH(inst));
      return mx>=ix&&mx<ix+iw&&my>=iy&&my<iy+ih;
    });
  }

  const SITE_HIT_PX = 6;
  function hitSite(mx, my){
    const so = FL.siteOverlay;
    if(!so) return false;
    const ox = mmToPx(so.x_mm), oy = mmToPx(so.y_mm);
    const rad = -so.rotation * Math.PI / 180;
    const dx = mx-ox, dy = my-oy;
    const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
    const ly = dx*Math.sin(rad) + dy*Math.cos(rad);

    function distToSeg(px,py,ax,ay,bx,by){
      const abx=bx-ax,aby=by-ay;
      const len2=abx*abx+aby*aby;
      if(len2===0) return Math.hypot(px-ax,py-ay);
      const t=Math.max(0,Math.min(1,((px-ax)*abx+(py-ay)*aby)/len2));
      return Math.hypot(px-(ax+t*abx),py-(ay+t*aby));
    }

    const allRings = [...so.lotCoords, ...(so.buildableCoords||[])];
    for(const ring of allRings){
      const pts = ring.map(p=>({x:mmToPx(p.x), y:mmToPx(p.y)}));
      for(let i=0,j=pts.length-1; i<pts.length; j=i++){
        if(distToSeg(lx,ly, pts[j].x,pts[j].y, pts[i].x,pts[i].y) <= SITE_HIT_PX) return true;
      }
    }
    return false;
  }

  svg.addEventListener('mousedown',e=>{
    if(e.button!==0) return;
    e.stopPropagation();
    if(FL.siteRotate) return;
    const {mx,my}=svgPos(e);
    const inst=hitFL(mx,my);
    if(inst){
      if(FL.siteOverlay) FL.siteOverlay.selected=false;
      FL.selectedRoom=null;
      FL.selected=inst.uid;
      FL.drag={uid:inst.uid, startPx:{x:mx,y:my}, origX:inst.x_mm, origY:inst.y_mm,
        skipCollision: flCollidesWithOthers(inst)};
      svg.style.cursor='grabbing'; renderFloorPlan(); e.preventDefault();
      return;
    }
    const room=hitRoom(mx,my);
    if(room){
      if(FL.siteOverlay) FL.siteOverlay.selected=false;
      FL.selected=null;
      FL.selectedRoom=room.uid;
      FL.roomDrag={uid:room.uid, startPx:{x:mx,y:my}, origX:room.x_mm, origY:room.y_mm,
        skipCollision: roomCollidesWithOthers(room)};
      svg.style.cursor='grabbing'; renderFloorPlan(); e.preventDefault();
      return;
    }
    if(hitSite(mx,my)){
      FL.selected=null; FL.selectedRoom=null;
      FL.siteOverlay.selected=true;
      FL.siteDrag={startPx:{x:mx,y:my}, origX:FL.siteOverlay.x_mm, origY:FL.siteOverlay.y_mm};
      svg.style.cursor='grabbing'; renderFloorPlan(); e.preventDefault();
      return;
    }
    FL.selected=null; FL.selectedRoom=null;
    if(FL.siteOverlay) FL.siteOverlay.selected=false;
    renderFloorPlan();
  });

  function onFlMove(e){
    const r=svg.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;

    if(FL.roomDrag){
      const inst=FL.roomInstances.find(i=>i.uid===FL.roomDrag.uid);
      if(inst){
        const nx=snapMm(Math.max(0, FL.roomDrag.origX+Math.round((mx-FL.roomDrag.startPx.x)*MM_PER_PX)));
        const ny=snapMm(Math.max(0, FL.roomDrag.origY+Math.round((my-FL.roomDrag.startPx.y)*MM_PER_PX)));
        const px=inst.x_mm, py=inst.y_mm;
        inst.x_mm=nx; inst.y_mm=ny;
        if(!FL.roomDrag.skipCollision && roomCollidesWithOthers(inst)){
          inst.x_mm=nx; inst.y_mm=py;
          if(roomCollidesWithOthers(inst)){
            inst.x_mm=px; inst.y_mm=ny;
            if(roomCollidesWithOthers(inst)){ inst.x_mm=px; inst.y_mm=py; }
          }
        }
        FL.roomDrag.origX=inst.x_mm; FL.roomDrag.origY=inst.y_mm;
        FL.roomDrag.startPx={x:mx,y:my};
      }
      renderFloorPlan(); return;
    }

    if(FL.siteRotate && FL.siteOverlay){
      const so=FL.siteOverlay;
      const ox=mmToPx(so.x_mm), oy=mmToPx(so.y_mm);
      const curAngle = Math.atan2(my-oy, mx-ox) * 180/Math.PI;
      const delta = curAngle - FL.siteRotate.startAngle;
      const newRot = Math.round(FL.siteRotate.startRotation + delta) % 360;
      so.rotation = (newRot + 360) % 360;
      renderFloorPlan(); return;
    }

    if(FL.siteDrag && FL.siteOverlay){
      const so=FL.siteOverlay;
      so.x_mm=snapMm(Math.max(0, FL.siteDrag.origX+Math.round((mx-FL.siteDrag.startPx.x)*MM_PER_PX)));
      so.y_mm=snapMm(Math.max(0, FL.siteDrag.origY+Math.round((my-FL.siteDrag.startPx.y)*MM_PER_PX)));
      FL.siteDrag.origX=so.x_mm; FL.siteDrag.origY=so.y_mm;
      FL.siteDrag.startPx={x:mx,y:my};
      renderFloorPlan(); return;
    }

    if(!FL.drag) return;
    const inst=FL.instances.find(i=>i.uid===FL.drag.uid);
    if(!inst) return;

    const nx=snapMm(Math.max(0, FL.drag.origX+Math.round((mx-FL.drag.startPx.x)*MM_PER_PX)));
    const ny=snapMm(Math.max(0, FL.drag.origY+Math.round((my-FL.drag.startPx.y)*MM_PER_PX)));
    const px=inst.x_mm, py=inst.y_mm;

    inst.x_mm=nx; inst.y_mm=ny;
    if(!FL.drag.skipCollision && flCollidesWithOthers(inst)){
      inst.x_mm=nx; inst.y_mm=py;
      if(flCollidesWithOthers(inst)){
        inst.x_mm=px; inst.y_mm=ny;
        if(flCollidesWithOthers(inst)){
          inst.x_mm=px; inst.y_mm=py;
        }
      }
    }
    FL.drag.origX=inst.x_mm; FL.drag.origY=inst.y_mm;
    FL.drag.startPx={x:mx,y:my};
    renderFloorPlan();
  }
  function onFlUp(){
    if(FL.roomDrag){ FL.roomDrag=null; svg.style.cursor='default'; renderFloorPlan(); updateFloorAreaBar(); return; }
    if(FL.siteRotate){ FL.siteRotate=null; svg.style.cursor='default'; renderFloorPlan(); return; }
    if(FL.siteDrag){ FL.siteDrag=null; svg.style.cursor='default'; renderFloorPlan(); return; }
    if(!FL.drag) return;
    FL.drag=null; svg.style.cursor='default'; renderFloorPlan();
  }
  document.addEventListener('mousemove', onFlMove);
  document.addEventListener('mouseup', onFlUp);

  svg.addEventListener('contextmenu',e=>{
    e.preventDefault();
    const {mx,my}=svgPos(e);
    const inst=hitFL(mx,my);
    if(inst){ removeFloorInstance(inst.uid); return; }
    const room=hitRoom(mx,my);
    if(room) removeRoomInstance(room.uid);
  });
  svg.addEventListener('mousemove',e=>{
    if(FL.drag||FL.siteDrag||FL.siteRotate) return;
    const {mx,my}=svgPos(e);
    if(hitFL(mx,my)){ svg.style.cursor='grab'; return; }
    if(hitRoom(mx,my)){ svg.style.cursor='grab'; return; }
    if(hitSite(mx,my)){ svg.style.cursor='grab'; return; }
    svg.style.cursor='default';
  });

  if(!window._flDocRegistered){
    window._flDocRegistered=true;
    document.addEventListener('keydown',e=>{
      if(document.activeElement.tagName==='INPUT') return;
      if(e.key==='Escape'){
        FL.selected=null; FL.selectedRoom=null;
        if(FL.siteOverlay) FL.siteOverlay.selected=false;
        renderFloorPlan(); return;
      }
      if(FL.siteOverlay?.selected){
        const so=FL.siteOverlay;
        if(e.key==='+'||e.key==='='){ so.rotation=(so.rotation+1+360)%360; e.preventDefault(); renderFloorPlan(); return; }
        if(e.key==='-'){ so.rotation=(so.rotation-1+360)%360; e.preventDefault(); renderFloorPlan(); return; }
        if(e.key==='ArrowLeft'){ so.x_mm=Math.max(0,so.x_mm-SNAP_MM); e.preventDefault(); renderFloorPlan(); return; }
        if(e.key==='ArrowRight'){ so.x_mm+=SNAP_MM; e.preventDefault(); renderFloorPlan(); return; }
        if(e.key==='ArrowUp'){ so.y_mm=Math.max(0,so.y_mm-SNAP_MM); e.preventDefault(); renderFloorPlan(); return; }
        if(e.key==='ArrowDown'){ so.y_mm+=SNAP_MM; e.preventDefault(); renderFloorPlan(); return; }
        return;
      }
      if(FL.selectedRoom){
        const room=FL.roomInstances.find(i=>i.uid===FL.selectedRoom);
        if(room){
          const rpx=room.x_mm, rpy=room.y_mm;
          if(e.key==='ArrowLeft'){ room.x_mm=Math.max(0,room.x_mm-SNAP_MM); e.preventDefault(); }
          else if(e.key==='ArrowRight'){ room.x_mm+=SNAP_MM; e.preventDefault(); }
          else if(e.key==='ArrowUp'){ room.y_mm=Math.max(0,room.y_mm-SNAP_MM); e.preventDefault(); }
          else if(e.key==='ArrowDown'){ room.y_mm+=SNAP_MM; e.preventDefault(); }
          else return;
          if(roomCollidesWithOthers(room)){ room.x_mm=rpx; room.y_mm=rpy; }
          renderFloorPlan(); updateFloorAreaBar();
        }
        return;
      }
      if(!FL.selected) return;
      const inst=FL.instances.find(i=>i.uid===FL.selected);
      if(!inst) return;
      const px=inst.x_mm, py=inst.y_mm;
      if(e.key==='ArrowLeft'){ inst.x_mm=Math.max(0,inst.x_mm-SNAP_MM); e.preventDefault(); }
      else if(e.key==='ArrowRight'){ inst.x_mm+=SNAP_MM; e.preventDefault(); }
      else if(e.key==='ArrowUp'){ inst.y_mm=Math.max(0,inst.y_mm-SNAP_MM); e.preventDefault(); }
      else if(e.key==='ArrowDown'){ inst.y_mm+=SNAP_MM; e.preventDefault(); }
      else return;
      if(flCollidesWithOthers(inst)){ inst.x_mm=px; inst.y_mm=py; }
      renderFloorPlan();
    });
    document.addEventListener('mousedown',e=>{
      if(FL.selected!==null){ FL.selected=null; renderFloorPlan(); }
    });
  }
}

function flSvgPosToCR(svg,e){
  const rect=svg.getBoundingClientRect();
  return {col:Math.floor((e.clientX-rect.left)/GRID), row:Math.floor((e.clientY-rect.top)/GRID)};
}

function renderSVGGrayed(){
  const svg = $('core-svg');
  if(!svg) return;
  svg.querySelectorAll('.gray-overlay').forEach(el=>el.remove());
  svg.querySelectorAll('rect').forEach(r=>{
    const fill=r.getAttribute('fill');
    if(fill && fill!=='none' && !fill.startsWith('rgba(0,0,0')){
      r.setAttribute('fill','#b0b4be');
      r.setAttribute('data-orig-fill', fill);
    }
    const stroke=r.getAttribute('stroke');
    if(stroke && stroke!=='none'){
      r.setAttribute('stroke','#888c96');
      r.setAttribute('data-orig-stroke', stroke);
    }
  });
  svg.querySelectorAll('text').forEach(t=>{ t.setAttribute('fill','#888c96'); t.setAttribute('stroke','none'); });
  svg.querySelectorAll('image').forEach(img=>{ img.setAttribute('opacity','0.25'); });
  svg.querySelectorAll('.core-group-outline').forEach(el=>{
    if(el.tagName==='rect') el.setAttribute('stroke','#888c96');
    if(el.tagName==='text') el.setAttribute('fill','#888c96');
  });
}

function renderSVGWithGroups(groups){
  const svg = $('core-svg');
  if(!svg) return;
  svg.querySelectorAll('.core-group-outline').forEach(el=>el.remove());
  if(!groups||!groups.length) return;

  const NS = 'http://www.w3.org/2000/svg';
  groups.forEach((group,i)=>{
    const bbox = groupBBox(group);
    const x = mmToPx(bbox.x_mm) - 3, y = mmToPx(bbox.y_mm) - 3;
    const w = mmToPx(bbox.w_mm) + 6, h = mmToPx(bbox.h_mm) + 6;
    const color = CORE_COLORS[i % CORE_COLORS.length];

    const rect = document.createElementNS(NS,'rect');
    rect.setAttribute('x',x); rect.setAttribute('y',y);
    rect.setAttribute('width',w); rect.setAttribute('height',h);
    rect.setAttribute('fill','none');
    rect.setAttribute('stroke',color);
    rect.setAttribute('stroke-width','2');
    rect.setAttribute('stroke-dasharray','6,3');
    rect.setAttribute('rx','4');
    rect.classList.add('core-group-outline');

    const lbl = document.createElementNS(NS,'text');
    lbl.setAttribute('x',x+6); lbl.setAttribute('y',y-4);
    lbl.setAttribute('font-size','10'); lbl.setAttribute('font-weight','700');
    lbl.setAttribute('font-family','Pretendard,sans-serif');
    lbl.setAttribute('fill',color);
    lbl.classList.add('core-group-outline');
    lbl.textContent = `코어 ${i+1}`;

    svg.appendChild(rect);
    svg.appendChild(lbl);
  });
}
