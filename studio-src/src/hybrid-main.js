import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { configureTextureImages } from './materials.js';
import { CATALOG, FOLDS } from './tl-catalog.js';
import { DANA_SMS, smsHref } from './dana.js';
import { SWATCH } from './swatch-map.js';
const swatchURL=(f,c)=>SWATCH[f+'|'+c]?`url(${new URL('swatches/'+SWATCH[f+'|'+c]+'.webp',document.baseURI).href})`:/Reed/.test(f)?'url(https://images.unsplash.com/photo-1765366600893-f540fe17288d?w=300&h=200&fit=crop&auto=format&q=70)':'none';
import { createMechanism } from './shade-mechanisms.js';
import { createRoomInstallation, fitShadeCanvas } from './room-installation.js';
import { roomResponse } from './room-response.js';
import { prepareClothLighting } from './cloth-lighting.js';
import { ROOMS } from './room-catalog.js';
import { createRoomPlateRenderer } from './room-plate-renderer.js';

const $=id=>document.getElementById(id),cap=s=>s[0].toUpperCase()+s.slice(1),W=1536,H=1024;
const state={room:'living-room',style:'roman',family:'Raw Linen',colorName:'Flax',fold:'flat',fabric:'linen',color:'flax',drop:.65,openness:1,opacity:'filtering',mood:'afternoon',lamp:false,ceiling:false,ceilingBrightness:.75,inspect:false,playing:false};
let roomPlate,ceilingLight,roomRequest=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
state.breeze=!reduced;
let renderer,scene,camera,roomCamera,inspectCamera,controls,mechanism,installation,key,fill,ambient,environment,frame=0,last=0,actualDrop=.65,actualOpen=1,playTime=0,zoom=1,pan={x:0,y:0},drag=null;
const descriptions={roller:'Clean, simple, rolls up tight',roman:'Soft folds, tailored look',zebra:'Sheer + solid bands you can align'};
const FOLD_SHORT={flat:'Stacks into neat folds',hobbled:'Folds even when lowered',relaxed:'Gentle curve at the hem'};
const fam=()=>CATALOG[state.style].families.find(f=>f.name===state.family)||CATALOG[state.style].families[0];
const col=()=>fam().colors.find(c=>c.name===state.colorName)||fam().colors[0];
const hex=()=>col().hex;
const foldsApply=()=>state.style==='roman'&&!fam().weave;
const price=()=>CATALOG[state.style].price+fam().up+(foldsApply()?FOLDS[state.fold].up:0)+(state.style==='roman'&&!fam().weave&&!fam().blackout&&state.opacity==='blackout'?20:0);
function syncFamily(reset){const f=fam();state.family=f.name;state.fabric=f.weave?'reed':/Stripe/.test(f.name)?'stripe':f.tex;if(!f.colors.some(c=>c.name===state.colorName))state.colorName=f.colors[0].name;
 if(reset||state.style!=='roman'||f.weave||f.blackout)state.opacity=f.blackout?'blackout':'filtering';}
