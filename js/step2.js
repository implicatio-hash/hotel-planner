// STEP 2 — 대지 정보
// ═══════════════════════════════════════════
const ZONE_PRESETS = [
  {label:'1종일반',bcr:60,far:200},{label:'2종일반',bcr:60,far:250},{label:'3종일반',bcr:50,far:300},
  {label:'준주거',bcr:70,far:500},{label:'일반상업',bcr:60,far:800},{label:'중심상업',bcr:70,far:1300},
  {label:'근린상업',bcr:70,far:600},{label:'준공업',bcr:70,far:400},
];

function applyZonePreset(){
  const z=$('zone-type').value;
  const p=ZONE_PRESETS.find(p=>p.label===z);
  if(p){ $('bcr').value=p.bcr; $('far').value=p.far; }
}

function buildZoneTable(){
  const tbody=$('zone-table-body');
  if(!tbody) return;
  tbody.innerHTML=ZONE_PRESETS.map(z=>`
    <tr style="font-size:12px;">
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);">${z.label}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);text-align:center;">${z.bcr}%</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);text-align:center;">${z.far}%</td>
    </tr>`).join('');
}

// Step 1 진입 시 대지면적 연동
function syncStep1(){
  const area = state.siteArea || 0;
  const el = $('site-area');
  if(el) el.value = area.toFixed(2);
}

// 선택 필지 외곽선 그리기 (ol.Map 벡터 기반)
function drawLotOutline(){
  const features = window._lotSource ? window._lotSource.getFeatures() : [];
  if(!features.length) return;

  const fmt = new ol.format.GeoJSON();

  // Turf.js Union (미세 갭 극복: 0.5m 팽창 후 union, 다시 축소)
  let merged = null;
  try {
    // 좌표를 소수점 6자리로 스냅 → 인접 필지 공유점 일치 → buffer 없이 깔끔한 union
    function snapCoords(geom, precision){
      const p = Math.pow(10, precision);
      function snapRing(ring){ return ring.map(pt => [Math.round(pt[0]*p)/p, Math.round(pt[1]*p)/p]); }
      if(geom.type==='Polygon') return {...geom, coordinates: geom.coordinates.map(snapRing)};
      if(geom.type==='MultiPolygon') return {...geom, coordinates: geom.coordinates.map(poly=>poly.map(snapRing))};
      return geom;
    }
    const geojsons = features.map(f => {
      const clone = f.getGeometry().clone();
      clone.transform('EPSG:3857','EPSG:4326');
      const geom = snapCoords(JSON.parse(fmt.writeGeometry(clone)), 6);
      return { type:'Feature', geometry: geom };
    });
    merged = geojsons.reduce((acc, cur) => turf.union(acc, cur));
  } catch(e){ console.warn('turf union:', e); }

  // step1Map 초기화 (최초 1회)
  if(!window._step1Map){
    const outlineSource = new ol.source.Vector();
    window._step1OutlineSource = outlineSource;
    // 2페이지 지적도 벡터 레이어 (WFS — 회색 선만, 1페이지와 공유 또는 별도 로드)
    const s1CadSource = new ol.source.Vector();
    window._step1CadSource = s1CadSource;
    const s1CadLayer = new ol.layer.Vector({
      source: s1CadSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#9ca3af', width: 0.8 })
      })
    });

    window._step1Map = new ol.Map({
      target: 'step1-map',
      layers: [
        s1CadLayer,
        new ol.layer.Vector({
          source: outlineSource,
          style: function(feature){
            const t = feature.get('type');
            if(t === 'boundary') return new ol.style.Style({
              stroke: new ol.style.Stroke({ color: '#e74c3c', width: 2.5 })
            });
            if(t === 'setback') return new ol.style.Style({
              stroke: new ol.style.Stroke({ color: '#e67e22', width: 1.5, lineDash: [8,5] })
            });
            if(t === 'buildable') return new ol.style.Style({
              fill: new ol.style.Fill({ color: 'rgba(234,88,12,0.15)' }),
              stroke: new ol.style.Stroke({ color: '#e67e22', width: 1.5, lineDash: [8,5] })
            });
            if(t === 'under-offset') return new ol.style.Style({
              fill: new ol.style.Fill({ color: 'rgba(37,99,235,0.15)' }),
              stroke: new ol.style.Stroke({ color: '#2563eb', width: 1.5, lineDash: [8,5] })
            });
          }
        })
      ],
      view: new ol.View({ center: ol.proj.fromLonLat([126.978, 37.566]), zoom: 17 }),
      controls: []
    });
  }

  window._step1Map.updateSize();
  const outlineSource = window._step1OutlineSource;
  outlineSource.clear();

  if(merged){
    // merged 폴리곤 저장 (지하 offset, 건축한계선 모두 재사용)
    window._step1MergedPoly = merged;
    window._step1LotArea = turf.area(merged);

    const boundaryGeom = fmt.readGeometry(merged.geometry);
    boundaryGeom.transform('EPSG:4326','EPSG:3857');
    const bf = new ol.Feature({ geometry: boundaryGeom });
    bf.set('type','boundary');
    outlineSource.addFeature(bf);
    // ※ 건축한계선·지하offset은 버튼 클릭 시에만 표시
  } else {
    features.forEach(f => { const c = f.clone(); c.set('type','boundary'); outlineSource.addFeature(c); });
  }

  // 뷰 맞춤 + 지적도 WFS 로드
  const ext = outlineSource.getExtent();
  if(ext && ext[0] !== Infinity){
    window._step1Map.getView().fit(ext, { padding:[60,60,60,60], maxZoom:19, duration:300 });
    setTimeout(loadStep1CadWFS, 400);
  }
}

