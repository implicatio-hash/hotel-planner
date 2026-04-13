// Hotel Planner — Step 5: 코어 계획 (SVG 오버레이 방식)

function typeLabel(i){ return String.fromCharCode(65 + i); }

function initBoundaryStep(){
  initCoreDesign();
}

const GRID = 58;
const CELL_MM = 2900;
const MM_PER_PX = CELL_MM / GRID;
const SNAP_MM = 100;

function mmToPx(mm){ return mm / MM_PER_PX; }
function pxToMm(px){ return Math.round(px * MM_PER_PX / SNAP_MM) * SNAP_MM; }
function snapMm(mm){ return Math.round(mm / SNAP_MM) * SNAP_MM; }

const CORE_SVGS = {
  elevator: `<svg preserveAspectRatio="none" viewBox="149 8 727 726" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd" xml:space="preserve" >  <g fill="none" stroke="#1a1d26" stroke-width="8px" /> <g fill="none" stroke="#1a1d26" stroke-width="8px" > <polyline points="148.975,733.58 875.025,733.58 875.025,7.52941 148.975,7.52941 148.975,733.58 " /> <polyline points="646.454,182.588 646.454,228.303 " /> <polyline points="377.546,182.588 377.546,228.303 " /> <polyline points="646.454,182.588 377.546,182.588 " /> <polyline points="646.454,228.303 377.546,228.303 " /> <polyline points="353.345,680.067 353.345,689.479 670.655,689.479 670.655,680.067 353.345,680.067 " /> <polyline points="670.655,677.378 662.588,677.378 662.588,663.933 780.908,663.933 780.908,260.571 243.092,260.571 243.092,663.933 361.412,663.933 361.412,677.378 353.345,677.378 " /> <polyline points="216.202,698.084 807.798,698.084 807.798,673.882 794.353,673.882 794.353,247.126 229.647,247.126 229.647,673.882 216.202,673.882 216.202,698.084 " /> <polyline points="353.345,711.529 670.655,711.529 670.655,720.941 353.345,720.941 353.345,711.529 " /> <polyline points="512,680.067 512,689.479 " /> <polyline points="512,711.529 512,720.941 " /> <polyline points="780.908,260.571 243.092,663.933 " /> <polyline points="780.908,663.933 243.092,260.571 " /> <polyline points="346.622,724.168 346.622,728.236 345.277,728.236 345.277,722.824 364.101,722.824 353.345,760.471 345.277,760.471 345.277,755.092 346.622,755.092 346.622,759.126 352.184,759.126 362.543,724.168 346.622,724.168 " /> <polyline points="678.723,722.824 807.798,722.824 807.798,706.151 216.202,706.151 216.202,722.824 345.277,722.824 " /> <polyline points="677.378,724.168 677.378,728.236 678.723,728.236 678.723,722.824 659.899,722.824 670.655,760.471 678.723,760.471 678.723,755.092 677.378,755.092 677.378,759.126 671.816,759.126 661.457,724.168 677.378,724.168 " /> <polyline points="377.546,182.588 377.546,228.303 " /> </g> </svg>`,
  foyer:    `<svg preserveAspectRatio="none" viewBox="136 8 752 752" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd" xml:space="preserve" >  <g fill="none" stroke="#1a1d26" stroke-width="8px" /> <g fill="none" stroke="#1a1d26" stroke-width="8px" > <polyline points="135.529,760.471 888.471,760.471 888.471,7.52941 135.529,7.52941 135.529,760.471 " /> <path d="M679.32,425.83 A334.641,334.641 0 0,0 344.68,760.471 " /> <polyline points="679.32,760.471 679.32,425.83 " /> </g> </svg>`,
  shaft:    `<svg preserveAspectRatio="none" viewBox="136 8 752 752" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd" xml:space="preserve" >  <g fill="none" stroke="#1a1d26" stroke-width="8px" /> <g fill="none" stroke="#1a1d26" stroke-width="8px" > <polyline points="135.529,760.471 888.471,760.471 888.471,7.52941 135.529,7.52941 135.529,760.471 " /> <polyline points="888.471,7.52941 135.529,760.471 " /> <polyline points="135.529,7.52941 888.471,760.471 " /> </g> </svg>`,
  stair:    `<svg preserveAspectRatio="none" viewBox="10 142 1004 484" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd" xml:space="preserve" >  <g fill="none" stroke="#1a1d26" stroke-width="8px" /> <g fill="none" stroke="#1a1d26" stroke-width="8px" > <polyline points="1013.96,141.983 1013.96,626.017 10.0392,626.017 10.0392,141.983 1013.96,141.983 " /> <polyline points="512,626.017 512,141.983 " /> <polyline points="780.908,626.017 780.908,141.983 " /> <polyline points="727.126,626.017 727.126,141.983 " /> <polyline points="673.345,626.017 673.345,141.983 " /> <polyline points="619.563,626.017 619.563,141.983 " /> <polyline points="565.782,626.017 565.782,141.983 " /> <polyline points="243.092,626.017 243.092,141.983 " /> <polyline points="296.874,626.017 296.874,141.983 " /> <polyline points="350.655,626.017 350.655,141.983 " /> <polyline points="404.437,626.017 404.437,141.983 " /> <polyline points="458.218,626.017 458.218,141.983 " /> <polyline points="243.092,384 780.908,384 " /> </g> </svg>`,
};

