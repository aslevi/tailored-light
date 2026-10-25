import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clothTexture, normalFromHeight } from './materials.js';

/** Illustrative, unbranded mechanisms. All dimensions are metres.
 * Origin: fabric top centre; X across, negative Y down, positive Z into room.
 * update() changes existing vertex/UV buffers; the caller interpolates controls.
 * time is an accepted external animation clock; drop/openness drive the geometry.
 */
export const MECHANISM_SOURCES = Object.freeze({
  roman: 'https://assets.lutron.com/a/documents/085346.pdf',
  romanLift: 'https://www.rolleaseacmeda.com/docs/default-source/us/workrooms/roller-roman/roller-roman-fabrication.pdf?sfvrsn=9d58ed3c_6',
  zebra: 'https://www.louvolite.com.au/2013/07/01/strength-of-vision/',
  zebraAnchor: 'https://www.louvolite.com/wp-content/uploads/2023-Vision-Fabric-Drops.pdf',
});
const TAU=Math.PI*2, clamp=THREE.MathUtils.clamp;
function mesh(parent,name,geometry,material){
  const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
function roundBox(parent,name,w,h,d,mat,x=0,y=0,z=0){
  const g=new RoundedBoxGeometry(w,h,d,3,Math.min(.009,w/4,h/4,d/4));
  if(mat.map){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
      uv.setXY(i,(nx>.7?p.getZ(i):p.getX(i))/.12,(ny>.7?p.getZ(i):p.getY(i))/.12);
    }
  }
  const m=mesh(parent,name,g,mat);m.position.set(x,y,z);return m;
}
function axle(parent,name,r,length,mat,x=0,y=0,z=0){
  // Geometry itself is aligned with X, so rotation.x is the real shaft angle.
  const g=new THREE.CylinderGeometry(r,r,length,64,1,false);g.rotateZ(Math.PI/2);
  if(mat.map){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(1-uv.getY(i))*length/.12,uv.getX(i)*TAU*r/.12);}
  const m=mesh(parent,name,g,mat);m.position.set(x,y,z);return m;
}
function textile(color,fabric,ownedTextures){
  const source=clothTexture(fabric),map=source.clone(),normal=normalFromHeight(source).clone();
  map.repeat.set(1,1);normal.repeat.set(1,1);map.needsUpdate=normal.needsUpdate=true;
  ownedTextures.add(map);ownedTextures.add(normal);
  const mat=new THREE.MeshPhysicalMaterial({color,map,normalMap:normal,normalScale:new THREE.Vector2(.40,.40),roughness:.93,
    sheen:.65,sheenColor:new THREE.Color('#e8dfcd'),sheenRoughness:.86,side:THREE.DoubleSide});
  mat.name='Mechanism_textile';mat.userData={illustrative:true,opticalCalibration:false};return mat;
}
function dynamicSheet(parent,name,material,nx=32,ny=64){
  const geometry=new THREE.PlaneGeometry(1,1,nx,ny),m=mesh(parent,name,geometry,material);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.attributes.uv.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled=false;
  return {mesh:m,geometry,nx,ny,write(fn){
    const p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const k=j*(nx+1)+i,v=fn(i/nx,j/ny);p.setXYZ(k,v[0],v[1],v[2]);uv.setXY(k,v[3],v[4]);
    }
    p.needsUpdate=uv.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }};
}
function zebraMaterial(base,pitch,ownedTextures){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
  const ctx=canvas.getContext('2d'),im=ctx.createImageData(512,1024),data=im.data;
  // A real alpha mesh: clear apertures between fine warp/weft threads. Solid
  // stripes have their own subtle woven variation; no opaque "sheer backing".
  for(let y=0;y<1024;y++)for(let x=0;x<512;x++){
    // Centre the solid band across the repeat boundary. Its reflection symmetry
    // makes the returning layer align at phase zero, even with flipped image V.
    const i=(y*512+x)*4,solid=y<272||y>=752,warp=x%12<2,weft=y%12<2;
    const grain=(Math.sin(x*1.71+y*.39)+Math.sin(y*2.14+x*.23))*5;
    const v=solid?239+grain:(warp||weft?235:255);
    data[i]=v;data[i+1]=v-2;data[i+2]=v-6;data[i+3]=solid?255:(warp&&weft?130:warp||weft?76:0);
  }
  ctx.putImageData(im,0,0);
  const map=new THREE.CanvasTexture(canvas);map.name='Zebra_continuous_woven_stripe';map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;ownedTextures.add(map);
  const mat=base.clone();mat.name='Zebra_woven_fabric';mat.map=map;mat.transparent=true;mat.depthWrite=false;mat.alphaTest=.02;
  mat.normalMap=base.normalMap.clone();mat.normalMap.repeat.set(1,pitch/.12);ownedTextures.add(mat.normalMap);
  mat.userData={...base.userData,continuousLoop:true,stripePitchMetres:pitch};return mat;
}
function hardware(root,width,metal,cap){
  roundBox(root,'Top_mounting_channel',width+.05,.040,.065,metal,0,.043,-.018);
  for(const side of[-1,1]){
    roundBox(root,'Mounting_bracket_'+side,.020,.081,.075,cap,side*(width/2+.016),.012,.006);
    axle(root,'Drive_endcap_'+side,.031,.012,cap,side*(width/2+.005),.015,.010);
    axle(root,'Axle_pin_'+side,.008,.018,metal,side*(width/2+.023),.015,.010);
    const slot=roundBox(root,'Bracket_screw_slot_'+side,.004,.016,.002,metal,side*(width/2+.028),.027,.043);slot.rotation.z=.15;
  }
}
function validate01(value,label){if(!Number.isFinite(value))throw new TypeError(label+' must be finite.');return clamp(value,0,1);}
export function createMechanism({style='roller',width=1.62,height=1.28,color='#d8c6a4',fabric='linen',fold='relaxed'}={}){
  if(!['roller','roman','zebra'].includes(style))throw new RangeError('Unknown shade style: '+style);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=.15||height<=.20)throw new RangeError('Shade dimensions must be positive metres.');
  const root=new THREE.Group();root.name='ShadeMechanism_'+style;
  root.userData={style,width,height,units:'metres',axes:'X across; -Y down; +Z toward viewer',illustrative:true,variant:style==='roman'?'soft-fold stacking Roman':style==='zebra'?'front-anchored continuous banded loop':'standard back-roll roller'};
  const textures=new Set(),cloth=textile(color,fabric,textures);
  const metal=new THREE.MeshStandardMaterial({color:'#bdb8ac',metalness:.68,roughness:.34});metal.name='Brushed_aluminium';
  const cap=new THREE.MeshStandardMaterial({color:'#eee9df',roughness:.54});cap.name='Warm_white_hardware';
  const stitch=cloth.clone();stitch.name='Sewn_hems';stitch.color.multiplyScalar(.95);stitch.normalMap=null;
  hardware(root,width,metal,cap);
  const state={style,drop:1,openness:1,time:0,actualDrop:1,bottomY:-height,rolledLength:0,spoolRadius:.024,spoolAngle:0,bandAlignment:1};
  const nodes={},coreRadius=.024,thickness=style==='roman'?.0007:.00045;
  let updater,disposed=false;
  const spool=axle(root,'Fabric_winding_spool',coreRadius,width,cloth,0,.015,.010);nodes.spool=spool;
  function wind(length){
    const r=Math.sqrt(coreRadius**2+Math.max(0,length)*thickness/Math.PI);
    spool.scale.set(1,r/coreRadius,r/coreRadius);
    // Integrating dL/r(L) gives the angular travel of the growing roll.
    spool.rotation.x=-TAU*(r-coreRadius)/thickness;
    state.rolledLength=length;state.spoolRadius=r;state.spoolAngle=spool.rotation.x;return r;
  }
  if(style==='roller'){
    const panel=dynamicSheet(root,'Roller_unwinding_textile',cloth,36,56);
    const hem=roundBox(root,'Roller_weighted_hem',width+.006,.023,.022,stitch);
    for(const side of[-1,1])roundBox(hem,'Hem_endcap_'+side,.010,.019,.024,cap,side*(width/2),0,0);
    nodes.fabric=panel.mesh;nodes.bottomRail=hem;
    updater=()=>{
      const L=Math.max(.006,height*state.drop),wound=height-L,r=wind(wound);
      panel.write((u,v)=>{const x=(u-.5)*width,y=-v*L;
        const settle=Math.sin(u*18+v*5)*Math.sin(Math.PI*v)*.0007;
        return [x,y,.010+r+settle,u*width/.12,(wound+v*L)/.12];});
      hem.position.set(0,-L,.010+r);state.actualDrop=L/height;state.bottomY=-L;
    };
  }else if(style==='roman'){
    const count=6,step=height/count,gap=.025,stack=count*gap;
    const panels=Array.from({length:count},(_,i)=>dynamicSheet(root,'Roman_soft_fold_'+(i+1),cloth,40,56));
    const seams=Array.from({length:count},(_,i)=>axle(root,'Roman_sewn_fold_'+(i+1),.0008,width,stitch));
    const hem=roundBox(root,'Roman_bottom_weight',width-.008,.016,.021,stitch);
    const cords=[-.35*width,0,.35*width].map((x,i)=>{
      const c=mesh(root,'Rear_lift_tape_'+i,new THREE.PlaneGeometry(.005,1),stitch);c.position.x=x;c.position.z=-.015;
      const s=axle(root,'Roman_lift_spool_'+i,.028,.023,cap,x,.015,-.005);return {cord:c,spool:s};
    });
    nodes.panels=panels.map(p=>p.mesh);nodes.bottomRail=hem;nodes.liftCords=cords.map(c=>c.cord);
    updater=()=>{
      const L=stack+(height-stack)*state.drop;
      const boundaries=Array.from({length:count+1},(_,i)=>Math.min(i*step,L-(count-i)*gap));boundaries[0]=0;
      for(let i=0;i<count;i++){
        const start=boundaries[i],span=boundaries[i+1]-start,arc=step*(fold==='hobbled'?1.16:1.045);
        // The lower panels gather first. Solve a rounded pocket's depth from
        // constant textile length. Monotonic Y keeps adjacent pockets from
        // intersecting when stacked; cumulative arc UVs avoid stretching yarn.
        const gathered=clamp((step-span)/(step-gap),0,1),samples=56;
        const peak=8/9,normalizer=peak**8*(1-peak);
        const profile=v=>{
          // Free cloth hangs nearly flat, then turns softly near the lower seam.
          // As lift rings meet, the same material curls into a compact pocket.
          const hanging=(v**8*(1-v))/normalizer;
          const rest=fold==='hobbled'?Math.sin(Math.PI*v):fold==='flat'?hanging*.12:hanging;
          return rest*(1-gathered)+Math.sin(Math.PI*v)*gathered;
        };
        const profileSamples=Array.from({length:samples+1},(_,k)=>profile(k/samples));
        const lengthAt=depth=>{
          let sum=0;for(let k=1;k<=samples;k++)sum+=Math.hypot(span/samples,depth*(profileSamples[k]-profileSamples[k-1]));return sum;
        };
        let lo=0,hi=arc/2;for(let k=0;k<22;k++){const d=(lo+hi)/2;if(lengthAt(d)<arc)lo=d;else hi=d;}
        const depth=(lo+hi)/2,distances=[0];
        for(let k=1;k<=samples;k++)distances.push(distances[k-1]+Math.hypot(span/samples,depth*(profileSamples[k]-profileSamples[k-1])));
        panels[i].write((u,v)=>{
          const wave=Math.sin(Math.PI*v),x=(u-.5)*width*(1-.003*wave),soft=1-(2*u-1)**2;
          const relaxedSag=Math.min(.012,span*.10)*soft*wave*(.65+.35*(1-gathered));
          const shifted=clamp(v+.018*Math.sin(u*5.3+i*.73)*wave*(1-gathered),0,1);
          const looseEdge=.0015*Math.sin(u*23+i*1.4)*wave*(.3+.7*gathered);
          const curve=fold==='relaxed'&&i===count-1?.045*soft*v*v*(1-gathered*.7):0;
          const yy=start+span*v+relaxedSag*(fold==='flat'?.25:1)+curve;
          const z=.027+depth*profile(shifted)*(.94+.06*soft+.015*Math.sin(u*7+i*.8))+looseEdge;
          const materialDistance=distances[Math.round(v*samples)];
          return [x,-yy,z,u*width/.12,(i*arc+materialDistance)/.12];
        });
        seams[i].position.set(0,-boundaries[i+1],.033);
      }
      hem.position.set(0,-L,.027);hem.visible=fold!=='relaxed';wind(height-L);
      for(const c of cords){c.cord.scale.y=L;c.cord.position.y=-L/2;c.spool.rotation.x=state.spoolAngle;}
      state.actualDrop=L/height;state.bottomY=-L;state.foldBoundaries=boundaries;
    };
  }else{
    const pitch=.16,idlerRadius=.018,minimum=.045,maxL=height-idlerRadius;
    const striped=zebraMaterial(cloth,pitch,textures),front=dynamicSheet(root,'Zebra_fixed_front_layer',striped,24,80),rear=dynamicSheet(root,'Zebra_moving_rear_layer',striped,24,80),bend=dynamicSheet(root,'Zebra_continuous_bottom_turn',striped,24,32);
    front.mesh.renderOrder=12;rear.mesh.renderOrder=10;bend.mesh.renderOrder=11;
    const idler=axle(root,'Zebra_bottom_idler',idlerRadius-.001,width+.008,cap),ends=[];
    for(const side of[-1,1])ends.push(axle(root,'Zebra_idler_endcap_'+side,idlerRadius+.003,.012,metal,side*(width/2+.006)));
    nodes.front=front.mesh;nodes.rear=rear.mesh;nodes.bend=bend.mesh;nodes.bottomRail=idler;
    const phase=-(2*maxL+Math.PI*idlerRadius)/2;
    let alignmentTrim=0,lastDrop=1,lastOpenness=1;
    updater=(patch={})=>{
      const base=minimum+(maxL-minimum)*state.drop;
      // Real band alignment is a short movement of the same drive. Lock the
      // current half-pitch branch when only openness changes; during raising,
      // leave bands free to travel. There is no second independent fabric axis.
      if(state.openness!==lastOpenness||patch.align===true){
        const target=(state.openness-1)*pitch*.5;
        const currentPhase=2*base+Math.PI*idlerRadius+2*phase;
        const branch=Math.round((currentPhase-target)/pitch);
        const candidates=[branch-1,branch,branch+1].map(k=>(k*pitch+target-currentPhase)/2)
          .filter(delta=>base+delta>=minimum-1e-8&&base+delta<=maxL+1e-8);
        alignmentTrim=candidates.sort((a,b)=>Math.abs(a)-Math.abs(b))[0]??0;
      }else if(state.drop!==lastDrop)alignmentTrim=0;
      const L=clamp(base+alignmentTrim,minimum,maxL),length=2*L+Math.PI*idlerRadius,wound=2*(maxL-L);
      wind(wound);
      front.write((u,v)=>[(u-.5)*width,-v*L,idlerRadius,u*width/.12,(v*L+phase)/pitch]);
      rear.write((u,v)=>[(u-.5)*width,-v*L,-idlerRadius,u*width/.12,(length-v*L+phase)/pitch]);
      bend.write((u,v)=>{const theta=v*Math.PI;return[(u-.5)*width,-L-idlerRadius*Math.sin(theta),idlerRadius*Math.cos(theta),u*width/.12,(L+theta*idlerRadius+phase)/pitch];});
      idler.position.y=-L;idler.rotation.x=-L/idlerRadius;
      for(const end of ends){end.position.y=-L;end.rotation.x=idler.rotation.x;}
      const cycle=((2*L+Math.PI*idlerRadius+2*phase)%pitch+pitch)%pitch;
      state.bandAlignment=1-Math.min(cycle,pitch-cycle)/(pitch*.5);
      state.actualDrop=(L+idlerRadius)/height;state.bottomY=-L-idlerRadius;state.bandPitch=pitch;state.alignmentTrim=L-base;
      state.loopLength=length;state.frontBottomUV=(L+phase)/pitch;state.rearBottomUV=(L+Math.PI*idlerRadius+phase)/pitch;
      lastDrop=state.drop;lastOpenness=state.openness;
    };
  }
  function update(patch={}){
    if(disposed)throw new Error('Mechanism already disposed.');
    if(patch.drop!==undefined)state.drop=validate01(patch.drop,'drop');
    if(patch.openness!==undefined)state.openness=validate01(patch.openness,'openness');
    if(patch.time!==undefined){if(!Number.isFinite(patch.time))throw new TypeError('time must be finite.');state.time=patch.time;}
    if(patch.color){cloth.color.set(patch.color);stitch.color.set(patch.color).multiplyScalar(.95);root.traverse(o=>{if(o.material?.name==='Zebra_woven_fabric')o.material.color.set(patch.color);});}
    updater(patch);root.updateMatrixWorld(true);return {...state};
  }
  function dispose(){
    if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set([cloth,stitch,metal,cap]);
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();root.clear();
  }
  update();return {root,update,dispose,nodes,state,getState:()=>({...state})};
}
