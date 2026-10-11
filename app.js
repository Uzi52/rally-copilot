/* Rally Copilot V2 — navegación experimental + vehículos 2D.
   Leaflet, OpenStreetMap, OSRM demo, búsqueda Nominatim bajo demanda.
   Las notas de curvas NO son instrucciones de velocidad segura. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if (!window.L || typeof RALLY_CARS === 'undefined' || typeof rallyCarSVG !== 'function') {
    $('status').textContent = 'Error: no cargaron las bibliotecas. Revisá la conexión.';
    return;
  }
  const $status = $('status');
  const DEFAULTS = { car:'lancer', color:'#9ba8b9', lead:'200', navZoom:'16', voice:true };
  let settings = {...DEFAULTS};
  try {
    const stored = JSON.parse(localStorage.getItem('rally-v2-settings') || '{}');
    settings = {...settings, ...stored};
  } catch (_) { /* Safari puede bloquear almacenamiento en algunos modos. */ }
  if (!RALLY_CARS.some(c => c.id === settings.car)) settings.car = DEFAULTS.car;
  if (!RALLY_COLORS.some(c => c.value === settings.color)) settings.color = DEFAULTS.color;
  if (!['100','200','300','500'].includes(String(settings.lead))) settings.lead = DEFAULTS.lead;
  if (!['15','16','17'].includes(String(settings.navZoom))) settings.navZoom = DEFAULTS.navZoom;
  settings.voice = settings.voice !== false;
  $('lead').value = settings.lead;
  $('navZoom').value = settings.navZoom;
  $('voice').checked = settings.voice;

  function saveSettings(){
    settings.lead = $('lead').value;
    settings.navZoom = $('navZoom').value;
    settings.voice = $('voice').checked;
    try { localStorage.setItem('rally-v2-settings',JSON.stringify(settings)); } catch (_) {}
  }
  ['lead','navZoom','voice'].forEach(id => $(id).addEventListener('change',()=>{
    saveSettings();
    if (id === 'navZoom' && navigating && here) followCamera(true);
  }));

  const map = L.map('map', {zoomControl:false, preferCanvas:true}).setView([-26.83,-65.20],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const routeStroke = {color:'#202a36',weight:10,opacity:.8,lineJoin:'round'};
  const routePaint = {color:'#ffd13b',weight:6,opacity:.98,lineJoin:'round'};
  let routeBorder = null, routeLine = null, destinationMarker = null;
  let here = null, prevFix = null, gpsWatchId = null, carMarker = null;
  let heading = 0, navigating = false, follow = true, picking = false;
  let destination = null, activeRoute = null;
  let progress = 0, lastSeg = -1, spoken = new Set(), lastAnnouncement = -1;
  let geocodeController = null, selectingRoute = false;

  function setStatus(s, active = gpsWatchId !== null){
    $status.textContent = s;
    $('liveDot').classList.toggle('active',!!active);
  }
  function setHint(s){ $('hint').textContent = s; }
  function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function shortName(full){
    const text = String(full || 'Destino').split(',')[0].trim();
    return text.slice(0,45) || 'Destino';
  }
  const rad=Math.PI/180;
  function meters(a,b){
    const dLat=(b[0]-a[0])*rad, dLon=(b[1]-a[1])*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function bearing(a,b){
    const d=(b[1]-a[1])*rad;
    return (Math.atan2(Math.sin(d)*Math.cos(b[0]*rad),Math.cos(a[0]*rad)*Math.sin(b[0]*rad)-Math.sin(a[0]*rad)*Math.cos(b[0]*rad)*Math.cos(d))/rad+360)%360;
  }
  function angle(a,b,c){return (bearing(b,c)-bearing(a,b)+540)%360-180;}
  function formatMeters(n){return n>=1000?`${(n/1000).toFixed(1).replace('.',',')} km`:`${Math.round(n/10)*10} m`;}
  function currentCar(){return RALLY_CARS.find(c=>c.id===settings.car)||RALLY_CARS[0];}
  function carIcon(){
    return L.divIcon({className:'car-leaflet-icon',html:`<div class="car-rotator" style="--heading:${heading}deg">${rallyCarSVG(settings.car,settings.color)}</div>`,iconSize:[47,86],iconAnchor:[23.5,43]});
  }
  function refreshCar(){
    $('miniCar').innerHTML=rallyCarSVG(settings.car,settings.color);
    $('miniCarLabel').textContent=currentCar().label;
    if(carMarker)carMarker.setIcon(carIcon());
  }
  refreshCar();

  function followCamera(instant=false){
    if(!here || !follow) return;
    const zoom=navigating?Number($('navZoom').value):Math.max(map.getZoom(),15);
    if(!navigating){map.setView(here,zoom,{animate:!instant});return;}
    // Centrar el mapa por delante del auto, dejando el marcador hacia abajo.
    // La vista permanece orientada al norte: Leaflet no tiene inclinación 3D nativa.
    const px=map.project(L.latLng(here),zoom);
    // El auto debe verse POR ENCIMA del panel inferior, no quedar tapado.
    const screenH=map.getSize().y;
    const panelTop=document.querySelector('.dashboard').getBoundingClientRect().top;
    const targetY=Math.max(180,Math.min(screenH*.72,panelTop-64));
    const offset=targetY-screenH/2;
    const center=map.unproject(px.subtract(L.point(0,offset)),zoom);
    map.setView(center,zoom,{animate:!instant,duration:.30});
  }
  map.on('dragstart',()=>{ if(navigating){follow=false;setHint('Seguimiento en pausa. Tocá ◎ para recentrar.');} });
  $('recenter').addEventListener('click',()=>{
    if(!here){setHint('Primero activá el GPS.');return;}
    follow=true;followCamera(true);
  });

  function speak(message,testing=false){
    if(!('speechSynthesis' in window)){
      if(testing)alert('Este navegador no admite voz de síntesis.');
      return;
    }
    if(!testing&&!$('voice').checked)return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(message);
      u.lang='es-AR';u.rate=.98;u.pitch=1;u.volume=1;
      const voices=speechSynthesis.getVoices();
      const preferred=voices.find(v=>v.lang.toLowerCase()==='es-ar')||voices.find(v=>v.lang.toLowerCase().startsWith('es'));
      if(preferred)u.voice=preferred;
      speechSynthesis.speak(u);
    }catch(e){if(testing)setHint('No se pudo reproducir la voz: '+e.message);}
  }
  $('testVoice').addEventListener('click',()=>speak('Copiloto listo. En doscientos metros, derecha cuatro.',true));

  function updateButtons(){
    $('gpsBtn').hidden=gpsWatchId!==null;
    $('navigateBtn').hidden=!activeRoute||navigating;
    $('stopBtn').hidden=gpsWatchId===null&&!activeRoute;
    $('destinationInfo').hidden=!activeRoute;
    $('navBanner').hidden=!navigating;
    document.body.classList.toggle('navigating',navigating);
    $('searchArea').hidden=navigating;
  }
  function startGPS(){
    if(gpsWatchId!==null)return;
    if(!navigator.geolocation){setStatus('GPS no disponible',false);return;}
    setStatus('Buscando GPS…',false);
    gpsWatchId=navigator.geolocation.watchPosition(onLocation, err=>{
      const messages={1:'Permiso de ubicación denegado',2:'Ubicación no disponible',3:'GPS sin respuesta'};
      setStatus(messages[err.code]||'Error GPS',false);
      if(err.code===1){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;updateButtons();}
    },{enableHighAccuracy:true,maximumAge:1000,timeout:20000});
    updateButtons();
  }
  $('gpsBtn').addEventListener('click',startGPS);

  function onLocation(p){
    if(!Number.isFinite(p.coords.latitude)||!Number.isFinite(p.coords.longitude))return;
    const pos=[p.coords.latitude,p.coords.longitude];
    const speed=Number.isFinite(p.coords.speed)?Math.max(0,p.coords.speed):null;
    if(Number.isFinite(p.coords.heading)&&speed!==null&&speed>1.1){heading=p.coords.heading;}
    else if(prevFix && meters(prevFix,pos)>12){heading=bearing(prevFix,pos);}
    here=pos;
    prevFix=pos;
    $('speed').textContent=speed===null?'--':String(Math.round(speed*3.6));
    setStatus(`GPS ±${Math.round(p.coords.accuracy||0)} m`,true);
    if(!carMarker){carMarker=L.marker(here,{icon:carIcon(),zIndexOffset:900}).addTo(map);followCamera(true);}
    else{
      carMarker.setLatLng(here);
      const el=carMarker.getElement()?.querySelector('.car-rotator');
      if(el)el.style.setProperty('--heading',heading+'deg');
    }
    if(navigating)followCamera();
    updateCurve();
  }

  function clearRoute(){
    if(routeLine){map.removeLayer(routeLine);routeLine=null;}
    if(routeBorder){map.removeLayer(routeBorder);routeBorder=null;}
    if(destinationMarker){map.removeLayer(destinationMarker);destinationMarker=null;}
    destination=null;activeRoute=null;progress=0;lastSeg=-1;
    spoken.clear();lastAnnouncement=-1;
    $('call').textContent='Sin ruta preparada';
    $('distance').textContent='Buscá un destino para empezar';
    $('navCall').textContent='Esperando ruta';
    $('navDistance').textContent='—';
    $('searchResults').hidden=true;
    updateButtons();
  }
  function stop(){
    navigating=false;follow=true;picking=false;selectingRoute=false;
    clearRoute();
    if(gpsWatchId!==null)navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId=null;
    if('speechSynthesis' in window)speechSynthesis.cancel();
    setStatus('GPS detenido',false);
    setHint('Navegación detenida. Podés iniciar otra ruta.');
    $('speed').textContent='--';
    updateButtons();
  }
  $('stopBtn').addEventListener('click',stop);

  function analyzeRoute(points){
    const distances=[0],turns=[];
    for(let i=1;i<points.length;i++)distances[i]=distances[i-1]+meters(points[i-1],points[i]);
    // Clasificación visual y de voz aproximada por geometría del mapa.
    for(let i=1;i<points.length-1;i++){
      let prev=i-1,next=i+1;
      while(prev>0&&meters(points[prev],points[i])<28)prev--;
      while(next<points.length-1&&meters(points[next],points[i])<28)next++;
      if(prev===i||next===i)continue;
      const a=angle(points[prev],points[i],points[next]);
      const span=Math.min(meters(points[prev],points[i]),meters(points[i],points[next]));
      if(Math.abs(a)<18||span<10)continue;
      const severity=Math.abs(a)/Math.max(18,span);
      const grade=severity>2.8?1:severity>1.9?2:severity>1.25?3:severity>.8?4:severity>.45?5:6;
      const last=turns[turns.length-1];
      if(last&&distances[i]-last.at<75){
        if(Math.abs(a)>Math.abs(last.angle))turns[turns.length-1]={i,at:distances[i],angle:a,grade};
      }else turns.push({i,at:distances[i],angle:a,grade});
    }
    return {points,distances,turns,length:distances[distances.length-1]||0};
  }
  function routeProgress(pos){
    if(!activeRoute)return null;
    const pts=activeRoute.points, sums=activeRoute.distances;
    function scan(from,to){
      let best={distance:Infinity,progress:0,segment:0};
      const factor=Math.cos(pos[0]*rad);
      for(let i=from;i<to;i++){
        const a=pts[i],b=pts[i+1];
        const ax=(a[1]-pos[1])*111320*factor,ay=(a[0]-pos[0])*111132;
        const bx=(b[1]-pos[1])*111320*factor,by=(b[0]-pos[0])*111132;
        const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy;
        const t=den>0?Math.max(0,Math.min(1,-(ax*vx+ay*vy)/den)):0;
        const dx=ax+t*vx,dy=ay+t*vy,d=dx*dx+dy*dy;
        if(d<best.distance)best={distance:d,progress:sums[i]+t*(sums[i+1]-sums[i]),segment:i};
      }
      return best;
    }
    let best=lastSeg<0?scan(0,pts.length-1):scan(Math.max(0,lastSeg-30),Math.min(pts.length-1,lastSeg+400));
    if(best.distance>140*140)best=scan(0,pts.length-1);
    return {...best,distance:Math.sqrt(best.distance)};
  }
  function updateCurve(){
    if(!here||!activeRoute)return;
    const onRoute=routeProgress(here);
    if(!onRoute)return;
    if(onRoute.distance>115){
      $('call').textContent='Fuera de la ruta';
      $('distance').textContent='Volvé al recorrido o elegí otro destino';
      $('navCall').textContent='Fuera de ruta';
      $('navDistance').textContent='Recalculá manualmente';
      return;
    }
    lastSeg=onRoute.segment;
    progress=Math.max(progress,onRoute.progress-15);
    const next=activeRoute.turns.find(t=>t.at>=progress-20);
    if(!next){
      $('call').textContent='Sin curvas próximas';
      $('distance').textContent=`Restan ${formatMeters(activeRoute.length-progress)}`;
      $('navCall').textContent='Seguí la ruta';
      $('navDistance').textContent=`${formatMeters(activeRoute.length-progress)} al destino`;
      if(navigating&&activeRoute.length-progress<35){
        $('navCall').textContent='Llegaste al destino';
        $('navDistance').textContent='Fin de la navegación';
      }
      return;
    }
    const left=next.angle<0, direction=left?'Izquierda':'Derecha';
    const dist=Math.max(0,next.at-progress);
    const call=`${direction} ${next.grade}`;
    $('call').textContent=call;
    $('distance').textContent=`En ${formatMeters(dist)} · estimación geométrica`;
    $('navCall').textContent=call;
    $('navDistance').textContent=`En ${formatMeters(dist)}`;
    $('navSymbol').textContent=left?'↶':'↷';
    if(navigating && dist<=Number($('lead').value) && !spoken.has(next.i)){
      const rounded=Math.max(0,Math.round(dist/10)*10);
      spoken.add(next.i);
      lastAnnouncement=next.i;
      speak(`En ${rounded} metros, ${direction.toLowerCase()} ${next.grade}`);
    }
  }

  async function calculateRoute(lat,lng,name){
    if(!here){startGPS();setHint('Activá el GPS y esperá tu ubicación antes de preparar una ruta.');setStatus('Esperando ubicación…',false);return;}
    if(selectingRoute)return;
    selectingRoute=true;
    picking=false;
    setStatus('Calculando ruta…',true);
    setHint('Calculando el camino por carretera…');
    try{
      const url=`https://router.project-osrm.org/route/v1/driving/${here[1]},${here[0]};${lng},${lat}?overview=full&geometries=geojson`;
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),18000);
      let response;
      try{response=await fetch(url,{signal:ctrl.signal});}finally{clearTimeout(timer);}
      if(!response.ok)throw Error('El servicio de rutas no respondió. Intentá de nuevo.');
      const json=await response.json();
      if(json.code!=='Ok'||!json.routes?.length)throw Error('No se encontró una ruta por carretera.');
      const route=json.routes[0];
      const points=route.geometry.coordinates.map(p=>[p[1],p[0]]);
      if(points.length<2)throw Error('La ruta no contiene puntos suficientes.');
      clearRoute();
      destination={lat,lng,name:shortName(name)};
      activeRoute=analyzeRoute(points);
      routeBorder=L.polyline(points,routeStroke).addTo(map);
      routeLine=L.polyline(points,routePaint).addTo(map);
      destinationMarker=L.circleMarker([lat,lng],{radius:9,color:'#fff',weight:3,fillColor:'#ec595f',fillOpacity:1}).addTo(map).bindPopup(escapeText(name));
      $('destinationName').textContent=destination.name;
      $('routeKm').textContent=(route.distance/1000).toFixed(1).replace('.',',')+' km';
      $('routeTime').textContent=Math.max(1,Math.round(route.duration/60))+' min';
      setStatus('Ruta preparada',true);
      setHint('Ruta lista: tocá «Iniciar ruta» para activar el seguimiento automático.');
      map.fitBounds(routeLine.getBounds(),{paddingTopLeft:[28,175],paddingBottomRight:[28,255],maxZoom:16});
      updateCurve();
      updateButtons();
    }catch(e){
      const message=e.name==='AbortError'?'El cálculo demoró demasiado. Volvé a intentar.':e.message;
      setStatus('Error de ruta',true);
      setHint(message);
    }finally{selectingRoute=false;}
  }
  $('navigateBtn').addEventListener('click',()=>{
    if(!activeRoute){setHint('Primero prepará un recorrido.');return;}
    if(!here){startGPS();setHint('Esperando GPS antes de navegar.');return;}
    navigating=true;follow=true;spoken.clear();progress=0;lastSeg=-1;
    setStatus('Navegando · GPS activo',true);
    followCamera(true);
    updateButtons();
    updateCurve();
  });
  $('pickMap').addEventListener('click',()=>{
    if(!here){startGPS();setHint('Esperá que el GPS encuentre tu ubicación.');return;}
    picking=!picking;
    $('pickMap').textContent=picking?'✕ Cancelar elección':'📍 Elegir en el mapa';
    setHint(picking?'Tocá cualquier punto del mapa para poner el destino.':'Selección cancelada.');
    $('searchResults').hidden=true;
  });
  map.on('click',e=>{
    if(!picking||navigating)return;
    picking=false;
    $('pickMap').textContent='📍 Elegir en el mapa';
    void calculateRoute(e.latlng.lat,e.latlng.lng,'Punto elegido en el mapa');
  });

  // Nominatim: búsqueda manual, una consulta por pulsación, sin autocompletado.
  $('searchForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const query=$('searchInput').value.trim();
    if(query.length<3){setHint('Escribí al menos tres letras para buscar.');return;}
    if(geocodeController)geocodeController.abort();
    geocodeController=new AbortController();
    $('searchResults').hidden=false;
    $('searchResults').innerHTML='<p>Buscando lugares…</p>';
    $('searchBtn').disabled=true;
    try{
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=es&q='+encodeURIComponent(query);
      const res=await fetch(url,{signal:geocodeController.signal,headers:{'Accept':'application/json'}});
      if(!res.ok)throw Error('La búsqueda no está disponible ahora.');
      const items=await res.json();
      if(!Array.isArray(items)||!items.length){$('searchResults').innerHTML='<p>No se encontraron lugares. Probá con más detalles.</p>';return;}
      $('searchResults').innerHTML='';
      for(const item of items){
        const lat=Number(item.lat),lng=Number(item.lon);
        if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
        const button=document.createElement('button');
        button.type='button';button.textContent='📍 '+item.display_name;
        button.addEventListener('click',()=>{
          $('searchInput').value=shortName(item.display_name);
          $('searchResults').hidden=true;
          void calculateRoute(lat,lng,item.display_name);
        });
        $('searchResults').appendChild(button);
      }
    }catch(error){
      if(error.name!=='AbortError')$('searchResults').innerHTML='<p>'+escapeText(error.message)+'</p>';
    }finally{$('searchBtn').disabled=false;}
  });

  let draftCar=settings.car,draftColor=settings.color;
  function renderGarage(){
    $('garageGrid').innerHTML='';
    for(const c of RALLY_CARS){
      const b=document.createElement('button');
      b.type='button';b.className='garage-card'+(draftCar===c.id?' active':'');
      b.setAttribute('aria-pressed',String(draftCar===c.id));
      b.innerHTML=`${rallyCarSVG(c.id,draftColor)}<strong>${c.model}</strong><span>${c.brand}</span>`;
      b.addEventListener('click',()=>{draftCar=c.id;renderGarage();});
      $('garageGrid').appendChild(b);
    }
    $('colors').innerHTML='';
    for(const c of RALLY_COLORS){
      const b=document.createElement('button');
      b.type='button';b.className='swatch'+(draftColor===c.value?' active':'');
      b.style.setProperty('--swatch',c.value);
      b.title=c.name;b.setAttribute('aria-label',c.name);
      b.setAttribute('aria-pressed',String(draftColor===c.value));
      b.addEventListener('click',()=>{draftColor=c.value;renderGarage();});
      $('colors').appendChild(b);
    }
  }
  function openGarage(){
    draftCar=settings.car;draftColor=settings.color;renderGarage();
    if(typeof $('garage').showModal==='function')$('garage').showModal();
    else $('garage').setAttribute('open','');
  }
  function closeGarage(){if(typeof $('garage').close==='function')$('garage').close();else $('garage').removeAttribute('open');}
  $('openGarage').addEventListener('click',openGarage);
  $('selectedCarBtn').addEventListener('click',openGarage);
  $('closeGarage').addEventListener('click',closeGarage);
  $('saveGarage').addEventListener('click',()=>{
    settings.car=draftCar;settings.color=draftColor;saveSettings();refreshCar();closeGarage();
    setHint('Vehículo guardado: '+currentCar().brand+' '+currentCar().model+'.');
  });
  $('garage').addEventListener('click',e=>{if(e.target===$('garage'))closeGarage();});

  updateButtons();
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
})();