function renderOptions(){
 for(const k of['roller','roman','zebra'])$('from-'+k).textContent='from $'+CATALOG[k].price;
 $('families').innerHTML=CATALOG[state.style].families.map(f=>`<div class="card tex-${f.tex}${f.weave?' tex-reed':''}" data-card="${f.name}" aria-current="${f.name===state.family}">
  ${(()=>{const cc=f.name===state.family?(f.colors.find(c=>c.name===state.colorName)||f.colors[0]):f.colors[0];return `<button class="card-face" data-family="${f.name}" style="--c:${cc.hex};--img:${swatchURL(f.name,cc.name)}">`;})()}<span class="card-name">${f.name}</span><span class="card-meta">${f.blackout?'Blackout':f.weave?'Woven wood':'Light filtering'}${f.up?` · +$${f.up}`:''}</span></button>
  <div class="dots">${f.colors.map(c=>`<button data-pick="${f.name}|${c.name}" aria-label="${f.name} in ${c.name}" title="${c.name}" aria-pressed="${f.name===state.family&&c.name===state.colorName}" style="--swatch:${c.hex};--img:${swatchURL(f.name,c.name)}"></button>`).join('')}</div></div>`).join('');
 $('folds').innerHTML=Object.entries(FOLDS).map(([k,f])=>`<button data-fold="${k}" aria-pressed="${k===state.fold}">${f.label}${f.up?` <small>+$${f.up}</small>`:''}</button>`).join('');
}
const loadImage=name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve([name,i]);i.onerror=()=>reject(new Error('Missing '+name+' texture'));i.src=new URL('textures/'+name+'-web.webp',document.baseURI).href;});
function refresh(){
 $('ceiling-toggle').setAttribute('aria-pressed',String(state.ceiling));$('ceiling-toggle').textContent='Ceiling';
 $('ceiling-brightness').disabled=!state.ceiling;$('ceiling-value').textContent=Math.round(state.ceilingBrightness*100)+'%';
 document.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===state.room)));
 for(const key of['style','mood','opacity','fold'])document.querySelectorAll('[data-'+key+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===state[key])));
 document.querySelectorAll('[data-card]').forEach(c=>{const on=c.dataset.card===state.family;c.setAttribute('aria-current',String(on));if(on){const cf=c.querySelector('.card-face');cf.style.setProperty('--c',hex());cf.style.setProperty('--img',swatchURL(state.family,state.colorName));}});document.querySelectorAll('[data-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pick===state.family+'|'+state.colorName)));
 $('fabric-name').textContent=state.family+' · '+state.colorName;$('fold-set').hidden=state.style!=='roman';$('fold-set').classList.toggle('locked',!foldsApply());$('fold-name').textContent=FOLDS[state.fold].label;$('fold-note').textContent=foldsApply()?FOLD_SHORT[state.fold]:'Woven wood comes in a classic flat fold';
 $('price').textContent=$('sticky-price').textContent='$'+price();
 $('drop-value').textContent=Math.round(state.drop*100)+'% down';const band=mechanism?.state.bandAlignment??state.openness;if(state.style==='zebra'&&document.activeElement!==$('alignment'))$('alignment').value=band*100;$('alignment-value').textContent=band>.8?'Sheer':band<.2?'Privacy':'Partly open';
 $('zebra-controls').hidden=state.style!=='zebra';$('opacity-options').hidden=!(state.style==='roman'&&!fam().weave&&!fam().blackout);
 $('mechanism-description').textContent=descriptions[state.style];$('selection').textContent=summary();
 $('lamp-toggle').textContent='Lamp';$('lamp-toggle').setAttribute('aria-pressed',String(state.lamp));$('lamp-hotspot').setAttribute('aria-label',state.lamp?'Turn lamp off':'Turn lamp on');$('lamp-hotspot').setAttribute('aria-pressed',String(state.lamp));$('ceiling-hotspot').setAttribute('aria-pressed',String(state.ceiling));$('ceiling-hotspot').setAttribute('aria-label',state.ceiling?'Turn ceiling light off':'Turn ceiling light on');
 $('inspect-toggle').textContent=state.inspect?'Back to room':'3D';$('inspect-toggle').setAttribute('aria-pressed',String(state.inspect));
 $('play').textContent=state.playing?'Ⅱ Pause movement':'▷ Watch it move';$('play').setAttribute('aria-pressed',String(state.playing));
 $('outside-toggle').textContent=state.breeze?'Outdoor breeze on · Pause':'Outdoor breeze paused · Play';$('outside-toggle').setAttribute('aria-pressed',String(state.breeze));
}
function positionModel(){
 mechanism.root.position.set(0,0,0);mechanism.root.scale.setScalar(1);mechanism.root.rotation.set(0,0,0);
}
function rebuild(){
 if(mechanism){scene.remove(mechanism.root);mechanism.dispose();}
 mechanism=createMechanism({style:state.style,fabric:state.fabric,fold:foldsApply()?state.fold:'flat',color:hex(),width:1.66,height:1.30});
 mechanism.update({drop:actualDrop,openness:actualOpen});scene.add(mechanism.root);positionModel();lighting();
}
function lighting(){
 if(!mechanism)return;
 const even=state.mood==='evening',afternoon=state.mood==='afternoon',alignment=mechanism.state.bandAlignment??1;
 const response=roomResponse({...state,color:hex(),coverage:mechanism.state.actualDrop,alignment});
 if(state.style==='zebra')$('alignment-value').textContent=alignment>.8?'Sheer':alignment<.2?'Privacy':'Partly open';
 roomPlate?.update(state,response);
 ceilingLight.intensity=state.ceiling?state.ceilingBrightness*5.5:0;
 scene.environmentIntensity=response.environment;
 ambient.intensity=response.ambient;key.intensity=response.bounce;fill.intensity=response.lampIntensity;
 ambient.color.set(even?'#b7c8e9':'#f6eee0');ambient.groundColor.set(even?'#50566d':'#b8b2a7');
 key.color.set(even?'#b7c9ee':afternoon?'#fff0dc':'#e4ecf4');
 $('inspect-stage').style.background=even?'radial-gradient(ellipse at 40% 35%,#454951,#20252d)':'radial-gradient(ellipse at 40% 35%,#fbf7ef,#e6dccb)';
 key.position.set(-1.5,2.5,3.5);key.target.position.set(0,-.6,0);
 // Lamp sits to the left and below the window head, in front of the fabric.
 // A point source gives a warm left-to-right falloff, not a uniform yellow fill.
 fill.position.set(-1.9,-.60,1.05);
 key.shadow.camera.left=-1.15;key.shadow.camera.right=1.15;key.shadow.camera.top=1.15;key.shadow.camera.bottom=-1.15;key.shadow.camera.near=.05;key.shadow.camera.far=15;key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.0015;
 const mats=new Set();mechanism.root.traverse(o=>{if(o.material&&/textile|fabric|Sewn_hems/.test(o.material.name))mats.add(o.material);});
 for(const m of mats){
  m.emissive.copy(m.color).lerp(new THREE.Color('#fff2df'),.12);m.emissiveMap=m.map;m.emissiveIntensity=response.backscatter;
  if(m.name==='Sewn_hems'){m.emissiveIntensity*=.18;continue;}
  if(state.style!=='zebra'){
   prepareClothLighting(m,installation.lightField);
   m.roughness=.98;m.sheen=.28;m.normalScale?.set(state.fabric==='reed'?.9:state.fabric==='stripe'?.5:.36,state.fabric==='reed'?.9:state.fabric==='stripe'?.5:.36);
   const transparent=response.clothOpacity<1;
   if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
   m.opacity=response.clothOpacity;m.depthWrite=!transparent;
  }
 }
 $('viewport').dataset.daylight=response.daylight.toFixed(4);
}
function size(){
 zoom=Math.min(zoom,Math.max(1,1536/$('viewport').clientWidth));
 fitShadeCanvas($('shade-canvas'),$('viewport'));
 const host=state.inspect?$('inspect-stage'):$('shade-canvas'),width=host.clientWidth,height=host.clientHeight;
 if(!renderer||!width||!height)return;renderer.setPixelRatio(Math.min(devicePixelRatio*(state.inspect?1:zoom),6));renderer.setSize(width,height,false);inspectCamera.aspect=width/height;inspectCamera.updateProjectionMatrix();
}
function showInspect(value){
 state.inspect=value;$('viewport').classList.toggle('inspecting',value);$('inspect-stage').hidden=!value;$('inspect-caption').hidden=!value;
 $('zoom-in').disabled=false;
 (value?$('inspect-stage'):$('shade-canvas')).append(renderer.domElement);camera=value?inspectCamera:roomCamera;controls.enabled=value;
 if(value){inspectCamera.position.set(1.55,.05,2.9);controls.target.set(0,-.56,0);controls.update();}positionModel();lighting();size();refresh();renderZoom();
 $('scene-hint').textContent=value?'Turn the window to check the top-jamb mount and clearance from the glass.':'Try the lamp. Change the light. Make it yours.';
}
function renderZoom(){
 const maxX=(zoom-1)*$('viewport').clientWidth/2,maxY=(zoom-1)*$('viewport').clientHeight/2;
 pan.x=THREE.MathUtils.clamp(pan.x,-maxX,maxX);pan.y=THREE.MathUtils.clamp(pan.y,-maxY,maxY);
 $('composition').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;$('composition').style.setProperty('--z',zoom);$('viewport').classList.toggle('zoomed',zoom>1.01);$('zoom-value').value=state.inspect?'3D':Math.round(zoom*100)+'%';
 $('zoom-in').disabled=!state.inspect&&zoom>=Math.max(2.5,Math.min(3.5,1536/$('viewport').clientWidth));
}
function setZoom(next){
 // Do not magnify the fixed room beyond the source image's native CSS resolution.
 const maxZoom=Math.max(2.5,Math.min(3.5,1536/$('viewport').clientWidth));
 zoom=THREE.MathUtils.clamp(next,1,maxZoom);if(zoom===1)pan={x:0,y:0};renderZoom();size();
 $('zoom-in').disabled=zoom>=maxZoom;
 $('zoom-in').title=zoom>=maxZoom?'Room image detail limit — explore the shade in 3D for a closer view':'Zoom in';
 $('scene-hint').textContent=zoom>=maxZoom?'Room image detail limit. Explore the shade in 3D to get closer.':'Try the lamp. Change the light. Make it yours.';
}
function frameLoop(now){
 const dt=Math.min(.04,(now-last)/1000||.016);last=now;
 if(state.playing){playTime+=dt;state.drop=.5-.48*Math.cos(playTime*.95);$('drop').value=state.drop*100;$('drop-value').textContent=Math.round(state.drop*100)+'% down';}
 actualDrop=state.drop;actualOpen=state.openness;
 if(Math.abs(actualDrop-mechanism.state.drop)>.00001||Math.abs(actualOpen-mechanism.state.openness)>.00001){mechanism.update({drop:actualDrop,openness:actualOpen,time:now/1000});lighting();}
 installation.update({...state,time:now/1000});placeHandle();if(state.inspect)controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(frameLoop);
}
function summary(){const st=CATALOG[state.style].label.toLowerCase(),fold=foldsApply()&&state.fold!=='flat'?FOLDS[state.fold].label.toLowerCase()+' ':'';return `${fold}${state.family} ${st} in ${state.colorName}`+(state.style==='roman'&&!fam().weave&&!fam().blackout&&state.opacity==='blackout'?' with room-darkening lining':'');}
function lookURL(){const q=new URLSearchParams({room:state.room,s:state.style,f:state.family,c:state.colorName});if(foldsApply())q.set('r',state.fold);if(state.opacity==='blackout'&&state.style==='roman')q.set('l','dark');return location.origin+location.pathname+'?'+q;}
let ref='';try{ref=new URLSearchParams(location.search).get('ref')||sessionStorage.getItem('tl-ref')||'';if(!/^[\w.-]{1,30}$/.test(ref))ref='';if(ref)sessionStorage.setItem('tl-ref',ref);}catch{}
function textDana(kind){
 const room=ROOMS.find(r=>r.id===state.room).label.toLowerCase(),tag=ref?` (via ${ref})`:'';
 if(kind==='self'){location.href=smsHref('',`My Tailored Light design for the ${room}: ${summary()}, $${price()}/window. ${lookURL()}`);return;}
 const body=kind==='kit'?`Hi Dana! Can I get the $9 swatch kit? I'm leaning toward ${summary()} for my ${room}. ${lookURL()}`:`Hi Dana! Here's my design for my ${room}: ${summary()} ($${price()}/window). Can you help me measure? ${lookURL()}`;
 location.href=smsHref(DANA_SMS,body+tag);
}
document.querySelectorAll('[data-text]').forEach(b=>b.addEventListener('click',()=>textDana(b.dataset.text)));
{const q=new URLSearchParams(location.search);
 if(CATALOG[q.get('s')])state.style=q.get('s');
 if(CATALOG[state.style].families.some(f=>f.name===q.get('f')))state.family=q.get('f');else if(q.get('s'))state.family=CATALOG[state.style].families[0].name;
 if(q.get('c'))state.colorName=q.get('c');if(FOLDS[q.get('r')])state.fold=q.get('r');if(q.get('l')==='dark')state.opacity='blackout';
 if(ROOMS.some(r=>r.id===q.get('room')))state.room=q.get('room');
 syncFamily();renderOptions();}
