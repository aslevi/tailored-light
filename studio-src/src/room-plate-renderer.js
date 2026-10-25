import * as THREE from 'three';
import {roomAsset} from './room-catalog.js';
import {roomLightingLevels} from './room-response.js';

// Runtime relighting: retain base-image geometry; use blurred ratios from the
// generated on/off plates. This prevents furniture-edge jumps between plates.
// It is illustrative compositing, not physical path tracing.
export function createRoomPlateRenderer(host){
 const renderer=new THREE.WebGLRenderer({alpha:false,antialias:false});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setPixelRatio(1);renderer.setSize(1536,1024,false);
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
 const u={base:{value:null},ceilingMap:{value:null},lampMap:{value:null},dayLevel:{value:1},ceilingLevel:{value:0},lampLevel:{value:0},night:{value:0},warm:{value:1},fixture:{value:new THREE.Vector4()},lampPosition:{value:new THREE.Vector2()}};
 const material=new THREE.ShaderMaterial({toneMapped:false,uniforms:u,vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
 varying vec2 st;
 uniform sampler2D base,ceilingMap,lampMap;
 uniform float dayLevel,ceilingLevel,lampLevel,night,warm;
 uniform vec4 fixture;uniform vec2 lampPosition;
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
  vec3 daylightTint=mix(vec3(.94,.98,1.04),vec3(1.04,1.,.94),warm);
  daylightTint=mix(daylightTint,vec3(.48,.62,.90),night);
  vec3 color=b*dayLevel*daylightTint;
  color+=b*(cg+.22)*vec3(1.,.88,.70)*ceilingLevel*(1.-outside);
  color+=b*(lg+.12)*vec3(1.,.79,.52)*lampLevel*nearLamp*(1.-outside);
  float fixtureMask=(1.-smoothstep(.85,1.05,length((p-fixture.xy)/fixture.zw)))*(1.-outside);
  float lampMask=(1.-smoothstep(.75,1.1,length((p-lampPosition)/vec2(60.,48.))))*(1.-outside);
  color=mix(color,max(color,texture2D(ceilingMap,st).rgb),fixtureMask*ceilingLevel);
  color=mix(color,max(color,texture2D(lampMap,st).rgb),lampMask*lampLevel);
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(mesh);
 let textures=[],generation=0,ready=false;
 return {
  async load(room){
   const ticket=++generation,loader=new THREE.TextureLoader();
   const result=await Promise.allSettled(['day','ceiling','lamp'].map(kind=>loader.loadAsync(new URL(roomAsset(room.id,kind),document.baseURI).href)));
   const loaded=result.filter(x=>x.status==='fulfilled').map(x=>x.value);
   if(ticket!==generation||result.some(x=>x.status==='rejected')){loaded.forEach(t=>t.dispose());if(ticket===generation)throw new Error('Room artwork failed to load');return false;}
   loaded.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;});
   textures.forEach(t=>t.dispose());textures=loaded;
   [u.base.value,u.ceilingMap.value,u.lampMap.value]=loaded;
   u.fixture.value.set(...room.fixture);u.lampPosition.value.set(...room.lamp);ready=true;return loaded[0];
  },
  update(state,response){
   u.night.value=state.mood==='evening'?1:0;u.warm.value=state.mood==='afternoon'?1:0;
   const levels=roomLightingLevels(state,response);
   u.dayLevel.value=levels.day;u.ceilingLevel.value=levels.ceiling;u.lampLevel.value=levels.lamp;
   if(ready)renderer.render(scene,camera);
  }
 };
}
