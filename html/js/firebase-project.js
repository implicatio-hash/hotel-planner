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
    else if (k === 'searchMarker') s[k] = null;
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

  return { state: s, lotsArr, s2 };
}

function restoreSnapshot(snap) {
  if (!snap) return;

  const s = snap.state || {};
  Object.keys(s).forEach(k => {
    if (k === 'selectedLots') state.selectedLots = new Set(s[k] || []);
    else state[k] = s[k];
  });

  if (typeof selectedLots !== 'undefined' && snap.lotsArr) {
    selectedLots.clear();
    snap.lotsArr.forEach(([k, v]) => selectedLots.set(k, v));
  }

  if (typeof S2 !== 'undefined' && snap.s2) {
    S2.activeUseIds = new Set(snap.s2.activeUseIds || []);
    S2.floors = (snap.s2.floors || []).map(f => ({...f}));
    S2.selectedFloors = new Set();
    S2.selectedCells = new Set();
  }
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