try{
 configureTextureImages(Object.fromEntries(await Promise.all(['linen'].map(loadImage))));
 scene=new THREE.Scene();renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 $('shade-canvas').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Moving three-dimensional shade');
 roomPlate=createRoomPlateRenderer($('room-plate'));
 const startRoom=ROOMS.find(r=>r.id===state.room);const firstTexture=await roomPlate.load(startRoom);
 installation=await createRoomInstallation(firstTexture);scene.add(installation.group);roomCamera=installation.camera;camera=roomCamera;
 inspectCamera=new THREE.PerspectiveCamera(39,1,.01,40);controls=new OrbitControls(inspectCamera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=1.4;controls.maxDistance=5;controls.enabled=false;
 const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;pmrem.dispose();
 ambient=new THREE.HemisphereLight('#fff2d9','#8f7659',.85);scene.add(ambient);
 key=new THREE.DirectionalLight('#ffe6bf',2.8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00003;scene.add(key,key.target);
 fill=new THREE.PointLight('#ffe3be',5.8,0,2);fill.castShadow=true;fill.shadow.mapSize.set(1024,1024);fill.shadow.camera.near=.1;fill.shadow.camera.far=8;fill.shadow.normalBias=.01;fill.shadow.bias=-.0004;scene.add(fill);
 ceilingLight=new THREE.PointLight('#fff0d8',0,0,2);ceilingLight.position.set(0,.75,1.1);scene.add(ceilingLight);
 rebuild();const ro=new ResizeObserver(()=>{size();renderZoom();});ro.observe($('viewport'));size();refresh();setRoomHotspot(startRoom);$('loading').remove();frame=requestAnimationFrame(frameLoop);
}catch(error){$('loading').textContent='The shade viewer could not load. Please refresh or try a current browser.';console.error(error);}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-style],[data-family],[data-pick],[data-fold],[data-mood],[data-opacity]');if(!b||!mechanism)return;
 const d=b.dataset;
 if(d.style){state.style=d.style;state.family=CATALOG[d.style].families[0].name;syncFamily(true);renderOptions();rebuild();}
 else if(d.family){const ch=d.family!==state.family;state.family=d.family;syncFamily(ch);renderOptions();rebuild();}
 else if(d.pick){const [f,c]=d.pick.split('|');const changed=f!==state.family;state.family=f;state.colorName=c;syncFamily(changed);if(changed){rebuild();}else mechanism.update({color:hex()});}
 else if(d.fold){state.fold=d.fold;rebuild();}
 else if(d.mood)state.mood=d.mood;
 else if(d.opacity)state.opacity=d.opacity;
 lighting();refresh();
});