// 2페이지 지적도 WFS 로드
let _s1CadLoading = false;
function loadStep1CadWFS(){
  if(!window._step1Map || _s1CadLoading) return;
  _s1CadLoading = true;
  const view = window._step1Map.getView();
  const size = window._step1Map.getSize();
  if(!size) { _s1CadLoading=false; return; }
  const ext = view.calculateExtent(size);
  const [minLng,minLat,maxLng,maxLat] = ol.proj.transformExtent(ext,'EPSG:3857','EPSG:4326');
  const cbName = 's1cad_' + Date.now();
  const script = document.createElement('script');
  const timer = setTimeout(()=>{ _s1CadLoading=false; cleanup(); }, 10000);
  function cleanup(){ clearTimeout(timer); delete window[cbName]; if(script.parentNode) script.parentNode.removeChild(script); }
  window[cbName] = function(data){
    _s1CadLoading=false; cleanup();
    const feats = data && data.features || [];
    if(!feats.length) return;
    const fmt = new ol.format.GeoJSON();
    const src = window._step1CadSource;
    if(!src) return;
    const existing = new Set(src.getFeatures().map(f=>f.get('pnu')));
    feats.forEach(f=>{
      const pnu = f.properties?.pnu;
      if(pnu && existing.has(pnu)) return;
      try {
        const olF = fmt.readFeature(f,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
        olF.set('pnu', pnu);
        src.addFeature(olF);
      }catch(e){}
    });
  };
  script.onerror = ()=>{ _s1CadLoading=false; cleanup(); };
  script.src = `https://api.vworld.kr/req/wfs?service=WFS&version=1.1.0&request=GetFeature`
    +`&typename=lp_pa_cbnd_bubun&bbox=${minLat},${minLng},${maxLat},${maxLng},EPSG:4326`
    +`&srsname=EPSG:4326&maxfeatures=300`
    +`&output=text/javascript&format_options=callback:${cbName}&key=${VWORLD_KEY}`;
  document.body.appendChild(script);
}

// SHP에서 선택 필지 내부 건축한계선만 clip해서 표시
function addSetbackFromSHP(mergedGeoJSON, outlineSource){
  if(!_shpLoaded || !_shpGeoJSONs.length) return;
  const fmt = new ol.format.GeoJSON();
  const mBbox = turf.bbox(mergedGeoJSON);
  let clippedCount = 0;

  _shpGeoJSONs.forEach(shpGJ => {
    try {
      // 1차: bbox 필터 (넉넉하게)
      const sBbox = turf.bbox(shpGJ);
      if(sBbox[2] < mBbox[0] || sBbox[0] > mBbox[2] ||
         sBbox[3] < mBbox[1] || sBbox[1] > mBbox[3]) return;

      const coords = shpGJ.geometry.type === 'MultiLineString'
        ? shpGJ.geometry.coordinates
        : [shpGJ.geometry.coordinates];

      coords.forEach(line => {
        // 각 선분(segment)을 개별 처리
        // 점이 내부이거나, 선분이 폴리곤과 교차하는 경우 모두 포함
        let currentSeg = [];

        for(let i = 0; i < line.length; i++){
          const ptIn = turf.booleanPointInPolygon(turf.point(line[i]), mergedGeoJSON);

          if(ptIn){
            // 점이 내부 — 현재 segment에 추가
            if(currentSeg.length === 0 && i > 0){
              // 이전 점이 외부였지만 선분이 폴리곤 경계를 지나 들어온 경우
              // 교차점 계산해서 시작점으로 추가
              const seg = turf.lineString([line[i-1], line[i]]);
              const xpts = turf.lineIntersect(seg, mergedGeoJSON);
              if(xpts.features.length > 0){
                currentSeg.push(xpts.features[0].geometry.coordinates);
              }
            }
            currentSeg.push(line[i]);
          } else {
            // 점이 외부
            if(currentSeg.length > 0){
              // 내부에서 외부로 나가는 경우 — 교차점 추가 후 segment 저장
              const seg = turf.lineString([line[i-1], line[i]]);
              const xpts = turf.lineIntersect(seg, mergedGeoJSON);
              if(xpts.features.length > 0){
                currentSeg.push(xpts.features[0].geometry.coordinates);
              }
              if(currentSeg.length >= 2){
                const olGeom = fmt.readGeometry({ type:'LineString', coordinates: currentSeg });
                olGeom.transform('EPSG:4326','EPSG:3857');
                const sf = new ol.Feature({ geometry: olGeom });
                sf.set('type','setback');
                outlineSource.addFeature(sf);
                clippedCount++;
              }
              currentSeg = [];
            } else if(i > 0){
              // 양 끝점 모두 외부지만 선분이 폴리곤을 관통하는 경우
              const seg = turf.lineString([line[i-1], line[i]]);
              const xpts = turf.lineIntersect(seg, mergedGeoJSON);
              if(xpts.features.length >= 2){
                // 두 교차점 사이가 폴리곤 내부 구간
                const pts = xpts.features.map(f => f.geometry.coordinates);
                const olGeom = fmt.readGeometry({ type:'LineString', coordinates: pts });
                olGeom.transform('EPSG:4326','EPSG:3857');
                const sf = new ol.Feature({ geometry: olGeom });
                sf.set('type','setback');
                outlineSource.addFeature(sf);
                clippedCount++;
              }
            }
          }
        }
        // 마지막 segment 처리
        if(currentSeg.length >= 2){
          const olGeom = fmt.readGeometry({ type:'LineString', coordinates: currentSeg });
          olGeom.transform('EPSG:4326','EPSG:3857');
          const sf = new ol.Feature({ geometry: olGeom });
          sf.set('type','setback');
          outlineSource.addFeature(sf);
          clippedCount++;
        }
      });
    } catch(e){}
  });
  if(clippedCount > 0) console.log('건축한계선 clip 완료:', clippedCount, '개');
}



// 각진 내측 오프셋: 각 변을 법선 방향으로 dist만큼 안쪽으로 평행이동 후 교점 연결
// 각진 내측 오프셋: EPSG:3857(미터 단위)에서 buffer 후 WGS84 역변환
function sharpInsetPolygon(poly, distM){
  try {
    proj4.defs('EPSG:3857','+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs');
    const toMeter = proj4('EPSG:4326', 'EPSG:3857');
    const toLonLat = proj4('EPSG:3857', 'EPSG:4326');

    // WGS84 → EPSG:3857 변환
    const ring = poly.geometry.coordinates[0];
    const ring3857 = ring.map(pt => toMeter.forward(pt));
    const n = ring3857.length - 1;

    // shoelace 공식으로 면적 부호 계산 → CCW면 양수
    let area2 = 0;
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      area2 += ring3857[i][0]*ring3857[j][1] - ring3857[j][0]*ring3857[i][1];
    }
    // CCW(area2>0): 내측은 각 변의 왼쪽 → (-dy,dx) 방향에 +1
    // CW(area2<0):  내측은 각 변의 오른쪽 → (-dy,dx) 방향에 -1
    const sign = area2 > 0 ? 1 : -1;

    // 각 변을 distM만큼 내측 평행이동
    function offsetEdge(p1, p2){
      const dx=p2[0]-p1[0], dy=p2[1]-p1[1];
      const len=Math.sqrt(dx*dx+dy*dy);
      if(len<1e-6) return null;
      const ox=(-dy/len)*distM*sign;
      const oy=( dx/len)*distM*sign;
      return [[p1[0]+ox,p1[1]+oy],[p2[0]+ox,p2[1]+oy]];
    }

    const edges=[];
    for(let i=0;i<n;i++){
      const e=offsetEdge(ring3857[i],ring3857[(i+1)%n]);
      if(e) edges.push(e);
    }

    // 인접 변 교점 계산
    function intersectLines(a1,a2,b1,b2){
      const dx1=a2[0]-a1[0],dy1=a2[1]-a1[1];
      const dx2=b2[0]-b1[0],dy2=b2[1]-b1[1];
      const denom=dx1*dy2-dy1*dx2;
      if(Math.abs(denom)<1e-10) return [(a2[0]+b1[0])/2,(a2[1]+b1[1])/2];
      const t=((b1[0]-a1[0])*dy2-(b1[1]-a1[1])*dx2)/denom;
      return [a1[0]+t*dx1,a1[1]+t*dy1];
    }

    const newCoords3857=[];
    for(let i=0;i<edges.length;i++){
      const prev=edges[(i-1+edges.length)%edges.length];
      const curr=edges[i];
      newCoords3857.push(intersectLines(prev[0],prev[1],curr[0],curr[1]));
    }
    newCoords3857.push(newCoords3857[0]);

    // EPSG:3857 → WGS84 역변환
    const newCoordsWGS84=newCoords3857.map(pt=>toLonLat.forward(pt));
    const result = turf.polygon([newCoordsWGS84]);

    // 오목 꼭짓점의 외측 이탈 방지: 원본 폴리곤으로 클리핑
    try {
      const clipped = turf.intersect(result, poly);
      if(clipped) return clipped;
    } catch(e){ /* intersect 실패 시 클리핑 없이 반환 */ }

    return result;
  } catch(e){
    console.warn('sharpInsetPolygon 오류, fallback:', e);
    return turf.buffer(poly, -distM, {units:'meters'});
  }
}