const CORE_DEF = [
  { id:'stair-s',    label:'피난계단',      baseW_mm:5800, baseH_mm:2900, color:'#dcfce7', border:'#22c55e', textColor:'#14532d', svgKey:'stair' },
  { id:'stair-sp',   label:'특별피난계단',  baseW_mm:5800, baseH_mm:2900, color:'#d1fae5', border:'#10b981', textColor:'#064e3b', svgKey:'stair' },
  { id:'ev',         label:'승용 EV',       baseW_mm:2900, baseH_mm:2900, color:'#dbeafe', border:'#3b82f6', textColor:'#1e40af', svgKey:'elevator' },
  { id:'ev-emg',     label:'비상 EV',       baseW_mm:2900, baseH_mm:2900, color:'#fef3c7', border:'#f59e0b', textColor:'#92400e', svgKey:'elevator' },
  { id:'ev-evac',    label:'피난 EV',       baseW_mm:2900, baseH_mm:2900, color:'#fce7f3', border:'#ec4899', textColor:'#831843', svgKey:'elevator' },
  { id:'foyer-emg',  label:'비상EV 전실',   baseW_mm:2900, baseH_mm:2900, color:'#fef3c7', border:'#f59e0b', textColor:'#92400e', svgKey:'foyer' },
  { id:'foyer-evac', label:'피난EV 전실',   baseW_mm:2900, baseH_mm:2900, color:'#fce7f3', border:'#ec4899', textColor:'#831843', svgKey:'foyer' },
  { id:'foyer-ev',   label:'승용EV 전실',   baseW_mm:2900, baseH_mm:2900, color:'#dbeafe', border:'#3b82f6', textColor:'#1e40af', svgKey:'foyer' },
  { id:'foyer-st',   label:'계단 전실',     baseW_mm:2900, baseH_mm:2900, color:'#d1fae5', border:'#10b981', textColor:'#064e3b', svgKey:'foyer' },
  { id:'av',  label:'AV',  baseW_mm:2900, baseH_mm:2900, color:'#f8fafc', border:'#94a3b8', textColor:'#334155', svgKey:'shaft' },
  { id:'eps', label:'EPS', baseW_mm:2900, baseH_mm:2900, color:'#f8fafc', border:'#94a3b8', textColor:'#334155', svgKey:'shaft' },
  { id:'tps', label:'TPS', baseW_mm:2900, baseH_mm:2900, color:'#f8fafc', border:'#94a3b8', textColor:'#334155', svgKey:'shaft' },
  { id:'ad',  label:'AD',  baseW_mm:2900, baseH_mm:2900, color:'#f8fafc', border:'#94a3b8', textColor:'#334155', svgKey:'shaft' },
  { id:'ps',  label:'PS',  baseW_mm:2900, baseH_mm:2900, color:'#f8fafc', border:'#94a3b8', textColor:'#334155', svgKey:'shaft' },
];

