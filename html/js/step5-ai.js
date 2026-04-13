// Hotel Planner — Step 5 AI Auto-Layout (코어 자동 배치)
// Calls the local proxy (/api/ai-layout → Gemini API)

// ─────────────────────────────────────────────────────────────────
// Main Entry: "AI 자동 배치" 버튼 클릭 핸들러
// ─────────────────────────────────────────────────────────────────
async function aiAutoCoreLayout() {
  const btn    = document.getElementById('ai-core-layout-btn');
  const status = document.getElementById('ai-core-layout-status');

  _setAICoreBtn(btn, status, true, 'AI 분석 중...');

  try {
    const layoutData = _buildCoreLayoutRequest();
    if (!layoutData.elements.length) {
      showToast('배치할 코어 요소가 없습니다.');
      _setAICoreBtn(btn, status, false, '');
      return;
    }

    const guidelines = await _loadCoreGuidelines();
    const prompt     = _buildCorePrompt(layoutData, guidelines);

    _setAICoreBtn(btn, status, true, 'Gemini 요청 중...');

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

    _applyAICoreLayout(parsed);

    const msg = parsed.strategy || 'AI 코어 배치 완료';
    showToast('✅ ' + msg, 5000);
    _setAICoreBtn(btn, status, false, msg);
    setTimeout(() => { if (status) status.textContent = ''; }, 5000);

  } catch (e) {
    console.error('[AI Core Layout]', e);
    showToast('AI 배치 실패: ' + (e.message || '알 수 없는 오류'), 5000);
    _setAICoreBtn(btn, status, false, '오류 — 콘솔 확인');
    setTimeout(() => { if (status) status.textContent = ''; }, 4000);
  }
}

function _setAICoreBtn(btn, status, loading, text) {
  if (btn) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span style="font-size:14px;">⏳</span> ' + text
      : '<span style="font-size:14px;">✨</span> AI 자동 배치';
  }
  if (status) status.textContent = loading ? text : '';
}

// ─────────────────────────────────────────────────────────────────
// Collect required elements from current CD state
// ─────────────────────────────────────────────────────────────────
function _buildCoreLayoutRequest() {
  const req = calcCoreRequirements();

  const elementsToPlace = [];
  CORE_DEF.forEach(def => {
    const required = req[def.id] || 0;
    const extra    = CD.extra[def.id] || 0;
    // 승용EV: 법정 0이어도 추가분 최소 1대 보장
    const total = (def.id === 'ev' && required === 0 && extra === 0) ? 1
                : required + extra;
    for (let i = 0; i < total; i++) {
      elementsToPlace.push({
        defId: def.id,
        label: def.label,
        w_mm:  def.baseW_mm,
        h_mm:  def.baseH_mm,
      });
    }
  });

  return { elements: elementsToPlace, cellMm: CELL_MM, snapMm: SNAP_MM, req };
}

// ─────────────────────────────────────────────────────────────────
// Load ai-guidelines.md (실패 시 빈 문자열)
// ─────────────────────────────────────────────────────────────────
async function _loadCoreGuidelines() {
  try {
    const res = await fetch('/ai-core-guidelines.md?_=' + Date.now());
    if (!res.ok) return '';
    const text = await res.text();
    return text.split('\n')
      .filter(line => !line.trimStart().startsWith('#') || line.trimStart().startsWith('##'))
      .join('\n').trim();
  } catch { return ''; }
}

