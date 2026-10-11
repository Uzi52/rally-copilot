/* Autos vectoriales originales, estilizados y dibujados desde arriba.
   No son recursos oficiales de fabricantes. */
'use strict';
const RALLY_CARS = [
  {id:'lancer',brand:'Mitsubishi',model:'Lancer 2008',type:'sedan',label:'Lancer',wing:true},
  {id:'gol',brand:'Volkswagen',model:'Gol Trend',type:'hatch',label:'Gol',wing:false},
  {id:'golf',brand:'Volkswagen',model:'Golf',type:'sport',label:'Golf',wing:true},
  {id:'uno',brand:'Fiat',model:'Uno',type:'box',label:'Uno',wing:false},
  {id:'cronos',brand:'Fiat',model:'Cronos',type:'sedan',label:'Cronos',wing:false}
];
const RALLY_COLORS = [
  {name:'Gris plata',value:'#9ba8b9'},
  {name:'Rojo',value:'#d93642'},
  {name:'Azul',value:'#2879d3'},
  {name:'Blanco',value:'#e9eef2'},
  {name:'Negro',value:'#2b3442'},
  {name:'Amarillo',value:'#f4c430'},
  {name:'Violeta oscuro',value:'#512f78'}
];
function shade(hex,percent){
  const n=parseInt(hex.replace('#',''),16);
  const p=Math.max(-1,Math.min(1,percent));
  return '#'+[16,8,0].map(s=>{
    let v=(n>>s)&255;
    v=Math.round(p>=0?v+(255-v)*p:v*(1+p));
    return Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0');
  }).join('');
}
function rallyCarSVG(id='lancer',color='#9ba8b9'){
  const car=RALLY_CARS.find(x=>x.id===id)||RALLY_CARS[0];
  if(!/^#[\da-fA-F]{6}$/.test(color))color=RALLY_COLORS[0].value;
  const cfg={
    sedan:{body:'M26 9 Q40 5 54 9 L67 24 Q71 37 70 54 L69 107 Q68 131 58 140 Q40 146 22 140 Q12 131 11 107 L10 54 Q9 36 13 24 Z',roofTop:42,roofBottom:105,front:14,back:139},
    hatch:{body:'M24 13 Q40 7 56 13 L68 27 Q70 38 69 54 L68 112 Q66 129 60 136 Q40 143 20 136 Q14 129 12 112 L11 54 Q10 38 12 27 Z',roofTop:42,roofBottom:117,front:16,back:138},
    sport:{body:'M23 12 Q40 6 57 12 L69 25 L70 51 L69 113 Q67 131 59 138 Q40 145 21 138 Q13 131 11 113 L10 51 L11 25 Z',roofTop:39,roofBottom:118,front:15,back:139},
    box:{body:'M17 18 Q40 14 63 18 L69 26 L69 128 L63 138 L17 138 L11 128 L11 26 Z',roofTop:40,roofBottom:120,front:20,back:140}
  }[car.type];
  const roofTop=cfg.roofTop,roofBottom=cfg.roofBottom;
  const cabinWindow=(car.type==='box')?'M19 47 L61 47 L63 61 L17 61 Z':`M20 ${roofTop+5} Q40 ${roofTop-1} 60 ${roofTop+5} L63 ${roofTop+20} L17 ${roofTop+20} Z`;
  const rearWindow=(car.type==='sedan')?`M19 ${roofBottom-16} L61 ${roofBottom-16} L58 ${roofBottom-1} Q40 ${roofBottom+4} 22 ${roofBottom-1} Z`:`M19 ${roofBottom-18} L61 ${roofBottom-18} L63 ${roofBottom-1} L17 ${roofBottom-1} Z`;
  const spoiler=car.wing?`<rect x="13" y="130" width="54" height="5" rx="2.5" fill="#16202d" stroke="#e9eef9" stroke-opacity=".48" stroke-width="1.2"/><path d="M17 129 L17 124 M63 129 L63 124" stroke="#1a2231" stroke-width="3"/>`:'';
  const sedanHood=car.type==='sedan'?'<path d="M17 36 Q40 30 63 36" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>':'';
  const hatchRear=car.type!=='sedan'?'<path d="M16 125 Q40 130 64 125" fill="none" stroke="#151c26" stroke-opacity=".48" stroke-width="2"/>':'';
  const special=car.id==='lancer' ? '<path d="M21 27 L33 29 M59 27 L47 29" stroke="#151d2b" stroke-width="2"/>' : car.id==='golf' ? '<path d="M18 27 L62 27" stroke="#c1343c" stroke-width="3"/><path d="M27 78 L53 78" stroke="#202d3e" opacity=".42" stroke-width="2"/>' : car.id==='uno' ? '<path d="M15 32 L65 32 M15 126 L65 126" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>' : car.id==='gol' ? '<path d="M20 29 L60 29" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>' : '';
  const frontGrill=car.id==='lancer'?'<path d="M29 15 L51 15 L47 24 L33 24 Z" fill="#19212e"/><path d="M30 19 L50 19" stroke="#c1cbd9" opacity=".7"/>':'<rect x="29" y="17" width="22" height="5" rx="2" fill="#202b3a"/>';
  const highlights=shade(color,.25),shadow=shade(color,-.35);
  const gid=`paint-${car.id}-${color.slice(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 152" role="img" aria-label="${car.brand} ${car.model} visto desde arriba">
    <defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="${shadow}"/><stop offset=".22" stop-color="${color}"/><stop offset=".50" stop-color="${highlights}"/><stop offset=".78" stop-color="${color}"/><stop offset="1" stop-color="${shadow}"/></linearGradient><linearGradient id="glass" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#273949"/><stop offset=".48" stop-color="#7394ac"/><stop offset="1" stop-color="#1d2d40"/></linearGradient></defs>
    <ellipse cx="40" cy="79" rx="37" ry="73" fill="#000" opacity=".15"/>
    <rect x="5" y="31" width="10" height="26" rx="4" fill="#141a23"/><rect x="65" y="31" width="10" height="26" rx="4" fill="#141a23"/>
    <rect x="5" y="103" width="10" height="25" rx="4" fill="#141a23"/><rect x="65" y="103" width="10" height="25" rx="4" fill="#141a23"/>
    <path d="${cfg.body}" fill="url(#${gid})" stroke="#141c28" stroke-width="1.8"/>
    <path d="M15 29 L6 30 L4 40 L13 39 M65 29 L74 30 L76 40 L67 39" fill="${shadow}" stroke="#192230" stroke-width="1.8"/>
    <path d="M19 30 L30 24 L29 17 L19 20 Z M61 30 L50 24 L51 17 L61 20 Z" fill="#f4f7d5" stroke="#1b2532" stroke-width="1"/>
    ${frontGrill}${sedanHood}${special}
    <path d="M20 ${roofTop+2} Q40 ${roofTop-4} 60 ${roofTop+2} L65 ${roofBottom-6} Q40 ${roofBottom+4} 15 ${roofBottom-6} Z" fill="${shade(color,-.16)}" stroke="#ffffff" stroke-opacity=".22" stroke-width="1.5"/>
    <path d="${cabinWindow}" fill="url(#glass)" stroke="#131e2b" stroke-width="1.6"/>
    <path d="M17 ${roofTop+26} L22 ${roofBottom-24} L58 ${roofBottom-24} L63 ${roofTop+26} Z" fill="${highlights}" opacity=".93" stroke="#243241" stroke-width="1.6"/>
    <path d="M20 ${roofTop+29} L23 ${roofBottom-29} M60 ${roofTop+29} L57 ${roofBottom-29}" stroke="#ffffff" stroke-opacity=".42" stroke-width="1.5"/>
    <path d="${rearWindow}" fill="url(#glass)" stroke="#1b2838" stroke-width="1.5"/>
    <path d="M19 ${roofTop+25} L17 ${roofBottom-22} M61 ${roofTop+25} L63 ${roofBottom-22}" stroke="#172337" stroke-width="2"/>
    ${hatchRear}
    <path d="M15 131 L28 135 L29 141 L15 138 Z M65 131 L52 135 L51 141 L65 138 Z" fill="#d34247" stroke="#321d25" stroke-width="1"/>
    <path d="M29 140 L51 140" stroke="#161b24" stroke-width="2"/>
    ${spoiler}
  </svg>`;
}