let CD = {
  elements: [],
  required: {},
  placed:   {},
  extra:    {},
  selected: null,
  nextId: 1,
  drag: null,
};

function calcCoreRequirements(){
  const req = {};
  const floors   = S2.floors?.length ? S2.floors : [];
  const aboveF   = state.aboveFloors || (floors.length > 0 ? floors.length : 20);
  const fh       = state.floorHeight  || 3.5;
  const lh       = state.lobbyHeight  || 6.0;
  const totalH   = lh + (aboveF - 1) * fh;
  const underF   = SU.floors?.length || state.underFloors || 4;
  const maxFloorArea = floors.length > 0 ? Math.max(...floors.map(f=>f.area), 1) : (state.maxCoverage || 1500);
  const gfa6plus = floors.filter((_,i)=>i>=5).reduce((s,f)=>s+f.area, 0);

  if(aboveF >= 11 || underF >= 3){ req['stair-sp']=2; req['stair-s']=0; }
  else { req['stair-s']=2; req['stair-sp']=0; }

  const emgCount  = totalH > 31 ? (maxFloorArea<=1500 ? 1 : 1+Math.ceil((maxFloorArea-1500)/3000)) : 0;
  req['ev-emg']  = emgCount;
  req['ev-evac'] = (aboveF>=30 || totalH>=120) ? 1 : 0;

  let evCount = 0;
  if(aboveF >= 6 && gfa6plus > 0){
    evCount = gfa6plus <= 3000 ? 1 : 1 + Math.ceil((gfa6plus-3000)/2000);
  }
  const evRaw = aboveF >= 6 ? Math.max(evCount, 1) : evCount;

  const emgDeduct = emgCount * 2;
  const evAfterDeduct = Math.max(0, evRaw - emgDeduct);
  req['ev'] = Math.ceil(evAfterDeduct / 2);

  req['_evNote'] = `법정 ${evRaw}대 - 비상EV겸용 ${emgDeduct}대 → 16인승 기준 ${req['ev']}대`;

  req['av']=req['eps']=req['tps']=req['ad']=req['ps']=1;
  req['foyer-emg']  = req['ev-emg']  || 0;
  req['foyer-evac'] = req['ev-evac'] || 0;
  req['foyer-st']   = req['stair-sp'] || 0;
  req['foyer-ev']   = 0;
  return req;
}

function renderCoreList(){
  const list = $('core-element-list');
  if(!list) return;
  list.innerHTML = '';
  const sections = [
    { title:'계단', ids:['stair-sp','stair-s'] },
    { title:'승강기', ids:['ev','ev-emg','ev-evac'] },
    { title:'전실', ids:['foyer-emg','foyer-evac','foyer-ev','foyer-st'] },
    { title:'설비', ids:['av','eps','tps','ad','ps'] },
  ];
  sections.forEach(sec => {
    const hd = document.createElement('div');
    hd.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);padding:6px 0 4px;border-bottom:1px solid var(--border);margin-bottom:4px;';
    hd.textContent = sec.title;
    list.appendChild(hd);
    if(sec.title==='승강기' && CD.required['_evNote']){
      const note = document.createElement('div');
      note.style.cssText = 'font-size:9px;color:var(--text3);padding:2px 4px 4px;line-height:1.4;';
      note.textContent = `※ ${CD.required['_evNote']} (16인승 이상=2대 산정)`;
      list.appendChild(note);
    }
    sec.ids.forEach(id => renderCoreRow(list, id));
  });
  updateCoreNextBtn();
}

