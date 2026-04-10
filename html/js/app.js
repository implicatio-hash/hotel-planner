// Hotel Planner — App Init
window.addEventListener('DOMContentLoaded',()=>{
  buildZoneTable();
  initVMap();
  setTimeout(()=>{ loadSetbackLayer(); }, 500);
});