// ─────────────────────────────────────────────────────────────────
// Build Gemini prompt
// ─────────────────────────────────────────────────────────────────
function _buildCorePrompt(d, guidelines = '') {
  const { elements, cellMm, snapMm } = d;
  const cell = cellMm || 2900;
  const snap = snapMm || 100;

  const elList = elements.map((e, i) =>
    `  [${i}] defId="${e.defId}"  label="${e.label}"  size=${e.w_mm}×${e.h_mm}mm`
  ).join('\n');

  // Example layout: total width estimate
  const totalW = elements.reduce((s, e) => s + e.w_mm, 0);
  const maxH   = Math.max(...elements.map(e => e.h_mm));

  return `You are a Korean hotel core layout AI. \
Generate an optimal arrangement for a hotel vertical circulation core \
(계단, 엘리베이터, 전실, 설비 샤프트).

COORDINATE SYSTEM:
- All values in millimeters (mm), integers only
- Canvas origin (0,0) top-left; X increases right, Y increases down
- Module: ${cell}mm — prefer positions that are multiples of ${cell}
- Snap: ${snap}mm — every x_mm and y_mm MUST be an exact multiple of ${snap}

ELEMENTS TO PLACE (ALL must be included in the output):
${elList}

ADJACENCY RULES (strictly required — elements must share an edge, no gap):
- Every "foyer-emg"  MUST touch an "ev-emg"   element
- Every "foyer-evac" MUST touch an "ev-evac"  element
- Every "foyer-st"   MUST touch a  "stair-s" or "stair-sp" element
- Every "foyer-ev"   MUST touch an "ev"       element (if any)

PLACEMENT STRATEGY (follow in order):
1. No overlaps between any two elements
2. All x_mm ≥ 0, y_mm ≥ 0
3. Arrange in a single compact horizontal band (y_mm values should be 0 or ${cell})
4. Recommended left-to-right order:
     stair-sp → foyer-st → [AV,EPS,TPS,AD,PS shafts] → ev → ev-emg → foyer-emg → ev-evac → foyer-evac → foyer-st → stair-sp
5. Stairs (${cell * 2}mm wide) go at the two ends; elevators in the middle
6. Shaft elements (AV, EPS, TPS, AD, PS) grouped together between stairs and elevators
7. Elements that share a defId should be placed side by side
8. rotation=0 for all elements (keep it simple)
9. flipX=false for left elements, flipX=true for right-side stairs/foyersST (mirror symmetry)

ESTIMATED CANVAS: total width ≈ ${totalW}mm, height ≈ ${maxH + cell}mm
${guidelines ? `\nDESIGN GUIDELINES (from project settings):\n${guidelines}` : ''}

RESPOND WITH ONLY VALID JSON — no markdown fences, no explanation:
{
  "placements": [
    {"defId":"stair-sp","x_mm":0,"y_mm":0,"rotation":0,"flipX":false},
    {"defId":"foyer-st","x_mm":${cell * 2},"y_mm":0,"rotation":0,"flipX":false}
  ],
  "strategy": "배치 전략 한 줄 요약 (한국어)"
}`;
}

// ─────────────────────────────────────────────────────────────────
// Apply AI placements to CD state
// ─────────────────────────────────────────────────────────────────
function _applyAICoreLayout(data) {
  // 기존 캔버스 초기화
  CD.elements = [];
  CD.placed   = {};
  CD.nextId   = 1;
  CD.selected = null;

  (data.placements || []).forEach(p => {
    const def = CORE_DEF.find(d => d.id === p.defId);
    if (!def) return;

    const rot = ((+p.rotation || 0) + 360) % 360;
    let w_mm = def.baseW_mm, h_mm = def.baseH_mm;
    if (rot === 90 || rot === 270) { w_mm = def.baseH_mm; h_mm = def.baseW_mm; }

    const x_mm = Math.round((+p.x_mm || 0) / SNAP_MM) * SNAP_MM;
    const y_mm = Math.round((+p.y_mm || 0) / SNAP_MM) * SNAP_MM;

    CD.elements.push({
      uid: CD.nextId++,
      defId: def.id,
      x_mm, y_mm, w_mm, h_mm,
      rotation: rot,
      flipX: !!p.flipX,
    });
    CD.placed[def.id] = (CD.placed[def.id] || 0) + 1;
  });

  renderSVG();
  renderCoreList();
  updateCoreNextBtn();
}

// ─────────────────────────────────────────────────────────────────
// Render AI button into #ai-core-layout-slot
// ─────────────────────────────────────────────────────────────────
function renderAICoreLayoutButton() {
  const slot = document.getElementById('ai-core-layout-slot');
  if (!slot) return;
  slot.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  const btn = document.createElement('button');
  btn.id        = 'ai-core-layout-btn';
  btn.className = 'btn btn-full';
  btn.innerHTML = '<span style="font-size:14px;">✨</span> AI 자동 배치';
  btn.style.cssText = [
    'font-size:12px;padding:8px 12px;',
    'background:linear-gradient(135deg,#6366f1,#2563eb);',
    'color:#fff;border:none;border-radius:6px;cursor:pointer;',
    'font-weight:700;letter-spacing:.03em;',
    'display:flex;align-items:center;justify-content:center;gap:6px;',
  ].join('');
  btn.onclick = aiAutoCoreLayout;

  const statusEl = document.createElement('div');
  statusEl.id = 'ai-core-layout-status';
  statusEl.style.cssText = 'font-size:10px;color:var(--text3);text-align:center;min-height:14px;';

  wrap.append(btn, statusEl);
  slot.appendChild(wrap);
}
