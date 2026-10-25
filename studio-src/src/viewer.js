import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createLivingRoom, ROOM } from './model.js';
import { createShade, disposeShade, normalizeOptions } from './shades.js';

/** Mount a self-contained Three.js scene. Call dispose() when unmounting. */
export function mountRoomViewer(container,{onInteraction=()=>{},pixelRatioLimit=1.6}={}){
  // Linear HDR studio color: the final ACES pass otherwise turns cream into gray.
  const studioColor=new THREE.Color(2,1.65,1.1);
  const scene=new THREE.Scene();scene.background=studioColor;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,pixelRatioLimit));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Living room 3D view');
  const camera=new THREE.PerspectiveCamera(32,1,.05,70);camera.position.set(4.7,2.9,7.3);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.08,0);controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;controls.minDistance=4.8;controls.maxDistance=11;
  controls.minPolarAngle=.57;controls.maxPolarAngle=1.38;controls.minAzimuthAngle=-.12;controls.maxAzimuthAngle=1.05;controls.update();
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;scene.environmentIntensity=.32;pmrem.dispose();
  const room=createLivingRoom();scene.add(room.root);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:studioColor,toneMapped:false}));ground.name='Studio_ground';ground.rotation.x=-Math.PI/2;ground.position.y=-.195;scene.add(ground);
  const groundShadow=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({color:'#796348',opacity:.15}));groundShadow.rotation.x=-Math.PI/2;groundShadow.position.y=-.194;groundShadow.receiveShadow=true;scene.add(groundShadow);
  const hemi=new THREE.HemisphereLight('#f2eee1','#a18e73',1.6);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0d6',4.2);sun.name='Sunlight';sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.camera.near=.5;sun.shadow.camera.far=24;sun.shadow.normalBias=.014;sun.shadow.bias=-.00004;sun.shadow.radius=4;sun.target.position.set(0,.4,.5);scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#fff0dd',1.05);fill.position.set(4,5,6);scene.add(fill);
  RectAreaLightUniformsLib.init();
  const windowFill=new THREE.RectAreaLight('#ffe8c6',1,1.5,1.1);windowFill.position.set(ROOM.window.x,1.55,-1.55);windowFill.lookAt(0,.65,.7);scene.add(windowFill);
  const floorBounce=new THREE.RectAreaLight('#efc18a',.6,2.7,2.3);floorBounce.position.set(0,.08,.2);floorBounce.lookAt(0,2,.2);scene.add(floorBounce);
  const ambientLamp=new THREE.PointLight('#ffd393',0,3.5,2);ambientLamp.position.set(-.7,1.8,-.6);scene.add(ambientLamp);
  let shade=createShade();room.root.add(shade);
  let state={...normalizeOptions(),time:15,lamp:true,inside:false},running=true,frame=0,last=0,dragging=false,pointerStart=null,pillowMotion=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});target.samples=4;
  const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  const ao=new SSAOPass(scene,camera,600,600);ao.kernelRadius=.26;ao.minDistance=.001;ao.maxDistance=.085;composer.addPass(new OutputPass());
  const resize=()=>{const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);camera.aspect=width/height;camera.zoom=state.inside?1:Math.min(1.32,camera.aspect*.94);camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function lighting(){
    const t=state.time,day=Math.max(0,Math.sin((t-6)/14*Math.PI)),az=(t-14)*.23;
    sun.position.set(-2.6+Math.sin(az)*5,1.6+day*2.5,-7.3);sun.intensity=Math.max(0,day)*6.2;sun.color.set(t<9||t>17?'#ffd39a':'#ffe1ac');
    hemi.intensity=.14+day*.30;fill.intensity=.08+day*.46;scene.environmentIntensity=.10+day*.20;floorBounce.intensity=day*.8;
    const cover=state.open?0:state.drop/100,transmission=state.style==='zebra'?.52:state.style==='woven'?.35:state.opacity==='blackout'?.025:.38;
    windowFill.intensity=day*(2.2*(1-cover)+cover*transmission*2);
    shade.traverse(o=>{if(o.material?.name==='Shade_fabric'){
      o.material.emissive.copy(o.material.color);o.material.emissiveMap=o.material.map;
      o.material.emissiveIntensity=day*(state.style==='roller'&&state.opacity==='filtering'?1.05:state.style==='zebra'?.5:.10);
    }});
    room.lamp.light.intensity=state.lamp?4.5:0;ambientLamp.intensity=state.lamp?.65:0;
    room.lamp.shade.material.emissive.set(state.lamp?'#edb665':'#000000');room.lamp.shade.material.emissiveIntensity=state.lamp?.70:0;
    room.lamp.bulb.material.emissiveIntensity=state.lamp?3:0;
  }
  function setOptions(patch){
    const next={...state,...patch,...normalizeOptions({...state,...patch})};
    next.time=THREE.MathUtils.clamp(Number(next.time)||15,7,21);next.lamp=Boolean(next.lamp);state=next;
    if(['style','fabric','color','drop','opacity','open'].some(k=>k in patch)){
      room.root.remove(shade);disposeShade(shade);shade=createShade(state);room.root.add(shade);
    }lighting();return {...state};
  }
  function nudgePillow(index=0){const p=room.pillows[index%room.pillows.length];if(pillowMotion.some(m=>m.object===p))return;pillowMotion.push({object:p,start:performance.now(),position:p.position.clone(),rotation:p.rotation.clone(),scale:p.scale.clone()});onInteraction({type:'pillow'});}
  function toggleLamp(){setOptions({lamp:!state.lamp});onInteraction({type:'lamp',on:state.lamp});}
  const raycaster=new THREE.Raycaster();
  const down=e=>{pointerStart=[e.clientX,e.clientY];dragging=false;};
  const move=e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6)dragging=true;};
  const up=e=>{
    if(!pointerStart||dragging){pointerStart=null;return;}pointerStart=null;
    const b=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);
    const hits=raycaster.intersectObject(room.root,true);for(const hit of hits){let o=hit.object;while(o&&o!==room.root){if(o.userData.interaction==='lamp'){toggleLamp();return;}if(o.userData.interaction==='pillow'){nudgePillow(room.pillows.indexOf(o));return;}o=o.parent;}if(hit.object.material?.transparent&&hit.object.material.opacity<.2)continue;break;}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);
  function setInside(value){state.inside=Boolean(value);controls.enableDamping=false;
    if(value){camera.fov=62;controls.minDistance=.05;controls.maxDistance=1.7;controls.minPolarAngle=.2;controls.maxPolarAngle=2.3;controls.minAzimuthAngle=-Math.PI;controls.maxAzimuthAngle=Math.PI;camera.position.set(.30,1.32,1.38);controls.target.set(.25,1.43,-1.26);controls.minDistance=1;controls.maxDistance=4;}
    else {camera.fov=32;controls.minDistance=4.8;controls.maxDistance=11;controls.minPolarAngle=.57;controls.maxPolarAngle=1.38;controls.minAzimuthAngle=-.12;controls.maxAzimuthAngle=1.05;camera.position.set(4.7,2.9,7.3);controls.target.set(0,1.08,0);}
    resize();controls.update();controls.enableDamping=true;return state.inside;
  }
  const visibility=()=>{running=!document.hidden;if(running){last=performance.now();frame=requestAnimationFrame(animate);}};document.addEventListener('visibilitychange',visibility);
  function animate(now){
    if(!running)return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;controls.update();
    pillowMotion=pillowMotion.filter(m=>{const t=(now-m.start)/1000,amount=reduced?0:Math.sin(t*13)*Math.exp(-t*4);m.object.position.copy(m.position);m.object.position.y+=Math.abs(amount)*.055;m.object.rotation.copy(m.rotation);m.object.rotation.z+=amount*.16;m.object.scale.y=m.scale.y*(1-Math.abs(amount)*.09);if(t>1.4){m.object.position.copy(m.position);m.object.rotation.copy(m.rotation);m.object.scale.copy(m.scale);return false;}return true;});
    composer.render(dt);frame=requestAnimationFrame(animate);
  }
  lighting();frame=requestAnimationFrame(animate);
  return {scene,room,renderer,camera,controls,setOptions,getState:()=>({...state}),toggleLamp,nudgePillow,setInside,resetView:()=>setInside(false),
    async loadGLB(url){
      const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const loaded=await new GLTFLoader().loadAsync(url),old=room.root;
      scene.remove(old);room.root=loaded.scene;room.root.name='Shadys_Everyday_Living_Room';scene.add(room.root);
      room.root.traverse(o=>{if(o.isMesh){o.castShadow=!['Window_glass','Neighborhood_view'].includes(o.name);o.receiveShadow=o.name!=='Neighborhood_view';}if(o.name==='Ceiling')o.material.shadowSide=THREE.DoubleSide;if(o.name==='Throw_draped'){o.material.normalMap=null;o.material.needsUpdate=true;o.material.shadowSide=THREE.FrontSide;o.castShadow=false;o.receiveShadow=false;}});
      room.lamp={g:room.root.getObjectByName('Lamp'),light:room.root.getObjectByName('Lamp_light'),shade:room.root.getObjectByName('Lamp_shade'),bulb:room.root.getObjectByName('Lamp_bulb')};room.pillows=[];room.root.traverse(o=>{if(o.userData.interaction==='pillow')room.pillows.push(o);});
      old.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
      shade=createShade(state);room.root.add(shade);lighting();return loaded;
    },
    async exportSelection(){const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');room.root.updateMatrixWorld(true);return new GLTFExporter().parseAsync(room.root,{binary:true,onlyVisible:true,maxTextureSize:512});},
    getStats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}),
    dispose(){running=false;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);for(const [name,fn]of[['pointerdown',down],['pointermove',move],['pointerup',up]])renderer.domElement.removeEventListener(name,fn);controls.dispose();composer.dispose();environment.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}
  };
}
