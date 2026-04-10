// Hotel Planner — Step 6 AI Auto-Layout
// Calls the local Perl proxy server (/api/ai-layout) which securely holds
// the Gemini API key in api.key (project root, never served as a static file).

// ─────────────────────────────────────────────────────────────────
// Main Entry: "AI 자동 배치" 버튼 클릭 핸들러
// ─────────────────────────────────────────────────────────────────
async function aiAutoLayout() {
  const btn    = document.getElementById('ai-layout-btn');
  const status = document.getElementById('ai-layout-status');

  if (!FL.selectedFloorType) {
    showToast('기준층 타입을 먼저 선택하세요.'); return;
  }
  const groups = detectCoreGroups();
  if (!groups.length) {
    showToast('5페이지에서 코어를 먼저 설계하세요.'); return;
  }

  _setAIBtn(btn, status, true, 'AI 분석 중...');

  try {
    const layoutData = _buildLayoutRequest(groups);
    const prompt     = _buildPrompt(layoutData);

    _setAIBtn(btn, status, true, 'Gemini 요청 중...');

    const res = await fetch('/api/ai-layout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.text) throw new Error('AI 응답이 비어 있습니다.');

    // Parse JSON from AI text response
    let parsed;
    try { parsed = JSON.parse(data.text); }
    catch {
      const m = data.text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
      parsed = JSON.parse(m[0]);
    }

    _applyAILayout(parsed, groups);

    const msg = parsed.strategy || 'AI 배치 완료';
    showToast('✅ ' + msg, 5000);
    _setAIBtn(btn, status, false, msg);
    setTimeout(() => { if (status) status.textContent = ''; }, 5000);

  } catch (e) {
    console.error('[AI Layout]', e);
    showToast('AI 배치 실패: ' + (e.message || '알 수 없는 오류'), 5000);
    _setAIBtn(btn, status, false, '오류 — 콘솔 확인');
    setTimeout(() => { if (status) status.textContent = ''; }, 4000);
  }
}

function _setAIBtn(btn, status, loading, text) {
  if (btn) { btn.disabled = loading; btn.innerHTML = loading
    ? '<span style="font-size:14px;">⏳</span> ' + text
    : '<span style="font-size:14px;">✨</span> AI 자동 배치'; }
  if (status) status.textContent = loading ? text : '';
}

// ─────────────────────────────────────────────────────────────────
// Collect layout data from current FL state
// ─────────────────────────────────────────────────────────────────
function _buildLayoutRequest(groups) {
  return {
    buildableBbox:  _getBuildableBbox(),
    coreGroups:     groups.map((g, i) => { const b = groupBBox(g); return { groupIdx: i, w_mm: b.w_mm, h_mm: b.h_mm }; }),
    roomTypes:      FL.roomTypes.map(rt => ({ id: rt.id, w_mm: rt.w_mm, d_mm: rt.d_mm })),
    targetArea_m2:  FL.selectedFloorType.area,
    snapMm:         SNAP_MM,
  };
}

// ─────────────────────────────────────────────────────────────────
// Compute buildable area bounding box in canvas mm coordinates
// ─────────────────────────────────────────────────────────────────
function _getBuildableBbox() {
  const so = FL.siteOverlay;
  if (so) {
    const ring = (so.buildableCoords?.length ? so.buildableCoords[0] : null)
               || (so.lotCoords?.length       ? so.lotCoords[0]       : null);
    if (ring?.length) {
      const theta = so.rotation * Math.PI / 180;
      const cos_t = Math.cos(theta), sin_t = Math.sin(theta);
      const pts = ring.map(p => ({
        x: so.x_mm + p.x * cos_t - p.y * sin_t,
        y: so.y_mm + p.x * sin_t + p.y * cos_t,
      }));
      let x0 = Math.ceil (Math.min(...pts.map(p=>p.x)) / SNAP_MM) * SNAP_MM;
      let y0 = Math.ceil (Math.min(...pts.map(p=>p.y)) / SNAP_MM) * SNAP_MM;
      let x1 = Math.floor(Math.max(...pts.map(p=>p.x)) / SNAP_MM) * SNAP_MM;
      let y1 = Math.floor(Math.max(...pts.map(p=>p.y)) / SNAP_MM) * SNAP_MM;
      if (!so.buildableCoords?.length) { x0+=1000; y0+=1000; x1-=1000; y1-=1000; }
      return { x_min:x0, y_min:y0, x_max:x1, y_max:y1 };
    }
  }
  return { x_min:2000, y_min:2000, x_max:32000, y_max:22000 };
}

// ─────────────────────────────────────────────────────────────────
// Build the Gemini prompt from layout data
// ─────────────────────────────────────────────────────────────────
function _buildPrompt(d) {
  const { buildableBbox: b, coreGroups, roomTypes, targetArea_m2, snapMm } = d;
  const snap = snapMm || 100;
  const bw = b.x_max - b.x_min, bh = b.y_max - b.y_min;
  const cx = Math.round((b.x_min + b.x_max) / 2 / snap) * snap;
  const cy = Math.round((b.y_min + b.y_max) / 2 / snap) * snap;

  const coreList = coreGroups.map(c =>
    `  Core[${c.groupIdx}]: ${c.w_mm}×${c.h_mm}mm (${(c.w_mm/1000).toFixed(1)}m×${(c.h_mm/1000).toFixed(1)}m)`
  ).join('\n');

  // Pick the smallest room type that fits vertically; fall back to smallest depth available
  const fittingTypes = roomTypes.filter(r => r.d_mm <= bh);
  const ref = (fittingTypes.length ? fittingTypes : roomTypes)
    .reduce((best, r) => (!best || r.d_mm < best.d_mm) ? r : best, null)
    || { id:'A', w_mm:4500, d_mm:9000 };

  const roomList = roomTypes.map(r => {
    const fits = (r.w_mm <= bw) && (r.d_mm <= bh);
    return `  Type "${r.id}": width=${r.w_mm}mm, depth=${r.d_mm}mm${fits ? '' : ' ⚠ too large to fit in single row'}`;
  }).join('\n');

  const core0  = coreGroups[0] || { w_mm:6000, h_mm:8000 };
  const coreX  = Math.round((cx - core0.w_mm / 2) / snap) * snap;
  const coreY  = Math.round((cy - core0.h_mm / 2) / snap) * snap;
  const topY   = b.y_min;
  const botY   = Math.max(b.y_min, Math.round((b.y_max - ref.d_mm) / snap) * snap);
  const nRooms = Math.floor(bw / ref.w_mm);

  // Only include example placements when rooms actually fit
  const canFit = ref.d_mm <= bh && ref.w_mm <= bw;
  const exTop = canFit ? Array.from({length: Math.min(3,nRooms)}, (_,i) =>
    `{"typeId":"${ref.id}","x_mm":${b.x_min + i*ref.w_mm},"y_mm":${topY},"rotation":0}`
  ).join(',\n    ') : `{"typeId":"${ref.id}","x_mm":${b.x_min},"y_mm":${topY},"rotation":0}`;

  const exBot = (canFit && botY >= b.y_min && botY + ref.d_mm <= b.y_max)
    ? Array.from({length: Math.min(3,nRooms)}, (_,i) =>
        `{"typeId":"${ref.id}","x_mm":${b.x_min + i*ref.w_mm},"y_mm":${botY},"rotation":180}`
      ).join(',\n    ')
    : '';

  const exPlacements = exBot
    ? `    ${exTop},\n    ${exBot}`
    : `    ${exTop}`;

  return `You are a hotel floor plan layout AI. Generate an optimal layout for a standard hotel guest floor.

COORDINATE SYSTEM:
- All values in millimeters (mm), integers only
- Canvas origin (0,0) top-left; X increases right, Y increases down
- Snap grid: ${snap}mm — every x_mm and y_mm MUST be an exact multiple of ${snap}

BUILDABLE AREA (keep ALL elements fully inside — strict hard boundary):
  x: [${b.x_min}, ${b.x_max}]  width=${bw}mm (${(bw/1000).toFixed(1)}m)
  y: [${b.y_min}, ${b.y_max}]  height=${bh}mm (${(bh/1000).toFixed(1)}m)
  center: (${cx}, ${cy})
  Target hotel floor area to fill: ${targetArea_m2}m²

ROOM FOOTPRINT RULES (rotation=0 or 180):
  - rotation=0:   room occupies x=[x_mm, x_mm+width], y=[y_mm, y_mm+depth]
  - rotation=180: room occupies x=[x_mm, x_mm+width], y=[y_mm, y_mm+depth]
  (x_mm is always top-left corner; depth extends downward regardless of rotation)
  → Every room MUST satisfy: x_mm≥${b.x_min}, x_mm+width≤${b.x_max}, y_mm≥${b.y_min}, y_mm+depth≤${b.y_max}

ELEMENTS:
Cores (ALL must be placed):
${coreList}

Room Types available:
${roomList}

LAYOUT RULES:
1. Place core(s) centered:
   x_mm = ${coreX}, y_mm = ${coreY}
   Multiple cores: place side-by-side from center

2. Double-loaded corridor (use only room types that fit within buildable height):
   TOP ROW (rotation=0, window at top): y_mm = ${topY}
   BOTTOM ROW (rotation=180, window at bottom): y_mm = ${botY}
   Start x=${b.x_min}, step by room width, skip positions that overlap the core

3. STRICT: No element may extend beyond buildable area boundary
4. STRICT: No overlaps between any two elements
5. All coordinates must be exact multiples of ${snap}
6. Place as many rooms as possible without violating rules 3-5

RESPOND WITH ONLY VALID JSON (no markdown, no explanation):
{
  "corePlacements": [{"groupIdx":0,"x_mm":${coreX},"y_mm":${coreY}}],
  "roomPlacements": [
${exPlacements}
  ],
  "strategy": "코어 중앙 배치 + double-loaded corridor 방식으로 객실 배치"
}`;
}

// ─────────────────────────────────────────────────────────────────
// Apply AI layout to FL state
// ─────────────────────────────────────────────────────────────────
function _applyAILayout(data, groups) {
  FL.instances = []; FL.nextId = 1; FL.selected = null; FL.placedGroups = new Set();
  FL.roomInstances = []; FL.roomNextId = 1; FL.selectedRoom = null;

  (data.corePlacements || []).forEach(cp => {
    const group = groups[cp.groupIdx]; if (!group) return;
    const bbox = groupBBox(group);
    FL.instances.push({
      uid: FL.nextId++, groupIdx: cp.groupIdx,
      x_mm: snapMm(+cp.x_mm||0), y_mm: snapMm(+cp.y_mm||0),
      w_mm: bbox.w_mm, h_mm: bbox.h_mm,
      rotation: 0, flipX: false, group, bbox,
    });
    FL.placedGroups.add(cp.groupIdx);
  });

  const bbox = _getBuildableBbox();
  (data.roomPlacements || []).forEach(rp => {
    const rt = FL.roomTypes.find(r => r.id === rp.typeId);
    if (!rt) return;
    const x = snapMm(+rp.x_mm || 0), y = snapMm(+rp.y_mm || 0);
    // Filter out rooms that extend outside the buildable area
    if (x < bbox.x_min || x + rt.w_mm > bbox.x_max) return;
    if (y < bbox.y_min || y + rt.d_mm > bbox.y_max) return;
    FL.roomInstances.push({
      uid: FL.roomNextId++, typeId: rp.typeId,
      x_mm: x, y_mm: y,
      rotation: +rp.rotation || 0,
    });
  });

  renderFloorPlan();
  renderFloorCoreList();
  updateFloorAreaBar();
}

// ─────────────────────────────────────────────────────────────────
// Render the AI button into #ai-layout-slot
// ─────────────────────────────────────────────────────────────────
function renderAILayoutButton() {
  const slot = document.getElementById('ai-layout-slot');
  if (!slot) return;
  slot.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  const btn = document.createElement('button');
  btn.id        = 'ai-layout-btn';
  btn.className = 'btn btn-full';
  btn.innerHTML = '<span style="font-size:14px;">✨</span> AI 자동 배치';
  btn.style.cssText = [
    'font-size:12px;padding:8px 12px;',
    'background:linear-gradient(135deg,#6366f1,#2563eb);',
    'color:#fff;border:none;border-radius:6px;cursor:pointer;',
    'font-weight:700;letter-spacing:.03em;',
    'display:flex;align-items:center;justify-content:center;gap:6px;',
  ].join('');
  btn.onclick = aiAutoLayout;

  const statusEl = document.createElement('div');
  statusEl.id = 'ai-layout-status';
  statusEl.style.cssText = 'font-size:10px;color:var(--text3);text-align:center;min-height:14px;';

  wrap.append(btn, statusEl);
  slot.appendChild(wrap);
}