$('drop').addEventListener('input',e=>{state.drop=Number(e.target.value)/100;state.playing=false;actualDrop=state.drop;mechanism.update({drop:actualDrop});lighting();refresh();});
$('alignment').addEventListener('input',e=>{state.openness=Number(e.target.value)/100;state.playing=false;actualDrop=state.drop;actualOpen=state.openness;mechanism.update({drop:actualDrop,openness:actualOpen,align:true});lighting();refresh();});
for(const id of['lamp-toggle','lamp-hotspot'])$(id).addEventListener('click',()=>{state.lamp=!state.lamp;engaged('lamp');lighting();refresh();});
$('outside-toggle').addEventListener('click',()=>{state.breeze=!state.breeze;refresh();});
for(const id of['ceiling-toggle','ceiling-hotspot'])$(id).addEventListener('click',()=>{state.ceiling=!state.ceiling;engaged('ceiling');lighting();refresh();});
$('ceiling-brightness').addEventListener('input',e=>{state.ceilingBrightness=Number(e.target.value)/100;lighting();refresh();});
function setRoomHotspot(room){
 const place=(el,x,y)=>{el.style.left=(x/1536*100)+'%';el.style.top=(y/1024*100)+'%';};place($('lamp-hotspot'),...room.lamp);place($('ceiling-hotspot'),room.fixture[0],room.fixture[1]);
 $('room-description').textContent=room.note;
}
requestAnimationFrame(()=>document.querySelector('.rooms [aria-pressed=true]')?.scrollIntoView({inline:'center',block:'nearest'}));
for(const room of ROOMS){
 const b=document.createElement('button');b.innerHTML=`<span class="thumb" style="background-image:url(rooms/frontal-v2/${room.id}.webp)"></span><span>${room.label}</span>`;b.dataset.room=room.id;b.setAttribute('aria-pressed',String(room.id===state.room));$('room-choices').append(b);
 b.addEventListener('click',async()=>{
  if(!roomPlate||!installation)return;
  const ticket=++roomRequest;$('room-status').textContent='Opening '+room.label.toLowerCase()+'…';$('viewport').setAttribute('aria-busy','true');
  try{
   const texture=await roomPlate.load(room);if(ticket!==roomRequest||!texture)return;
   installation.setExterior(texture);state.room=room.id;setRoomHotspot(room);lighting();refresh();$('room-status').textContent='';
  }catch(error){if(ticket===roomRequest)$('room-status').textContent='This room could not load. Tap its name to retry.';console.error(error);}
  finally{if(ticket===roomRequest)$('viewport').setAttribute('aria-busy','false');}
 });
}
$('inspect-toggle').addEventListener('click',()=>showInspect(!state.inspect));
$('play').addEventListener('click',()=>{state.playing=!state.playing;playTime=Math.acos(THREE.MathUtils.clamp((.5-state.drop)/.48,-1,1))/.95;refresh();});
function inspectZoom(factor){inspectCamera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}
$('zoom-in').addEventListener('click',()=>state.inspect?inspectZoom(.85):setZoom(zoom+.3));
$('zoom-out').addEventListener('click',()=>state.inspect?inspectZoom(1.15):setZoom(zoom-.3));
$('window-zoom').addEventListener('click',()=>{if(state.inspect)showInspect(false);setZoom(2.5);pan={x:0,y:.16*$('viewport').clientHeight*zoom};renderZoom();});
$('reset-view').addEventListener('click',()=>{if(state.inspect)showInspect(false);setZoom(1);});
const pointers=new Map();let pinchStart=null;
$('viewport').addEventListener('pointerdown',e=>{if(state.inspect||e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()];pinchStart=null&&{distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),zoom};}else if(zoom>1){drag={x:e.clientX,y:e.clientY,pan:{...pan}};$('viewport').setPointerCapture(e.pointerId);$('viewport').classList.add('dragging');}});
$('viewport').addEventListener('pointermove',e=>{if(state.inspect)return;if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchStart){const p=[...pointers.values()];setZoom(pinchStart.zoom*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/pinchStart.distance);}else if(drag){pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y};renderZoom();}});
for(const type of['pointerup','pointercancel'])$('viewport').addEventListener(type,e=>{pointers.delete(e.pointerId);drag=null;pinchStart=null;$('viewport').classList.remove('dragging');});
$('viewport').addEventListener('wheel',e=>{if(state.inspect)return;if(e.ctrlKey||zoom>1){e.preventDefault();setZoom(zoom-e.deltaY*.003);}},{passive:false});
$('viewport').addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')setZoom(zoom+.25);if(e.key==='-')setZoom(zoom-.25);if(e.key==='Escape'){if(state.inspect)showInspect(false);setZoom(1);}});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden&&mechanism){last=performance.now();frame=requestAnimationFrame(frameLoop);}});