function testBuildableArea(){
  if(!_shpLoaded || !_shpGeoJSONs.length){ showToast('건축한계선 SHP 미로드'); return; }
  const lotFeatures = window._lotSource?.getFeatures();
  if(!lotFeatures?.length){ showToast('필지를 먼저 선택해주세요'); return; }

  const fmt = new ol.format.GeoJSON();

  try {
    // 1. 선택 필지 merge
    const geojsons = lotFeatures.map(f => {
      const clone = f.getGeometry().clone();
      clone.transform('EPSG:3857','EPSG:4326');
      return { type:'Feature', geometry: JSON.parse(fmt.writeGeometry(clone)) };
    });
    const merged = geojsons.reduce((acc,cur) => turf.union(acc,cur));
    console.log('1. 필지 merge 완료');

    // 2. 0.5m 내측 오프셋
    const insetPoly = sharpInsetPolygon(merged, 0.5);
    if(!insetPoly){ showToast('오프셋 생성 실패'); return; }
    console.log('2. 오프셋 폴리곤 생성 완료');

    // 3. bbox 근처 원본 건축한계선 추출
    const mBbox = turf.bbox(merged);
    const nearby = _shpGeoJSONs.filter(f => {
      const b = turf.bbox(f);
      return !(b[2]<mBbox[0]||b[0]>mBbox[2]||b[3]<mBbox[1]||b[1]>mBbox[3]);
    });
    const allLines = [];
    nearby.forEach(f => f.geometry.coordinates.forEach(line => allLines.push([...line])));
    console.log('3. 원본 건축한계선 선분 수:', allLines.length);

    // 4. 필지와 교차하는 선분만 필터링 (booleanIntersects)
    const filteredLines = allLines.filter(line => {
      try {
        return turf.booleanIntersects(turf.lineString(line), merged);
      } catch(e){ return false; }
    });
    console.log('4. 필터링된 선분 수:', filteredLines.length);

    const outlineSource = window._step1OutlineSource;
    outlineSource.getFeatures().filter(f=>f.get('type')==='buildable').forEach(f=>outlineSource.removeFeature(f));

    // 5. 건축한계선 없음 → 오프셋 전체가 건축가능영역
    if(!filteredLines.length){
      console.log('5. 건축한계선 없음 → 오프셋 전체 표시');
      const olGeom = fmt.readGeometry(insetPoly.geometry, {dataProjection:'EPSG:4326', featureProjection:'EPSG:3857'});
      const bf = new ol.Feature({geometry: olGeom});
      bf.set('type','buildable');
      outlineSource.addFeature(bf);
      showToast(`⚠️ 건축한계선 없음 → 오프셋 전체 ${turf.area(insetPoly).toFixed(1)}m²`);
      return;
    }

    // 6. 건축한계선 점들로 concave hull 생성
    const allCoords = filteredLines.reduce((acc, line) => [...acc, ...line], []);
    const points = turf.featureCollection(allCoords.map(c => turf.point(c)));
    console.log('6. 총 점 수:', allCoords.length);

    const setbackHull = turf.concave(points, {maxEdge: 0.1, units:'kilometers'});
    if(!setbackHull){
      console.log('6. concave hull 실패 → 오프셋 전체 표시');
      const olGeom = fmt.readGeometry(insetPoly.geometry, {dataProjection:'EPSG:4326', featureProjection:'EPSG:3857'});
      const bf = new ol.Feature({geometry: olGeom});
      bf.set('type','buildable');
      outlineSource.addFeature(bf);
      showToast('⚠️ concave hull 실패 → 오프셋 전체 표시');
      return;
    }
    console.log('6. concave hull 면적:', turf.area(setbackHull).toFixed(1)+'m²');

    // 7. setbackHull ∩ insetPoly ∩ merged → 건축가능영역
    const step1 = turf.intersect(setbackHull, merged);   // 필지 경계 안으로 clip
    const result = step1 ? turf.intersect(step1, insetPoly) : null;  // 0.5m 오프셋 적용
    const final = result || insetPoly;
    const area = turf.area(final);
    console.log('7. 최종 건축가능영역 면적:', area.toFixed(1)+'m²');

    const olGeom = fmt.readGeometry(final.geometry, {dataProjection:'EPSG:4326', featureProjection:'EPSG:3857'});
    const bf = new ol.Feature({geometry: olGeom});
    bf.set('type','buildable');
    outlineSource.addFeature(bf);

    // 좌측 패널 건축가능 대지면적 표시
    const baDisp = $('buildable-area-disp');
    const baGroup = $('buildable-area-group');
    if(baDisp){ baDisp.value = area.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
    if(baGroup){ baGroup.style.display = 'block'; }
    state.buildableArea = area;
    showToast(`✅ 건축가능영역 ${area.toFixed(1)}m²`);

  } catch(e){ console.error('testBuildableArea 오류:', e); showToast('오류 발생'); }
}

// ── 2페이지: 건축한계선 토글 ──
// 현재 표시 모드: null | 'setback' | 'under'
let _step1ViewMode = null;

function toggleSetbackView(){
  if(_step1ViewMode === 'setback'){
    // 이미 건축한계선 표시 중 → 끄기
    _step1ViewMode = null;
    const src = window._step1OutlineSource;
    if(src) src.getFeatures().filter(f=>f.get('type')==='buildable'||f.get('type')==='setback').forEach(f=>src.removeFeature(f));
    $('legend-setback').style.display = 'none';
    return;
  }
  // 지하층 뷰 먼저 초기화
  clearUnderView();
  _step1ViewMode = 'setback';
  $('legend-setback').style.display = 'inline';
  loadSetbackLayer().then(()=>{ setTimeout(testBuildableArea, 400); });
}

function toggleUnderView(){
  if(_step1ViewMode === 'under'){
    clearUnderView();
    return;
  }
  // 건축한계선 뷰 먼저 초기화
  const src = window._step1OutlineSource;
  if(src) src.getFeatures().filter(f=>f.get('type')==='buildable'||f.get('type')==='setback').forEach(f=>src.removeFeature(f));
  $('legend-setback').style.display = 'none';

  _step1ViewMode = 'under';
  $('legend-under').style.display = 'inline';
  applyUnderSetback();
}

function clearUnderView(){
  _step1ViewMode = null;
  const src = window._step1OutlineSource;
  if(src) src.getFeatures().filter(f=>f.get('type')==='under-offset').forEach(f=>src.removeFeature(f));
  $('legend-under').style.display = 'none';
}

// ── 지하층 이격거리 offset (2페이지용) ──
function clampUnderSetback(el){
  let v = parseFloat(el.value);
  if(isNaN(v)) return;
  if(v < 0) v = 0;
  if(v > 3) v = 3;
  el.value = v.toFixed(2);
}

function applyUnderSetback(){
  const merged = window._step1MergedPoly;
  if(!merged){ showToast('필지 데이터가 없습니다'); return; }

  const distEl = $('under-setback');
  let dist = parseFloat(distEl?.value);
  if(isNaN(dist)||dist<0) dist=0;
  if(dist>3) dist=3;
  if(distEl) distEl.value = dist.toFixed(2);

  const src = window._step1OutlineSource;
  if(src) src.getFeatures().filter(f=>f.get('type')==='under-offset').forEach(f=>src.removeFeature(f));

  let offsetArea;
  const lotArea = window._step1LotArea || turf.area(merged);

  if(dist === 0){
    offsetArea = lotArea;
  } else {
    const inset = sharpInsetPolygon(merged, dist);
    if(!inset){ showToast('offset 계산 실패'); return; }
    offsetArea = turf.area(inset);
    if(src){
      const fmt = new ol.format.GeoJSON();
      const olGeom = fmt.readGeometry(inset.geometry,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
      const of_ = new ol.Feature({geometry: olGeom});
      of_.set('type','under-offset');
      src.addFeature(of_);
    }
  }

  const fmt2 = (v,d=2) => v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
  $('under-design-area-disp').value = fmt2(offsetArea);
  $('under-area-group').style.display = 'block';
  state.underDesignArea = offsetArea;
}

// ── 3페이지 규모 설정 적용 ──
function applyVolumeSettings(){
  state.maxHeight = parseFloat($('max-height')?.value) || 90;
  const sa = state.siteArea || parseFloat($('site-area')?.value) || 0;
  const bcr = n('bcr'), far_ = n('far');
  state.bcr = bcr; state.far = far_;
  const mc = sa * bcr / 100;
  const mg = sa * far_ / 100;
  state.maxCoverage = mc; state.maxGFA = mg;
  $('max-coverage').textContent = mc.toFixed(2);
  $('max-gfa').textContent = mg.toFixed(2);
  $('volume-result').style.display = 'block';
  // 다이어그램 재구성
  if(S2.floors.length === 0 || true) buildFloors();
  renderDiagram();
}

function calcSiteInfo(){
  // 하위 호환 유지 (다른 곳에서 호출될 수 있으므로)
  applyVolumeSettings();
}
