// STEP 1 — 대지 선택
// ═══════════════════════════════════════════
// STEP 1 — VWORLD MAP SDK + SEARCH + 필지
// ═══════════════════════════════════════════
const VWORLD_KEY = 'F6A1D87B-4FE7-3E62-9D90-11C694E11A53';

let vMap = null;
let vMarker = null;
let selectedLots = new Map();

// ── 지도 초기화 ──
function initVMap(){
  if(vMap) return;

  // 기본지도 (WMTS) — 무채색+파란 오버레이 (타일 레이어에만 적용)
  const baseLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`,
      maxZoom: 19
    })
  });
  // 타일 레이어 canvas에만 CSS filter 적용 (벡터 레이어는 영향 없음)
  baseLayer.on('prerender', function(e){
    e.context.filter = 'grayscale(100%) brightness(0.85) contrast(1.45)';
  });
  baseLayer.on('postrender', function(e){
    e.context.filter = 'none';
  });

  // 지적도 벡터 레이어 (WFS — 은은한 파란색 선)
  const cadastralSource = new ol.source.Vector();
  window._cadastralSource = cadastralSource;
  const cadastralLayer = new ol.layer.Vector({
    source: cadastralSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: 'rgba(147,197,253,0.08)' }),
      stroke: new ol.style.Stroke({ color: '#93c5fd', width: 1 })
    }),
    minZoom: 19
  });

  // 선택 필지 하이라이트 (파란색)
  const lotSource = new ol.source.Vector();
  window._lotSource = lotSource;
  const lotLayer = new ol.layer.Vector({
    source: lotSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: 'rgba(37,99,235,0.45)' }),
      stroke: new ol.style.Stroke({ color: '#2563eb', width: 2.5 })
    })
  });

  // 마커 레이어
  const markerSource = new ol.source.Vector();
  vMarker = { source: markerSource };
  const markerLayer = new ol.layer.Vector({ source: markerSource });

  vMap = new ol.Map({
    target: 'vmap',
    layers: [baseLayer, cadastralLayer, lotLayer, markerLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([126.9780, 37.5665]),
      zoom: 15,
      minZoom: 7,
      maxZoom: 21
    }),
    controls: []
  });

  // 지도 이동 끝 → 현재 범위 WFS 로드
  let _prevZoom = vMap.getView().getZoom();
  vMap.on('moveend', function(){
    const zoom = vMap.getView().getZoom();
    if(_prevZoom < 19 && zoom >= 19) loadCadastralWFS();
    if(zoom < 19 && window._cadastralSource) window._cadastralSource.clear();
    _prevZoom = zoom;
  });

  // 클릭 → 벡터에서 직접 필지 특정 (GetFeatureInfo 불필요)
  vMap.on('singleclick', function(e){
    let hit = false;
    vMap.forEachFeatureAtPixel(e.pixel, function(feature, layer){
      if(hit || layer !== cadastralLayer) return;
      hit = true;
      const props = feature.get('props') || {};
      const pnu  = props.pnu  || String(Date.now());
      const addr = props.addr || props.jibun || '주소 미상';
      const olGeom = feature.getGeometry();
      toggleLot(pnu, addr, 0, olGeom);
      // 등록 면적 조회
      fetchLandArea(pnu);
    }, { hitTolerance: 4 });
  });
}

// WFS JSONP로 현재 화면 범위 지적도 로드
let _cadastralLoading = false;
function loadCadastralWFS(){
  if(!vMap || _cadastralLoading) return;
  const zoom = vMap.getView().getZoom();
  if(zoom < 19){ if(window._cadastralSource) window._cadastralSource.clear(); return; }

  _cadastralLoading = true;
  const ext = vMap.getView().calculateExtent(vMap.getSize());
  const [minLng, minLat, maxLng, maxLat] = ol.proj.transformExtent(ext, 'EPSG:3857', 'EPSG:4326');

  const cbName = 'cad_' + Date.now();
  const script = document.createElement('script');
  const timer = setTimeout(()=>{ _cadastralLoading=false; cleanup(); }, 10000);
  function cleanup(){ clearTimeout(timer); delete window[cbName]; if(script.parentNode) script.parentNode.removeChild(script); }

  window[cbName] = function(data){
    _cadastralLoading = false; cleanup();
    const features = data && data.features || [];
    if(!features.length) return;
    const fmt = new ol.format.GeoJSON();
    const src = window._cadastralSource;
    if(!src) return;
    // 기존 feature 중 현재 범위 밖 것만 제거, 새 것 추가 (중복 pnu 스킵)
    const existingPnus = new Set(src.getFeatures().map(f => f.get('props')?.pnu));
    features.forEach(f => {
      const pnu = f.properties?.pnu;
      if(pnu && existingPnus.has(pnu)) return;
      try {
        const olF = fmt.readFeature(f, { dataProjection:'EPSG:4326', featureProjection:'EPSG:3857' });
        olF.set('props', f.properties);
        src.addFeature(olF);
      } catch(e){}
    });
  };
  script.onerror = ()=>{ _cadastralLoading=false; cleanup(); };
  // BBOX: EPSG:4326에서 (ymin,xmin,ymax,xmax)
  script.src = `https://api.vworld.kr/req/wfs?service=WFS&version=1.1.0&request=GetFeature`
    + `&typename=lp_pa_cbnd_bubun`
    + `&bbox=${minLat},${minLng},${maxLat},${maxLng},EPSG:4326`
    + `&srsname=EPSG:4326&maxfeatures=500`
    + `&output=text/javascript&format_options=callback:${cbName}`
    + `&key=${VWORLD_KEY}`;
  document.body.appendChild(script);
}