/* ---------- Direct manipulation ---------- */
const OPEN={x0:504,x1:1040,y0:154,y1:535},SPAN=1.38;
const BOTTOM={roller:[.006,1.30],roman:[.15,1.30],zebra:[.063,1.30]};
function placeHandle(){if(!mechanism)return;const y=mechanism.state.bottomY??-1.3,my=OPEN.y0+(.07-y)/SPAN*(OPEN.y1-OPEN.y0);
 const h=$('shade-handle');h.style.top=(Math.min(my,OPEN.y1-6)/1024*100)+'%';h.style.left=((OPEN.x0+OPEN.x1)/2/1536*100)+'%';}
function setDropFromY(clientY){const r=$('composition').getBoundingClientRect(),my=(clientY-r.top)/r.height*1024;
 const bottom=(my-OPEN.y0)/(OPEN.y1-OPEN.y0)*SPAN-.07,[b0,b1]=BOTTOM[state.style];
 state.drop=THREE.MathUtils.clamp((bottom-b0)/(b1-b0),0,1);state.playing=false;$('drop').value=state.drop*100;refresh();}
{const grab=$('shade-grab'),handle=$('shade-handle');let active=null;
 grab.style.left=(OPEN.x0/1536*100)+'%';grab.style.top=(OPEN.y0/1024*100)+'%';grab.style.width=((OPEN.x1-OPEN.x0)/1536*100)+'%';grab.style.height=((OPEN.y1-OPEN.y0)/1024*100)+'%';
 for(const el of[grab,handle]){
  el.addEventListener('pointerdown',e=>{if(state.inspect||active!==null)return;e.preventDefault();e.stopPropagation();active=e.pointerId;el.setPointerCapture(e.pointerId);document.body.classList.add('dragging-shade');setDropFromY(e.clientY);engaged('drag');});
  el.addEventListener('pointermove',e=>{if(e.pointerId!==active)return;e.stopPropagation();setDropFromY(e.clientY);});
  for(const t of['pointerup','pointercancel'])el.addEventListener(t,e=>{if(e.pointerId!==active)return;e.stopPropagation();active=null;document.body.classList.remove('dragging-shade');});
 }
 handle.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();state.drop=THREE.MathUtils.clamp(state.drop+(e.key==='ArrowDown'?.05:-.05),0,1);$('drop').value=state.drop*100;refresh();engaged('drag');}});
}
/* Swipe the room left/right to change rooms */
{let start=null;const vp=$('viewport');
 vp.addEventListener('pointerdown',e=>{start=(state.inspect||zoom>1.01||e.target.closest('button,.ov'))?null:{x:e.clientX,y:e.clientY,t:performance.now()};});
 vp.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;const quick=performance.now()-start.t<700;start=null;
  if(quick&&Math.abs(dx)>55&&Math.abs(dy)<45){const i=ROOMS.findIndex(r=>r.id===state.room),n=ROOMS[(i+(dx<0?1:-1)+ROOMS.length)%ROOMS.length];document.querySelector(`[data-room="${n.id}"]`).click();engaged('swipe');}});
 vp.addEventListener('pointercancel',()=>{start=null;});}