function renderCoreRow(container, defId){
  const def = CORE_DEF.find(d=>d.id===defId);
  if(!def) return;
  const req    = CD.required[defId] || 0;
  const placed = CD.placed[defId]   || 0;
  const extra  = CD.extra[defId]    || 0;
  const effectiveExtra = (defId==='ev' && req===0 && extra===0) ? 1 : extra;
  if(defId==='ev' && req===0 && CD.extra[defId]===undefined) CD.extra[defId]=1;
  const total  = req + effectiveExtra;
  const remain = Math.max(0, total - placed);
  const canAdd = remain > 0;

  const row = document.createElement('div');
  row.style.cssText = `display:flex;align-items:center;gap:4px;padding:5px 4px;border-radius:5px;background:${canAdd?'var(--bg2)':'var(--bg3)'};border:1px solid ${canAdd?'var(--border2)':'var(--border)'};margin-bottom:2px;flex-wrap:wrap;`;

  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;min-width:0;';
  const dot = document.createElement('div');
  dot.style.cssText = `width:8px;height:8px;border-radius:2px;background:${def.color};border:1.5px solid ${def.border};flex-shrink:0;`;
  const lbl = document.createElement('div');
  lbl.style.cssText = `font-size:10px;font-weight:600;color:${canAdd?'var(--text)':'var(--text3)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
  lbl.textContent = def.label;
  left.append(dot, lbl);

  const reqEl = document.createElement('div');
  reqEl.style.cssText = 'font-size:10px;color:var(--text3);flex-shrink:0;';
  reqEl.textContent = `필요 ${req}`;

  const extraWrap = document.createElement('div');
  extraWrap.style.cssText = 'display:flex;align-items:center;gap:0;flex-shrink:0;';
  const btnDn = document.createElement('button');
  btnDn.textContent = '▼';
  btnDn.style.cssText = 'font-size:8px;padding:1px 3px;background:var(--bg3);border:1px solid var(--border);border-radius:3px 0 0 3px;cursor:pointer;line-height:1;';
  const extraInput = document.createElement('input');
  extraInput.type = 'number';
  extraInput.min = '0';
  extraInput.value = CD.extra[defId] !== undefined ? CD.extra[defId] : (defId==='ev'&&req===0 ? 1 : 0);
  extraInput.style.cssText = 'width:28px;text-align:center;font-size:10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);border-left:none;border-right:none;padding:1px 2px;background:var(--bg);color:var(--text);';
  const btnUp = document.createElement('button');
  btnUp.textContent = '▲';
  btnUp.style.cssText = 'font-size:8px;padding:1px 3px;background:var(--bg3);border:1px solid var(--border);border-radius:0 3px 3px 0;cursor:pointer;line-height:1;';

  const updateExtra = (val) => {
    const v = Math.max(0, val);
    CD.extra[defId] = v;
    extraInput.value = v;
    renderCoreList();
  };
  btnUp.onclick = () => updateExtra((CD.extra[defId]||0) + 1);
  btnDn.onclick = () => updateExtra((CD.extra[defId]||0) - 1);
  extraInput.onchange = () => updateExtra(parseInt(extraInput.value)||0);
  extraWrap.append(btnDn, extraInput, btnUp);

  const remEl = document.createElement('div');
  remEl.style.cssText = `font-size:10px;font-weight:700;color:${remain===0?'var(--green)':'var(--accent)'};flex-shrink:0;`;
  remEl.textContent = `잔여 ${remain}`;

  const btn = document.createElement('button');
  btn.className = 'btn btn-sm';
  btn.textContent = '추가';
  btn.style.cssText = `font-size:10px;padding:3px 8px;flex-shrink:0;${canAdd?'background:var(--accent);color:#fff;border:none;':'background:var(--bg3);color:var(--text3);border:1px solid var(--border);cursor:not-allowed;'}`;
  btn.disabled = !canAdd;
  if(canAdd) btn.onclick = () => addCoreElement(defId);

  row.append(left, reqEl, extraWrap, remEl, btn);
  container.appendChild(row);
}

function addCoreElement(defId){
  const def = CORE_DEF.find(d=>d.id===defId);
  if(!def) return;
  const pos = findFreePos(def.baseW_mm, def.baseH_mm);
  const uid = CD.nextId++;
  CD.elements.push({
    uid, defId,
    x_mm: pos.x_mm, y_mm: pos.y_mm,
    w_mm: def.baseW_mm, h_mm: def.baseH_mm,
    rotation: 0, flipX: false
  });
  CD.placed[defId] = (CD.placed[defId]||0) + 1;
  CD.selected = uid;
  renderSVG();
  renderCoreList();
}

function findFreePos(w_mm, h_mm){
  for(let y=0; y<20*CELL_MM; y+=SNAP_MM){
    for(let x=0; x<20*CELL_MM; x+=SNAP_MM){
      const free = !CD.elements.some(el=>
        x < el.x_mm+el.w_mm && x+w_mm > el.x_mm &&
        y < el.y_mm+el.h_mm && y+h_mm > el.y_mm
      );
      if(free) return {x_mm:x, y_mm:y};
    }
  }
  const maxY = CD.elements.reduce((m,e)=>Math.max(m,e.y_mm+e.h_mm),0);
  return {x_mm:0, y_mm:maxY};
}

function removeCoreElement(uid){
  const el = CD.elements.find(e=>e.uid===uid);
  if(!el) return;
  CD.elements = CD.elements.filter(e=>e.uid!==uid);
  if((CD.placed[el.defId]||0)>0) CD.placed[el.defId]--;
  if(CD.selected===uid) CD.selected=null;
  renderSVG();
  renderCoreList();
}

function rotateCoreElement(uid){
  const el = CD.elements.find(e=>e.uid===uid);
  if(!el) return;
  const def = CORE_DEF.find(d=>d.id===el.defId);
  if(!def) return;
  el.rotation = (el.rotation+90)%360;
  if(el.rotation===0||el.rotation===180){ el.w_mm=def.baseW_mm; el.h_mm=def.baseH_mm; }
  else { el.w_mm=def.baseH_mm; el.h_mm=def.baseW_mm; }
  renderSVG();
}

function flipCoreElement(uid){
  const el = CD.elements.find(e=>e.uid===uid);
  if(!el) return;
  el.flipX = !el.flipX;
  renderSVG();
}

function checkFoyerAdjacency(el){
  const emgIds   = ['ev-emg'];
  const evacIds  = ['ev-evac'];
  const stairIds = ['stair-s','stair-sp'];

  function adjacent(a, b){
    const overlapX = a.x_mm < b.x_mm+b.w_mm && a.x_mm+a.w_mm > b.x_mm;
    const overlapY = a.y_mm < b.y_mm+b.h_mm && a.y_mm+a.h_mm > b.y_mm;
    const touchL = a.x_mm === b.x_mm+b.w_mm;
    const touchR = b.x_mm === a.x_mm+a.w_mm;
    const touchT = a.y_mm === b.y_mm+b.h_mm;
    const touchB = b.y_mm === a.y_mm+a.h_mm;
    return (overlapY && (touchL||touchR)) || (overlapX && (touchT||touchB));
  }

  if(el.defId==='foyer-ev'){
    const targets=CD.elements.filter(e=>e.defId==='ev');
    return targets.length>0 && !targets.some(t=>adjacent(el,t));
  }
  if(el.defId==='foyer-emg'){
    const targets=CD.elements.filter(e=>emgIds.includes(e.defId));
    return targets.length>0 && !targets.some(t=>adjacent(el,t));
  }
  if(el.defId==='foyer-evac'){
    const targets=CD.elements.filter(e=>evacIds.includes(e.defId));
    return targets.length>0 && !targets.some(t=>adjacent(el,t));
  }
  if(el.defId==='foyer-st'){
    const targets=CD.elements.filter(e=>stairIds.includes(e.defId));
    return targets.length>0 && !targets.some(t=>adjacent(el,t));
  }
  return false;
}

function renderSVG(){
  const svg = $('core-svg');
  if(!svg) return;

  const padMm = 2*CELL_MM;
  const maxX = CD.elements.reduce((m,e)=>Math.max(m,e.x_mm+e.w_mm),15*CELL_MM) + padMm;
  const maxY = CD.elements.reduce((m,e)=>Math.max(m,e.y_mm+e.h_mm),11*CELL_MM) + padMm;
  const W = mmToPx(maxX), H = mmToPx(maxY);

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs={}){
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
    return el;
  }

  svg.innerHTML = '';
  svg.appendChild(mk('rect',{width:W,height:H,fill:'#f8f9fb'}));

  const gridG = mk('g',{stroke:'#dde0e8','stroke-width':'0.5'});
  for(let xm=0; xm<=maxX; xm+=CELL_MM){
    const px=mmToPx(xm);
    gridG.appendChild(mk('line',{x1:px,y1:0,x2:px,y2:H}));
  }
  for(let ym=0; ym<=maxY; ym+=CELL_MM){
    const py=mmToPx(ym);
    gridG.appendChild(mk('line',{x1:0,y1:py,x2:W,y2:py}));
  }
  svg.appendChild(gridG);

  const isGrayed = $('step-6')?.classList.contains('active');

  CD.elements.forEach(el=>{
    const def = CORE_DEF.find(d=>d.id===el.defId);
    if(!def) return;
    const x=mmToPx(el.x_mm), y=mmToPx(el.y_mm);
    const w=mmToPx(el.w_mm), h=mmToPx(el.h_mm);
    const cx=x+w/2, cy=y+h/2;
    const isSel = CD.selected===el.uid;
    const _warn = checkFoyerAdjacency(el);

    const fillColor   = isGrayed ? '#b0b4be' : def.color;
    const strokeColor = isGrayed ? '#888c96' : (_warn ? '#f97316' : (isSel?'#2563eb':def.border));
    const strokeW     = isGrayed ? 1.5 : (_warn ? 2.5 : (isSel?2.5:1.5));

    const g = mk('g');
    g.appendChild(mk('rect',{x:x+1,y:y+1,width:w-2,height:h-2,
      fill:fillColor, stroke:strokeColor, 'stroke-width':strokeW, rx:1}));
    if(isSel && !isGrayed)
      g.appendChild(mk('rect',{x:x+1,y:y+1,width:w-2,height:h-2,fill:'rgba(37,99,235,0.06)',rx:1}));

    const svgStr = CORE_SVGS[def.svgKey];
    if(svgStr){
      const b64=btoa(unescape(encodeURIComponent(svgStr)));
      const rot=el.rotation||0, sx=el.flipX?-1:1;
      const bw=mmToPx(def.baseW_mm), bh=mmToPx(def.baseH_mm);
      const bx=cx-bw/2, by=cy-bh/2;
      const img=mk('image',{href:`data:image/svg+xml;base64,${b64}`,
        x:bx,y:by,width:bw,height:bh,preserveAspectRatio:'none',
        'pointer-events':'none',opacity:isGrayed?'0.2':'1'});
      img.setAttribute('transform',`translate(${cx},${cy}) rotate(${rot}) scale(${sx},1) translate(${-cx},${-cy})`);
      g.appendChild(img);
    }

    const lblText = (!isGrayed&&_warn)?`⚠ ${def.label}`:def.label;
    const lblStroke=mk('text',{x:cx,y:cy+4,'text-anchor':'middle','font-size':'11','font-weight':'700',
      'font-family':'Pretendard,sans-serif',fill:'none',
      stroke:isGrayed?'#b0b4be':'white','stroke-width':'3',
      'stroke-linejoin':'round','paint-order':'stroke','pointer-events':'none'});
    lblStroke.textContent=lblText; g.appendChild(lblStroke);
    const lbl=mk('text',{x:cx,y:cy+4,'text-anchor':'middle','font-size':'11','font-weight':'700',
      'font-family':'Pretendard,sans-serif',
      fill:isGrayed?'#666a74':(_warn?'#dc2626':def.textColor),'pointer-events':'none'});
    lbl.textContent=lblText; g.appendChild(lbl);

    if(isSel && !isGrayed){
      const hf=mk('circle',{cx:x+w-30,cy:y+10,r:9,fill:'#ea580c',style:'cursor:pointer'});
      hf.addEventListener('mousedown',e=>{e.stopPropagation();flipCoreElement(el.uid);});
      g.appendChild(hf);
      const hft=mk('text',{x:x+w-30,y:y+14,'text-anchor':'middle','font-size':'11',fill:'white','pointer-events':'none'});
      hft.textContent='↔'; g.appendChild(hft);
      const hc=mk('circle',{cx:x+w-10,cy:y+10,r:9,fill:'#2563eb',style:'cursor:pointer'});
      hc.addEventListener('mousedown',e=>{e.stopPropagation();rotateCoreElement(el.uid);});
      g.appendChild(hc);
      const ht=mk('text',{x:x+w-10,y:y+14,'text-anchor':'middle','font-size':'11',fill:'white','pointer-events':'none'});
      ht.textContent='↻'; g.appendChild(ht);
    }
    svg.appendChild(g);
  });
}

function initCoreSVGEvents(){
  const wrap = $('core-canvas-wrap');
  if(!wrap || wrap._coreInit) return;
  wrap._coreInit = true;
  const svg = $('core-svg');

  function svgPos(e){ const r=svg.getBoundingClientRect(); return {mx:e.clientX-r.left, my:e.clientY-r.top}; }
  function hitCD(mx,my){ return CD.elements.find(el=>{ const x=mmToPx(el.x_mm),y=mmToPx(el.y_mm),w=mmToPx(el.w_mm),h=mmToPx(el.h_mm); return mx>=x&&mx<x+w&&my>=y&&my<y+h; }); }

  svg.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    e.stopPropagation();
    const {mx,my}=svgPos(e);
    const el=hitCD(mx,my);
    if(!el){ CD.selected=null; renderSVG(); return; }
    CD.selected=el.uid;
    CD.drag={uid:el.uid, startPx:{x:mx,y:my}, origX:el.x_mm, origY:el.y_mm};
    svg.style.cursor='grabbing'; renderSVG(); e.preventDefault();
  });

  function onCoreMove(e){
    if(!CD.drag) return;
    const r=svg.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const el=CD.elements.find(e2=>e2.uid===CD.drag.uid);
    if(el){
      const nx = Math.round(Math.max(0, CD.drag.origX + Math.round((mx-CD.drag.startPx.x)*MM_PER_PX)) / CELL_MM) * CELL_MM;
      const ny = Math.round(Math.max(0, CD.drag.origY + Math.round((my-CD.drag.startPx.y)*MM_PER_PX)) / CELL_MM) * CELL_MM;
      const prevX=el.x_mm, prevY=el.y_mm;
      el.x_mm=nx; el.y_mm=ny;
      const overlaps=CD.elements.some(o=>
        o.uid!==el.uid &&
        el.x_mm+el.w_mm > o.x_mm && el.x_mm < o.x_mm+o.w_mm &&
        el.y_mm+el.h_mm > o.y_mm && el.y_mm < o.y_mm+o.h_mm
      );
      if(overlaps){ el.x_mm=prevX; el.y_mm=prevY; }
      renderSVG();
    }
  }
  function onCoreUp(){
    if(!CD.drag) return;
    CD.drag=null; svg.style.cursor='default'; renderSVG();
  }
  document.addEventListener('mousemove', onCoreMove);
  document.addEventListener('mouseup', onCoreUp);

  svg.addEventListener('contextmenu', e=>{ e.preventDefault(); const {mx,my}=svgPos(e); const el=hitCD(mx,my); if(el) removeCoreElement(el.uid); });
  svg.addEventListener('mousemove', e=>{ if(CD.drag) return; const {mx,my}=svgPos(e); svg.style.cursor=hitCD(mx,my)?'grab':'default'; });

  if(!window._coreDocRegistered){
    window._coreDocRegistered=true;
    document.addEventListener('keydown', e=>{
      if(document.activeElement.tagName==='INPUT') return;
      if(e.key==='Escape'){ CD.selected=null; renderSVG(); return; }
      if((e.key==='r'||e.key==='R')&&CD.selected!==null) rotateCoreElement(CD.selected);
      if((e.key==='f'||e.key==='F')&&CD.selected!==null) flipCoreElement(CD.selected);
    });
    document.addEventListener('mousedown', e=>{ if(CD.selected!==null){ CD.selected=null; renderSVG(); } });
  }
}

function svgPosToCR(svg, e){
  const rect=svg.getBoundingClientRect();
  return { col:Math.floor((e.clientX-rect.left)/GRID), row:Math.floor((e.clientY-rect.top)/GRID) };
}

function resolveCollisions(){
  if(!CD.drag) return;
  const moving = CD.elements.find(e=>e.uid===CD.drag?.uid);
  if(!moving) return;
  const overlaps = CD.elements.some(e=>
    e.uid!==moving.uid &&
    moving.x_mm < e.x_mm+e.w_mm && moving.x_mm+moving.w_mm > e.x_mm &&
    moving.y_mm < e.y_mm+e.h_mm && moving.y_mm+moving.h_mm > e.y_mm
  );
  if(overlaps){
    moving.x_mm = CD.drag.origX;
    moving.y_mm = CD.drag.origY;
  }
}

function updateCoreNextBtn(){
  const btn=$('core-next-btn');
  if(!btn) return;
  const allDone = CORE_DEF.every(def => {
    const req    = CD.required[def.id] || 0;
    const extra  = CD.extra[def.id]    || 0;
    const placed = CD.placed[def.id]   || 0;
    const eff = (def.id==='ev' && req===0 && extra===0) ? 1 : extra;
    return placed >= (req + eff);
  });
  if(allDone){
    btn.disabled=false;
    btn.style.cssText='font-size:13px;padding:11px;letter-spacing:.01em;background:var(--accent);color:#fff;border:none;cursor:pointer;width:100%;border-radius:6px;font-weight:600;';
  } else {
    btn.disabled=true;
    btn.style.cssText='font-size:13px;padding:11px;letter-spacing:.01em;background:var(--bg3);color:var(--text3);border:1px solid var(--border2);cursor:not-allowed;width:100%;border-radius:6px;font-weight:600;';
  }
}

function resetCoreCanvas(){
  CD.elements=[]; CD.placed={}; CD.extra={}; CD.nextId=1; CD.selected=null; CD._initialized=false;
  renderSVG(); renderCoreList();
}

function initCoreDesign(){
  if(!CD._initialized){
    CD.required=calcCoreRequirements();
    CD.placed={}; CD.extra={}; CD.elements=[]; CD.nextId=1; CD.selected=null;
    CD._initialized=true;
  } else {
    CD.required=calcCoreRequirements();
  }
  renderSVG(); renderCoreList();
  initCoreSVGEvents();
  if (typeof renderAICoreLayoutButton === 'function') renderAICoreLayoutButton();
}