// ── 건축한계선 SHP 로드 (GitHub Raw) ──
const SHP_URL = 'https://raw.githubusercontent.com/implicatio-hash/hotel-planner/main/C_UQ163_LM.zip';
const PROJ5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs';

let _shpLoaded = false;
let _shpGeoJSONs = []; // WGS84 GeoJSON 배열 — 1페이지 지도에는 추가 안 함

async function loadSetbackLayer(){
  if(_shpLoaded) return;
  if(typeof JSZip === 'undefined' || typeof proj4 === 'undefined') return;
  try {
    proj4.defs('EPSG:5174', PROJ5174);
    const toWGS84 = proj4('EPSG:5174', 'EPSG:4326');
    const resp = await fetch(SHP_URL);
    const buf  = await resp.arrayBuffer();
    const zip  = await JSZip.loadAsync(buf);
    const shpFile = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.shp'));
    if(!shpFile) return;
    const shpBuf = await zip.files[shpFile].async('arraybuffer');
    _shpGeoJSONs = parseSHP(shpBuf, toWGS84);
    _shpLoaded = true;
    console.log('건축한계선 로드 완료:', _shpGeoJSONs.length, '개');
  } catch(e){ console.warn('SHP load error:', e); }
}

function parseSHP(buf, proj){
  const view = new DataView(buf);
  const features = [];
  let offset = 100; // 헤더 스킵

  while(offset < view.byteLength - 8){
    const contentLen = view.getInt32(offset + 4, false) * 2; // big-endian, 16bit words
    if(contentLen <= 0 || offset + 8 + contentLen > view.byteLength) break;
    const shapeType = view.getInt32(offset + 8, true);

    // 3=PolyLine, 5=Polygon, 13=PolyLineZ, 15=PolygonZ
    if(shapeType === 3 || shapeType === 5 || shapeType === 13 || shapeType === 15){
      try {
        const numParts = view.getInt32(offset + 44, true);
        const numPoints = view.getInt32(offset + 48, true);
        const partsOffset = offset + 52;
        const pointsOffset = partsOffset + numParts * 4;

        const parts = [];
        for(let p=0; p<numParts; p++) parts.push(view.getInt32(partsOffset + p*4, true));

        const allPts = [];
        for(let p=0; p<numPoints; p++){
          const x = view.getFloat64(pointsOffset + p*16, true);
          const y = view.getFloat64(pointsOffset + p*16 + 8, true);
          const [lng, lat] = proj.forward([x, y]);
          allPts.push([lng, lat]);
        }

        const rings = parts.map((start, i) => {
          const end = i < parts.length-1 ? parts[i+1] : numPoints;
          return allPts.slice(start, end);
        });

        const geomType = (shapeType === 5 || shapeType === 15) ? 'Polygon' : 'MultiLineString';
        features.push({
          type: 'Feature',
          geometry: geomType === 'Polygon'
            ? { type:'Polygon', coordinates: rings }
            : { type:'MultiLineString', coordinates: rings }
        });
      } catch(e){}
    }
    offset += 8 + contentLen;
  }
  return features;
}