/* Keep the selected room chip in view */
document.addEventListener('click',e=>{const b=e.target.closest('[data-room]');if(b)b.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});});
/* Coach marks fade after the visitor interacts; Dana responds to what they do */
const touched=new Set();
function engaged(kind){touched.add(kind);if(kind==='swipe')document.body.classList.add('swiped');if(kind==='drag')document.body.classList.add('dragged');if(kind==='lamp'||kind==='ceiling')document.body.classList.add('lit');danaSays();}
function danaSays(){const room=ROOMS.find(r=>r.id===state.room).label.toLowerCase();
 const lines=[`<strong>Dana</strong> · Ooh, ${state.family} in ${state.colorName} would be lovely in a ${room}. Text me a photo of your window and I'll show you.`,
  `<strong>Dana</strong> · Measure with me by text and your fit is guaranteed. Takes about two minutes.`,
  `<strong>Dana</strong> · Want to feel it first? I'll mail you swatches for $9, credited to your order.`];
 const i=Math.min(lines.length-1,Math.floor((touched.size-1)/3));}
let toastTimer;function toast(html){$('dana-line').innerHTML=html;$('dana').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('dana').classList.remove('show'),6500);}
$('dana').addEventListener('click',()=>$('dana').classList.remove('show'));
document.addEventListener('click',e=>{const pk=e.target.closest('[data-family],[data-pick],[data-style],[data-fold]');if(pk)engaged('pick:'+(pk.dataset.pick||pk.dataset.family||pk.dataset.style||pk.dataset.fold));});
/* Share the look (spouse approval is a real step) */
$('share-look')?.addEventListener('click',async()=>{const url=lookURL(),text=`What do you think of this for our ${ROOMS.find(r=>r.id===state.room).label.toLowerCase()}? ${summary()}`;
 try{if(navigator.share){await navigator.share({title:'Tailored Light',text,url});return;}await navigator.clipboard.writeText(text+' '+url);toast('<strong>Link copied</strong> · send it to whoever gets a vote.');}catch{}});
