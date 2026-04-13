// Hotel Planner — Firebase Project Manager (Realtime Database)
'use strict';

// ═══════════════════════════════════════════
// FIREBASE CONFIG
// ═══════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBsK8d-qwgndrh60kg-S43vNdu2j5tU1q4",
  authDomain:        "ai-studio-applet-webapp-fdb2e.firebaseapp.com",
  projectId:         "ai-studio-applet-webapp-fdb2e",
  storageBucket:     "ai-studio-applet-webapp-fdb2e.firebasestorage.app",
  messagingSenderId: "191086519168",
  appId:             "1:191086519168:web:9b2a63deedfbbfceefd765",
  databaseURL:       "https://ai-studio-applet-webapp-fdb2e-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// ─── Init ─────────────────────────────────
let db = null;
const PROJECTS_PATH = 'hotel-planner-projects';

(function initFirebase() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch(e) {
    console.warn('Firebase 초기화 실패 — 프로젝트 저장 기능이 비활성화됩니다.', e);
  }
})();

// ─── Key 인코딩 (RTDB 금지 문자 제거) ────────
// RTDB 키에는 . # $ / [ ] 사용 불가
function toKey(name) {
  return name.replace(/[.#$/\[\]]/g, '_');
}

// ─── SHA-256 Password Hash ─────────────────
async function hashPw(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── State Snapshot ────────────────────────
function getSnapshot() {
  const s = {};
  Object.keys(state).forEach(k => {
    if (state[k] instanceof Set) s[k] = [...state[k]];
    else if (k === 'searchMarker') s[k] = state[k]
      ? { addr: state[k].addr, lng: state[k].lng, lat: state[k].lat } : null;
    else if (k === 'floors') s[k] = state.floors.map(f => ({...f}));
    else s[k] = state[k];
  });

  let lotsArr = [];
  if (typeof selectedLots !== 'undefined') {
    lotsArr = [...selectedLots.entries()].map(([k, v]) => [k, {...v}]);
  }

  let s2 = {};
  if (typeof S2 !== 'undefined') {
    s2 = {
      activeUseIds: [...S2.activeUseIds],
      floors: S2.floors.map(f => ({...f})),
    };
  }

  // ── Step 1: 지도 뷰 + 선택 필지 GeoJSON ──
  const step1 = {};
  try {
    if (typeof vMap !== 'undefined' && vMap) {
      step1.mapCenter = vMap.getView().getCenter();
      step1.mapZoom   = vMap.getView().getZoom();
    }
    if (window._lotSource) {
      const fmt = new ol.format.GeoJSON();
      step1.lotFeatures = window._lotSource.getFeatures().map(f => {
        const clone = f.getGeometry().clone();
        clone.transform('EPSG:3857', 'EPSG:4326');
        return { pnu: f.get('pnu'), geojson: JSON.parse(fmt.writeGeometry(clone)) };
      });
    }
    if (window._step1MergedPoly) step1.mergedPoly = window._step1MergedPoly;
  } catch(e) { console.warn('step1 snapshot:', e); }

  // ── Step 2: 외곽선 소스 GeoJSON + 미니맵 뷰 ──
  const step2 = {};
  try {
    if (window._step1OutlineSource) {
      const fmt = new ol.format.GeoJSON();
      step2.outlineFeatures = window._step1OutlineSource.getFeatures().map(f => {
        const clone = f.getGeometry().clone();
        clone.transform('EPSG:3857', 'EPSG:4326');
        return { type: f.get('type'), geojson: JSON.parse(fmt.writeGeometry(clone)) };
      });
    }
    if (window._step1Map) {
      step2.mapCenter = window._step1Map.getView().getCenter();
      step2.mapZoom   = window._step1Map.getView().getZoom();
    }
  } catch(e) { console.warn('step2 snapshot:', e); }

  // ── Step 4: 지하층 (SU) ──
  const su = {};
  try {
    if (typeof SU !== 'undefined' && SU.floors.length) {
      su.floors = SU.floors.map(f => ({ ...f, cells: (f.cells||[]).map(c => ({...c})) }));
    }
  } catch(e) { console.warn('SU snapshot:', e); }

  // ── Step 5: 코어 배치 (CD) ──
  const cd = {};
  try {
    if (typeof CD !== 'undefined') {
      cd.elements = CD.elements.map(e => ({...e}));
      cd.placed   = {...CD.placed};
      cd.extra    = {...CD.extra};
      cd.nextId   = CD.nextId;
    }
  } catch(e) { console.warn('CD snapshot:', e); }

  // ── Step 6: 기준층 배치 (FL) ──
  const fl = {};
  try {
    if (typeof FL !== 'undefined') {
      fl.instances = FL.instances.map(i => ({
        ...i,
        group: i.group ? i.group.map(e => ({...e})) : null,
        bbox:  i.bbox  ? {...i.bbox} : null,
      }));
      fl.nextId            = FL.nextId;
      fl.placedGroups      = [...FL.placedGroups];
      fl.roomTypes         = FL.roomTypes.map(rt => ({...rt}));
      fl.roomInstances     = FL.roomInstances.map(ri => ({...ri}));
      fl.roomNextId        = FL.roomNextId;
      fl.selectedFloorType = FL.selectedFloorType ? {...FL.selectedFloorType} : null;
      if (FL.siteOverlay) {
        fl.siteOverlay = {
          x_mm: FL.siteOverlay.x_mm,
          y_mm: FL.siteOverlay.y_mm,
          rotation: FL.siteOverlay.rotation,
        };
      }
    }
  } catch(e) { console.warn('FL snapshot:', e); }

  return { state: s, lotsArr, s2, step1, step2, su, cd, fl };
}

function restoreSnapshot(snap) {
  if (!snap) return;

  // ── state ──
  const s = snap.state || {};
  Object.keys(s).forEach(k => {
    if (k === 'selectedLots') state.selectedLots = new Set(s[k] || []);
    else state[k] = s[k];
  });

  // ── selectedLots Map ──
  if (typeof selectedLots !== 'undefined' && snap.lotsArr) {
    selectedLots.clear();
    snap.lotsArr.forEach(([k, v]) => selectedLots.set(k, v));
  }

  // ── S2 (3페이지 지상 볼륨) ──
  if (typeof S2 !== 'undefined' && snap.s2) {
    S2.activeUseIds   = new Set(snap.s2.activeUseIds || []);
    S2.floors         = (snap.s2.floors || []).map(f => ({...f}));
    S2.selectedFloors = new Set();
    S2.selectedCells  = new Set();
  }

  // ── Step 1: 지도 뷰 + 필지 GeoJSON ──
  try {
    const st1 = snap.step1 || {};
    if (typeof vMap !== 'undefined' && vMap && st1.mapCenter) {
      vMap.getView().setCenter(st1.mapCenter);
      vMap.getView().setZoom(st1.mapZoom || 19);
    }
    if (window._lotSource && st1.lotFeatures?.length) {
      const fmt = new ol.format.GeoJSON();
      window._lotSource.clear();
      st1.lotFeatures.forEach(item => {
        try {
          const olGeom = fmt.readGeometry(item.geojson);
          olGeom.transform('EPSG:4326', 'EPSG:3857');
          const feat = new ol.Feature({ geometry: olGeom });
          feat.set('pnu', item.pnu);
          window._lotSource.addFeature(feat);
        } catch(e) {}
      });
    }
    if (st1.mergedPoly) {
      window._step1MergedPoly = st1.mergedPoly;
      try { window._step1LotArea = turf.area(st1.mergedPoly); } catch(e) {}
    }
  } catch(e) { console.warn('step1 restore:', e); }

  // ── Step 2: 외곽선 피처 → 지연 복원 ──
  try {
    const st2 = snap.step2 || {};
    if (st2.outlineFeatures?.length)
      window._pendingOutlineFeatures = st2.outlineFeatures;
    if (st2.mapCenter)
      window._pendingStep1MapView = { center: st2.mapCenter, zoom: st2.mapZoom || 18 };
  } catch(e) { console.warn('step2 restore:', e); }

  // ── Step 4: SU (지하층) ──
  try {
    if (typeof SU !== 'undefined' && snap.su?.floors?.length) {
      SU.floors = snap.su.floors.map(f => ({
        ...f, cells: (f.cells||[]).map(c => ({...c}))
      }));
      SU.selectedFloors = new Set();
      SU.selectedCells  = new Set();
    }
  } catch(e) { console.warn('SU restore:', e); }

  // ── Step 5: CD (코어 배치) ──
  try {
    if (typeof CD !== 'undefined' && snap.cd?.elements) {
      CD.elements     = snap.cd.elements.map(e => ({...e}));
      CD.placed       = {...(snap.cd.placed || {})};
      CD.extra        = {...(snap.cd.extra  || {})};
      CD.nextId       = snap.cd.nextId || 1;
      CD.selected     = null;
      CD._initialized = true;   // initCoreDesign()에서 초기화 스킵
    }
  } catch(e) { console.warn('CD restore:', e); }

  // ── Step 6: FL (기준층 배치) ──
  try {
    if (typeof FL !== 'undefined' && snap.fl) {
      const fl = snap.fl;
      FL.instances = (fl.instances||[]).map(i => ({
        ...i,
        group: i.group ? i.group.map(e => ({...e})) : null,
        bbox:  i.bbox  ? {...i.bbox} : null,
      }));
      FL.nextId            = fl.nextId    || 1;
      FL.placedGroups      = new Set(fl.placedGroups || []);
      FL.roomTypes         = (fl.roomTypes || [{ id:'A', w_mm:4500, d_mm:9000, locked:true }]).map(rt => ({...rt}));
      FL.roomInstances     = (fl.roomInstances||[]).map(ri => ({...ri}));
      FL.roomNextId        = fl.roomNextId || 1;
      FL.selectedFloorType = fl.selectedFloorType || null;
      FL.siteOverlay       = null;  // buildSiteOverlay()가 재생성
      FL.selected = null; FL.drag = null; FL.selectedRoom = null; FL.roomDrag = null;
      if (fl.siteOverlay) window._pendingSiteOverlay = fl.siteOverlay;
    }
  } catch(e) { console.warn('FL restore:', e); }

  // ── UI 복원 ──
  try {
    if (typeof updateSelectedLots === 'function') updateSelectedLots();
    if (state.searchMarker?.addr) {
      const locEl    = $('selected-location');
      const parcelEl = $('selected-addr-parcel');
      if (locEl)    locEl.style.display  = 'block';
      if (parcelEl) parcelEl.textContent = state.searchMarker.addr;
    }
  } catch(e) { console.warn('UI restore:', e); }
}

// ─── Firebase Operations ───────────────────
let currentProjectName = '';
let currentProjectPw   = '';

async function pmCreateProject() {
  if (!db) { showToast('Firebase가 연결되지 않았습니다'); return; }
  const name = $('pm-new-name').value.trim();
  const pw   = $('pm-new-pw').value;

  if (!name)         { showToast('프로젝트 이름을 입력하세요'); return; }
  if (pw.length < 4) { showToast('비밀번호는 4자 이상이어야 합니다'); return; }

  const key = toKey(name);
  try {
    const existing = await db.ref(`${PROJECTS_PATH}/${key}`).once('value');
    if (existing.exists()) { showToast('같은 이름의 프로젝트가 이미 있습니다'); return; }

    await db.ref(`${PROJECTS_PATH}/${key}`).set({
      name,
      passwordHash: await hashPw(pw),
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      data: getSnapshot(),
    });

    _setCurrentProject(name, pw);
    closeProjectModal();
    showToast(`"${name}" 프로젝트 생성 완료`);
  } catch(e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다');
  }
}

async function pmLoadProject() {
  if (!db) { showToast('Firebase가 연결되지 않았습니다'); return; }
  const name = $('pm-load-select').value;
  const pw   = $('pm-load-pw').value;

  if (!name) { showToast('프로젝트를 선택하세요'); return; }
  if (!pw)   { showToast('비밀번호를 입력하세요'); return; }

  const key = toKey(name);
  try {
    const snap = await db.ref(`${PROJECTS_PATH}/${key}`).once('value');
    if (!snap.exists()) { showToast('프로젝트를 찾을 수 없습니다'); return; }

    const data = snap.val();
    if (data.passwordHash !== await hashPw(pw)) {
      showToast('비밀번호가 틀렸습니다'); return;
    }

    restoreSnapshot(data.data);
    _setCurrentProject(name, pw);
    closeProjectModal();
    showToast(`"${name}" 불러오기 완료`);
    goStep(1);
  } catch(e) {
    console.error(e);
    showToast('불러오기 중 오류가 발생했습니다');
  }
}

async function pmSaveCurrentProject() {
  if (!db || !currentProjectName) { showToast('열린 프로젝트가 없습니다'); return; }
  const key = toKey(currentProjectName);
  try {
    await db.ref(`${PROJECTS_PATH}/${key}`).update({
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      data: getSnapshot(),
    });
    showToast('저장되었습니다');
  } catch(e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다');
  }
}

function _setCurrentProject(name, pw) {
  currentProjectName = name;
  currentProjectPw   = pw;
  $('project-name-display').textContent = name;
  $('proj-save-btn').style.display = '';
}

// ─── Project List ──────────────────────────
async function loadProjectList() {
  const sel = $('pm-load-select');
  sel.innerHTML = '<option value="">불러오는 중…</option>';
  if (!db) { sel.innerHTML = '<option value="">Firebase 미연결</option>'; return; }

  try {
    const snap = await db.ref(PROJECTS_PATH).orderByChild('updatedAt').once('value');
    if (!snap.exists()) {
      sel.innerHTML = '<option value="">저장된 프로젝트 없음</option>'; return;
    }

    const items = [];
    snap.forEach(child => { items.push({ key: child.key, name: child.val().name }); });
    items.reverse(); // 최신순

    sel.innerHTML = '<option value="">프로젝트를 선택하세요</option>';
    items.forEach(({ name }) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch(e) {
    sel.innerHTML = '<option value="">목록 로드 실패</option>';
  }
}

// ─── Modal UI ──────────────────────────────
function openProjectModal() {
  $('project-modal').style.display = 'flex';
  loadProjectList();
}

function closeProjectModal() {
  $('project-modal').style.display = 'none';
  $('pm-new-name').value = '';
  $('pm-new-pw').value   = '';
  $('pm-load-pw').value  = '';
}