// 등록 면적 조회 (getLandCharacteristics)
function fetchLandArea(pnu){
  const lcCb = 'lc_' + Date.now();
  const s = document.createElement('script');
  window[lcCb] = function(data){
    delete window[lcCb]; if(s.parentNode) s.parentNode.removeChild(s);
    const field = data?.landCharacteristicss?.field;
    const area = field && field.length ? parseFloat(field[0].lndpclAr || 0) : 0;
    if(selectedLots.has(pnu)){
      selectedLots.get(pnu).area = area;
      updateSelectedLots();
    }
  };
  s.onerror = ()=>{ delete window[lcCb]; if(s.parentNode) s.parentNode.removeChild(s); };
  s.src = `https://api.vworld.kr/ned/data/getLandCharacteristics`
    + `?key=${VWORLD_KEY}&pnu=${encodeURIComponent(pnu)}&format=json&numOfRows=1&pageNo=1&callback=${lcCb}`;
  document.body.appendChild(s);
}

// Ctrl 키 추적
window.addEventListener('keydown', e => { if(e.key==='Control'||e.key==='Meta') window._ctrlDown=true; });
window.addEventListener('keyup',   e => { if(e.key==='Control'||e.key==='Meta') window._ctrlDown=false; });

// ── 주소 검색 (JSONP) ──
function searchAddr(){
  const q = $('addr-search').value.trim();
  if(!q){ showToast('주소를 입력해 주세요'); return; }
  setSearchStatus('검색 중…');
  // 이전 선택 초기화
  $('search-results').style.display = 'none';
  $('selected-location').style.display = 'none';
  selectedLots.clear();
  updateSelectedLots();

  searchByJsonp(q, 'parcel', function(items){
    if(items.length){ renderResults(items); return; }
    searchByJsonp(q, 'road', function(items2){
      if(items2.length){ renderResults(items2); return; }
      setSearchStatus('검색 결과가 없습니다');
    });
  });
}

