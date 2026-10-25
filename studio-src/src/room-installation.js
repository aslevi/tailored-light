import * as THREE from 'three';
import { MOUNT_CORNERS, homography } from './room-response.js';
import {createWindowAssembly,addRecessParallax} from './window-assembly.js';

export function fitShadeCanvas(host,viewport){
 const scale=viewport.clientWidth/1536,w=400*scale,h=330*scale,m=homography(MOUNT_CORNERS.map(p=>p.map(x=>x*scale)));
 host.style.width=w+'px';host.style.height=h+'px';host.style.transformOrigin='0 0';
 host.style.transform=`matrix3d(${m[0]/w},${m[3]/w},0,${m[6]/w},${m[1]/h},${m[4]/h},0,${m[7]/h},0,0,1,0,${m[2]},${m[5]},0,1)`;
}
export async function createRoomInstallation(initialTexture){
 const group=new THREE.Group();group.name='Inside_mount_installation';
 const camera=new THREE.OrthographicCamera(-.85,.85,.07,-1.31,.01,30);camera.position.set(0,0,5);camera.lookAt(0,0,0);
 addRecessParallax(camera);
 const assembly=createWindowAssembly(),headbox=assembly.headbox;group.add(assembly.root);
 const textures=[initialTexture,initialTexture,initialTexture];
 const m=homography(MOUNT_CORNERS),transform=new THREE.Matrix3().set(...m);
 const material=new THREE.ShaderMaterial({depthWrite:false,toneMapped:false,uniforms:{day:{value:textures[0]},sun:{value:textures[1]},night:{value:textures[2]},mood:{value:1},clock:{value:0},breeze:{value:1},registration:{value:transform}},
 vertexShader:'varying vec2 st; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);st=gl_Position.xy/gl_Position.w*.5+.5;}',
 fragmentShader:`uniform sampler2D day,sun,night;uniform float mood,clock,breeze;uniform mat3 registration;varying vec2 st;
 float oval(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.62,1.,length((p-c)/r));}
 void main(){vec3 q=registration*vec3(st.x,1.-st.y,1.);vec2 p=q.xy/q.z;
  // Only leaf clusters move. House, fence, sky and the window reveal stay fixed.
  vec3 sampleColor=texture2D(day,vec2(p.x/1536.,1.-p.y/1024.)).rgb;
  float leaves=smoothstep(.015,.10,min(sampleColor.g,sampleColor.r)-sampleColor.b);
  // Guard band wider than maximum displacement: no moving sample can reach trim.
  float glass=smoothstep(526.,542.,p.x)*(1.-smoothstep(1000.,1016.,p.x))*smoothstep(180.,196.,p.y)*(1.-smoothstep(495.,512.,p.y));
  float strength=leaves*breeze*glass;
  p+=strength*vec2(3.0*sin(clock*.91+p.y*.017)+.8*sin(clock*1.57+p.x*.023),1.2*sin(clock*1.13+p.x*.018));
  vec2 uv=vec2(p.x/1536.,1.-p.y/1024.);
  vec4 c=texture2D(day,uv);
  c.rgb*=mood>1.5?vec3(.045,.065,.11):mood>.5?vec3(1.02,1.,.96):vec3(.94,.98,1.03);
  gl_FragColor=c;
  #include <colorspace_fragment>
 }`});
 const outside=new THREE.Mesh(new THREE.PlaneGeometry(2.0,1.6),material);outside.name='Living_exterior';outside.position.set(0,-.62,-.27);outside.renderOrder=-5;group.add(outside);
 let windTime=0,lastTime=null;
 return {group,camera,headbox,outside,lightField:material.uniforms,setExterior(texture){
  material.uniforms.day.value=material.uniforms.sun.value=material.uniforms.night.value=texture;
 },update({mood,breeze,time,inspect}){
  if(breeze&&lastTime!==null)windTime+=Math.min(.1,Math.max(0,time-lastTime));lastTime=time;
  outside.visible=!inspect;assembly.glass.visible=inspect;material.uniforms.mood.value=mood==='evening'?2:mood==='afternoon'?1:0;
  // Freeze the current breeze phase rather than snapping leaves back on Pause.
  material.uniforms.breeze.value=windTime>0?1:0;material.uniforms.clock.value=windTime;
 }};
}
