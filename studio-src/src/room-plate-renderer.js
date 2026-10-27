import * as THREE from 'three';
import {roomAsset} from './room-catalog.js';
import {roomLightingLevels} from './room-response.js';

// Runtime relighting: retain base-image geometry; use blurred ratios from the
// generated on/off plates. This prevents furniture-edge jumps between plates.
// It is illustrative compositing, not physical path tracing.
// Room artwork is fetched, decoded and flipped in a Web Worker and arrives as raw pixels (DataTexture).
// The main thread then only does a plain texture upload, so loading a room never blocks taps on decoding
// or on the browser's image-to-texture copy path. Falls back to TextureLoader where workers can't decode.
const fallbackLoader=new THREE.TextureLoader();
const WORKER_SRC=`self.onmessage=async e=>{const {id,url}=e.data;try{const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);
const bmp=await createImageBitmap(await r.blob());const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');
x.translate(0,bmp.height);x.scale(1,-1);x.drawImage(bmp,0,0);const d=x.getImageData(0,0,bmp.width,bmp.height);
self.postMessage({id,w:bmp.width,h:bmp.height,buf:d.data.buffer},[d.data.buffer]);}catch(err){self.postMessage({id,error:String(err)});}};`;
let worker=null,jobs=new Map(),nextJob=0;
function plateWorker(){
 if(worker!==null)return worker;
 try{
  if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function')throw 0;
  worker=new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'})));
  worker.onmessage=e=>{const j=jobs.get(e.data.id);if(!j)return;jobs.delete(e.data.id);e.data.error?j.reject(new Error(e.data.error)):j.resolve(e.data);};
  worker.onerror=()=>{worker=false;for(const j of jobs.values())j.reject(new Error('worker failed'));jobs.clear();};
 }catch{worker=false;}
 return worker;
}
async function loadPlate(url){
 const w=plateWorker();
 if(!w)return fallbackLoader.loadAsync(url);
 try{
  const d=await new Promise((resolve,reject)=>{const id=++nextJob;jobs.set(id,{resolve,reject});w.postMessage({id,url});});
  const t=new THREE.DataTexture(new Uint8Array(d.buf),d.w,d.h,THREE.RGBAFormat);t.flipY=false;t.needsUpdate=true;return t;
 }catch{return fallbackLoader.loadAsync(url);}
}
export function createRoomPlateRenderer(host){
 const renderer=new THREE.WebGLRenderer({alpha:false,antialias:false});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setPixelRatio(1);renderer.setSize(1536,1024,false);
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
 const u={base:{value:null},ceilingMap:{value:null},lampMap:{value:null},dayLevel:{value:1},ceilingLevel:{value:0},lampLevel:{value:0},night:{value:0},warm:{value:1},fixture:{value:new THREE.Vector4()},lampPosition:{value:new THREE.Vector2()},sunAmt:{value:1},sunElev:{value:.6},sunAz:{value:.3},sunWarm:{value:.3},dusk:{value:0},shadeBottom:{value:535},floorY:{value:660},trans:{value:.3}};
 const material=new THREE.ShaderMaterial({toneMapped:false,uniforms:u,vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
 varying vec2 st;
 uniform sampler2D base,ceilingMap,lampMap;
 uniform float dayLevel,ceilingLevel,lampLevel,night,warm;
 uniform vec4 fixture;uniform vec2 lampPosition;uniform float sunAmt,shadeBottom,floorY,trans,dusk,sunElev,sunAz,sunWarm;
 vec3 blurred(sampler2D tex,vec2 uv){
  vec2 d=vec2(14./1536.,14./1024.);
  return (texture2D(tex,uv).rgb*4.+texture2D(tex,uv+d).rgb+texture2D(tex,uv-d).rgb+texture2D(tex,uv+vec2(d.x,-d.y)).rgb+texture2D(tex,uv+vec2(-d.x,d.y)).rgb)/8.;
 }
 void main(){
  vec2 p=vec2(st.x*1536.,(1.-st.y)*1024.);
  vec3 b=texture2D(base,st).rgb;
  vec3 bb=blurred(base,st);
  vec3 weights=vec3(.2126,.7152,.0722);
  float baseline=max(dot(bb,weights),.06);
  float cg=clamp(dot(blurred(ceilingMap,st)-bb,weights)/baseline,0.,1.3);
  float lg=clamp(dot(blurred(lampMap,st)-bb,weights)/baseline,0.,1.6);
  // Keep artificial light out of the exterior and confine lamp illumination.
  float outside=step(504.,p.x)*step(p.x,1040.)*step(154.,p.y)*step(p.y,535.);
  float nearLamp=1.-smoothstep(190.,570.,length((p-lampPosition)*vec2(1.,.75)));
  vec3 daylightTint=mix(vec3(.88,.95,1.08),vec3(1.04,1.,.94),warm);
  daylightTint=mix(daylightTint,vec3(1.24,.80,.55),dusk*.9);
  daylightTint=mix(daylightTint,vec3(.48,.62,.90),night);
  vec3 color=b*dayLevel*daylightTint;
  color+=b*(cg+.22)*vec3(1.,.88,.70)*ceilingLevel*(1.-outside);
  color+=b*(lg+.12)*vec3(1.,.79,.52)*lampLevel*nearLamp*(1.-outside);
  float fixtureMask=(1.-smoothstep(.85,1.05,length((p-fixture.xy)/fixture.zw)))*(1.-outside);
  float lampMask=(1.-smoothstep(.75,1.1,length((p-lampPosition)/vec2(60.,48.))))*(1.-outside);
  color=mix(color,max(color,texture2D(ceilingMap,st).rgb),fixtureMask*ceilingLevel);
  color=mix(color,max(color,texture2D(lampMap,st).rgb),lampMask*lampLevel);
  // Sunlight through the window, traced with simple perspective. Wall plane = image plane (px).
  // Camera distance D, eye line E. Sun elevation tan sunElev, sideways drift sunAz per px of depth.
  // Sharp light only through the open part of the window; the shade blocks it, a light-filtering
  // fabric lets a soft glow through (trans), blackout lets nothing through (trans = 0).
  float D=1800.,E=300.,TE=sunElev,TA=sunAz,cx=772.;
  float top=max(shadeBottom,182.);
  float openFrac=clamp((508.-top)/326.,0.,1.);
  vec3 sunCol=mix(vec3(1.,.93,.80),vec3(1.,.74,.46),sunWarm);
  float lum=dot(b,vec3(.299,.587,.114));
  if(sunAmt>0.&&p.y>floorY+1.){
   float k=(p.y-E)/(floorY-E),Z=D*(1.-1./k);
   float yw=floorY-TE*Z,xw=cx+(p.x-cx)/k-TA*Z;
   float soft=3.+Z*.018;
   float inX=smoothstep(536.-soft,536.+soft,xw)*(1.-smoothstep(1008.-soft,1008.+soft,xw));
   float inOpen=smoothstep(top-soft,top+soft,yw)*(1.-smoothstep(508.-soft,508.+soft,yw));
   // light through the fabric: same footprint, much softer and dimmer
   float sx=soft*7.;
   float inXs=smoothstep(536.-sx,536.+sx,xw)*(1.-smoothstep(1008.-sx,1008.+sx,xw));
   float inCloth=smoothstep(182.-sx,182.+sx,yw)*(1.-smoothstep(top-sx,top+sx,yw));
   float fade=1.-smoothstep(700.,1700.,Z);
   float lit=(inX*inOpen+inXs*inCloth*trans*.35)*fade;
   // light adds in proportion to the surface it lands on (rugs and wood brighten, shadows stay)
   color+=b*lit*sunAmt*sunCol*(.6+.3*smoothstep(.1,.5,lum));
  }
  // Soft shafts in the air: sample the view ray at several depths, glow where it crosses the beam.
  if(sunAmt>0.&&outside<.5&&openFrac>0.&&p.y>top){
   float acc=0.;
   for(int i=0;i<14;i++){
    float Z=(float(i)+.5)/14.*1200.,k=D/(D-Z);
    float Y=E+(p.y-E)/k;if(Y>floorY)continue;
    float X=(p.x-cx)/k;
    float yw=Y-TE*Z,xw=cx+X-TA*Z;
    float e=8.+Z*.02;
    acc+=smoothstep(538.-e,538.+e,xw)*(1.-smoothstep(1006.-e,1006.+e,xw))*smoothstep(top-e,top+e,yw)*(1.-smoothstep(506.-e,506.+e,yw))*smoothstep(80.,380.,Z)*(1.-smoothstep(700.,1200.,Z));
   }
   color+=sunCol*(acc/14.)*sunAmt*.11*(.6+.4*lum);
  }
  // a little bounce light around the window when the sun is in
  if(sunAmt>0.){
   vec2 wc=vec2(772.,(top+508.)*.5);
   float halo=(1.-smoothstep(140.,520.,length((p-wc)*vec2(.8,1.))))*(1.-outside);
   color+=b*halo*sunAmt*(.07*openFrac+.03*trans)*sunCol;
  }
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(mesh);
 let textures=[],generation=0,ready=false;
 return {
  async load(room){
   const ticket=++generation;
   const result=await Promise.allSettled(['day','ceiling','lamp'].map(kind=>loadPlate(new URL(roomAsset(room.id,kind),document.baseURI).href)));
   const loaded=result.filter(x=>x.status==='fulfilled').map(x=>x.value);
   if(ticket!==generation||result.some(x=>x.status==='rejected')){loaded.forEach(t=>t.dispose());if(ticket===generation)throw new Error('Room artwork failed to load');return false;}
   loaded.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;});
   textures.forEach(t=>t.dispose());textures=loaded;
   [u.base.value,u.ceilingMap.value,u.lampMap.value]=loaded;
   u.fixture.value.set(...room.fixture);u.floorY.value=room.floor||660;u.lampPosition.value.set(...room.lamp);ready=true;return loaded[0];
  },
  update(state,response){
   const tod=state.tod??(state.mood==='evening'?2:state.mood==='afternoon'?1:0),night=Math.min(1,Math.max(0,tod-1));
   u.night.value=night;u.warm.value=Math.min(1,tod)*(1-night);
   const levels=roomLightingLevels({...state,mood:'afternoon'},response);const dusk=Math.max(0,1-Math.abs(tod-1.45)*2.2);u.dusk.value=dusk;
   const curve=tod<1?.78+.22*tod:1-.25*Math.min(1,(tod-1)*2);levels.day=levels.day*curve*(1-night)+.065*night;
   // Sun by time of day (tod 0 morning, 1 midday-afternoon, 1.5 evening, 2 night).
   const sunAmt=tod<1?1:Math.pow(Math.max(0,1-(tod-1)/.85),1.3);
   u.sunAmt.value=sunAmt*(1-night);
   u.sunElev.value=tod<1?.62+.33*tod:.95-.45*Math.min(1,tod-1);
   u.sunAz.value=tod<1?.32-.24*tod:.08-.38*Math.min(1,tod-1);
   u.sunWarm.value=tod<1?.6-.4*tod:.2+.8*Math.min(1,(tod-1)/.6);
   u.trans.value=state.clothTrans??.3;
   u.shadeBottom.value=state.shadeBottom??535;
   u.dayLevel.value=levels.day;u.ceilingLevel.value=levels.ceiling;u.lampLevel.value=levels.lamp;
   if(ready)renderer.render(scene,camera);
  }
 };
}