function searchByJsonp(q, category, cb){
  const cbName = 'vwcb_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
  const script = document.createElement('script');
  const timer = setTimeout(function(){ cleanup(); cb([]); }, 6000);

  function cleanup(){
    clearTimeout(timer);
    delete window[cbName];
    if(script.parentNode) script.parentNode.removeChild(script);
  }

  window[cbName] = function(data){
    cleanup();
    cb(data?.response?.result?.items || []);
  };
  script.onerror = function(){ cleanup(); cb([]); };
  script.src = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0`
    + `&crs=EPSG:4326&size=10&page=1`
    + `&query=${encodeURIComponent(q)}`
    + `&type=address&category=${category}`
    + `&format=json&errorformat=json`
    + `&callback=${cbName}&key=${VWORLD_KEY}`;
  document.body.appendChild(script);
}

function renderResults(items){
  setSearchStatus(`${items.length}건 검색됨`, 'green');
  const list = $('search-result-list');
  list.innerHTML = items.map(item => {
    const parcel = item.address?.parcel || item.title || '';
    const road   = item.address?.road || '';
    const lng = parseFloat(item.point?.x || 0);
    const lat = parseFloat(item.point?.y || 0);
    return `<div class="search-result-item" onclick="selectResult('${parcel.replace(/'/g,"\\'")}','${road.replace(/'/g,"\\'")}',${lng},${lat})">
      <div class="addr-main">${parcel || road}</div>
      ${road && parcel ? `<div class="addr-sub">${road}</div>` : ''}
    </div>`;
  }).join('');
  $('search-results').style.display = 'block';
}

function selectResult(parcel, road, lng, lat){
  $('search-results').style.display = 'none';
  $('selected-location').style.display = 'block';
  $('selected-addr-parcel').textContent = parcel || road;
  $('selected-addr-road').textContent = (road && parcel) ? road : '';
  setSearchStatus('');
  state.searchMarker = {addr: parcel||road, lng, lat};

  if(!vMap){ initVMap(); setTimeout(()=>moveMapTo(lng,lat), 600); return; }
  moveMapTo(lng, lat);
}

function moveMapTo(lng, lat){
  if(!vMap) return;
  const center = ol.proj.fromLonLat([lng, lat]);
  vMap.getView().animate({ center, zoom: 20, duration: 600 });
  setTimeout(loadCadastralWFS, 700);

  // 마커 갱신
  if(vMarker?.source){
    vMarker.source.clear();
    const feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lng, lat]))
    });
    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 8,
        fill: new ol.style.Fill({ color: '#2563eb' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 })
      })
    }));
    vMarker.source.addFeature(feature);
  }
}

function clearSearch(){
  state.searchMarker = null;
  $('selected-location').style.display = 'none';
  setSearchStatus('');
  if(vMarker?.source) vMarker.source.clear();
}

// ── 필지 클릭 → WFS JSONP로 속성 조회 ──
// ── 필지 클릭 → WMS GetFeatureInfo JSONP ──
// 기본 다중 선택 (Ctrl 불필요 — 재클릭 시 해제)
function toggleLot(pnu, addr, area, olGeom){
  if(selectedLots.has(pnu)){
    // 재클릭 → 선택 해제
    selectedLots.delete(pnu);
    if(window._lotSource){
      const ex = window._lotSource.getFeatures().find(f => f.get('pnu') === pnu);
      if(ex) window._lotSource.removeFeature(ex);
    }
  } else {
    // 신규 선택 (다중 누적)
    selectedLots.set(pnu, {pnu, addr, area});
    if(window._lotSource && olGeom){
      const feat = new ol.Feature({ geometry: olGeom });
      feat.set('pnu', pnu);
      window._lotSource.addFeature(feat);
    }
  }
  updateSelectedLots();
  setSearchStatus('');
}

function updateSelectedLots(){
  const lots = [...selectedLots.values()];
  const total = lots.reduce((s, l) => s + (l.area || 0), 0);
  const wrap = $('selected-lots');
  if(!lots.length){
    wrap.innerHTML = '<div class="info-box" style="text-align:center;color:var(--text3);">지도에서 필지를 클릭하세요</div>';
    $('lots-summary').style.display = 'none';
    return;
  }
  wrap.innerHTML = lots.map(l =>
    `<div class="search-result-item" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <span style="flex:1;font-size:10px;line-height:1.4;">${l.addr}</span>
      <span style="font-weight:700;color:var(--accent);white-space:nowrap;">${l.area ? l.area.toFixed(2)+' m²' : '조회 중…'}</span>
      <button onclick="removeLot('${l.pnu}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;flex-shrink:0;">✕</button>
    </div>`
  ).join('');
  state.siteArea = total;
  $('total-site-area').textContent = total.toFixed(2) + ' m²';
  $('lots-summary').style.display = 'block';
}

function removeLot(pnu){
  selectedLots.delete(pnu);
  if(window._lotSource){
    const ex = window._lotSource.getFeatures().find(f => f.get('pnu') === pnu);
    if(ex) window._lotSource.removeFeature(ex);
  }
  updateSelectedLots();
}

function setSearchStatus(msg, type=''){
  const el = $('search-status');
  el.textContent = msg;
  el.style.color = type==='green' ? 'var(--green)' : type==='red' ? 'var(--red)' : 'var(--text3)';
}



function createProject(){
  if(!selectedLots.size){
    showToast('필지를 선택해 주세요'); return;
  }
  // state에 대지 정보 저장 후 다음 단계로
  state.lots = [...selectedLots.values()];
  state.siteAddr = state.searchMarker?.addr || state.lots[0]?.addr || '';
  goStep(2);
}