/* Intro: the shade lowers itself once so visitors see it's alive */
(function intro(){if(reduced||new URLSearchParams(location.search).has('s'))return;const target=state.drop,t0=performance.now()+700;state.drop=.04;
 const step=now=>{if(document.body.classList.contains('dragged'))return;const k=Math.min(1,Math.max(0,(now-t0)/1400)),e=1-Math.pow(1-k,3);state.drop=.04+(target-.04)*e;$('drop').value=state.drop*100;if(mechanism)refresh();if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);})();


/* ---------- Guided steps ---------- */
function goStep(name){const sb=document.querySelector('.step-body');sb.dataset.show=name;sb.scrollTop=0;document.querySelectorAll('[data-step]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.step===name)));document.querySelector('.panel').dataset.current=name;}
document.querySelectorAll('[data-step]').forEach(t=>t.addEventListener('click',()=>goStep(t.dataset.step)));
document.querySelectorAll('[data-goto]').forEach(t=>t.addEventListener('click',()=>goStep(t.dataset.goto)));
document.addEventListener('click',e=>{
 if(e.target.closest('#room-choices [data-room]'))setTimeout(()=>goStep('style'),450);
 const st=e.target.closest('.style-tiles [data-style]');if(st&&st.dataset.style==='roller')setTimeout(()=>goStep('fabric'),450);
 const bd=e.target.closest('[data-bands]');if(bd){const a=$('alignment');a.value=bd.dataset.bands;a.dispatchEvent(new Event('input'));document.querySelectorAll('[data-bands]').forEach(x=>x.setAttribute('aria-pressed',String(x===bd)));}
 if(e.target.closest('[data-pick],[data-family]'))document.body.classList.add('designed');
});
goStep('fabric');
/* Day / Night: night shows privacy and the room lit from inside */
$('night-toggle').addEventListener('click',()=>{const night=state.mood!=='evening';state.mood=night?'evening':'afternoon';state.lamp=night;$('night-toggle').setAttribute('aria-pressed',String(night));engaged('night');lighting();refresh();});
setTimeout(()=>document.body.classList.add('settled'),7000);
