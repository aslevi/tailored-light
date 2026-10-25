import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildMaterials, material, paintingTexture, exteriorTexture, seedRandom } from './materials.js';

export const ROOM = {width:3.9,depth:3.15,height:2.42,window:{x:.45,z:-1.575,bottom:.78,width:1.85,height:1.40,top:2.18}};
const TAU=Math.PI*2;
// RoundedBoxGeometry is non-indexed. Recomputing its normals directly after a
// cloth deformation creates a separate flat normal for every tiny triangle.
// Average coincident vertices while retaining the original UV seam layout.
function smoothClothNormals(geo){
  geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,sums=new Map();
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  for(let i=0;i<p.count;i++){const k=key(i),s=sums.get(k)||new THREE.Vector3();s.add(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)));sums.set(k,s);}
  for(const s of sums.values())s.normalize();
  for(let i=0;i<p.count;i++){const s=sums.get(key(i));n.setXYZ(i,s.x,s.y,s.z);}return geo;
}
export function box(parent,name,w,h,d,x,y,z,mat,r=.025){
  const mesh=new THREE.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2,h/2,d/2)):new THREE.BoxGeometry(w,h,d),mat);
  mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
// Upholstery has a full, gently uneven surface rather than a hard rounded cube.
function cushion(parent,name,w,h,d,x,y,z,mat){
  const geo=new RoundedBoxGeometry(w,h,d,8,Math.min(w,h,d)*.34),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const xx=p.getX(i),yy=p.getY(i),zz=p.getZ(i);
    const full=Math.max(0,1-(xx/(w*.52))**2)*Math.max(0,1-(zz/(d*.52))**2);
    const front=Math.max(0,1-(xx/(w*.52))**2)*Math.max(0,1-(yy/(h*.52))**2);
    // Small edge gathers break the machine-perfect silhouette. The middle stays
    // broadly padded; wrinkles grow toward the sewn edges instead of covering it.
    const gather=Math.exp(-Math.abs(Math.abs(xx)-w*.43)*28);
    const wrinkle=Math.sin(xx*63+yy*11)*Math.exp(-Math.abs(Math.abs(yy)-h*.39)*40)*.004;
    p.setXYZ(i,xx+Math.sin(yy*29+zz*17)*gather*.003,
      yy+Math.sign(yy)*full*h*.12+Math.sin(zz*48+xx*9)*gather*.006,
      zz+Math.sign(zz)*(front*d*.23-wrinkle-gather*.005*Math.sin(yy*59)));
  }
  smoothClothNormals(geo);const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function tube(parent,name,points,radius,mat){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*5),radius,7,false),mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,name,rt,rb,h,x,y,z,mat,segments=24){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function sphere(parent,name,sx,sy,sz,x,y,z,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);m.name=name;m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function group(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);return g;}
function surface(parent,name,w,h,mat,x,y,z,rotation=[0,0,0]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.name=name;m.position.set(x,y,z);m.rotation.set(...rotation);m.receiveShadow=true;parent.add(m);return m;}

function pillow(parent,name,color,x,y,z,angle){
  const g=group(parent,name);g.position.set(x,y,z);g.rotation.set(-.17,0,angle);g.userData={interaction:'pillow',restPosition:[x,y,z],restRotation:[-.17,0,angle]};
  const geo=new RoundedBoxGeometry(.44,.44,.13,9,.055),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){
    let px=a.getX(i),py=a.getY(i),pz=a.getZ(i);
    const puff=Math.max(0,(1-(px/.235)**2)*(1-(py/.235)**2));
    const edge=Math.exp(-Math.min(.22-Math.abs(px),.22-Math.abs(py))*23);
    pz+=Math.sign(pz)*(puff*.067+Math.sin(px*72+py*53)*edge*.004);
    px*=1-.09*(1-(py/.22)**2);py*=1-.07*(1-(px/.22)**2);
    a.setXYZ(i,px,py,pz);
  }smoothClothNormals(geo);
  const m=new THREE.Mesh(geo,color);m.name=name+'_cover';m.castShadow=m.receiveShadow=true;g.add(m);
  const points=[];for(let i=0;i<=64;i++){const t=i/64*TAU,co=Math.cos(t),si=Math.sin(t);points.push([.211*Math.sign(co)*Math.pow(Math.abs(co),.35),.211*Math.sign(si)*Math.pow(Math.abs(si),.35),.005]);}
  tube(g,name+'_piping',points,.0027,color);return g;
}

function sofa(root,m){
  const g=group(root,'Sofa');g.position.set(-1.33,0,-.02);g.rotation.y=Math.PI/2;g.scale.set(1.13,1.12,1.10);
  for(const x of[-.85,.85])for(const z of[-.26,.27])cylinder(g,'Sofa_foot',.036,.029,.14,x,.12,z,m.wood,12);
  box(g,'Sofa_base',2.12,.31,.86,0,.275,0,m.sofa,.065);
  box(g,'Sofa_back',2.04,.69,.22,0,.67,-.33,m.sofa,.10);
  for(const x of[-1.0,1.0]){
    cushion(g,'Sofa_arm',.23,.47,.86,x,.565,.025,m.sofa);
  }
  for(let i=0;i<3;i++){
    const x=(i-1)*.58;
    cushion(g,'Seat_cushion_'+(i+1),.565,.20,.65,x,.49,.075,m.sofa);
    const back=cushion(g,'Back_cushion_'+(i+1),.585,.53,.23,x,.81,-.23,m.sofa);back.rotation.x=-.15+(i-1)*.035;back.rotation.z=(i-1)*.025;
    tube(g,'Back_seam_'+i,[[x-.24,.59,-.12],[x-.27,.65,-.14],[x-.27,1.01,-.21],[x-.23,1.06,-.23],[x+.23,1.06,-.23],[x+.27,1.01,-.21],[x+.27,.65,-.14],[x+.24,.59,-.12]],.0025,m.seam);
    tube(g,'Seat_piping_'+i,[[x-.25,.47,.38],[x-.27,.47,.34],[x-.27,.47,-.2],[x+.27,.47,-.2],[x+.27,.47,.35],[x+.25,.47,.38],[x-.25,.47,.38]],.002,m.sofa);
  }
  pillow(g,'Pillow_rust',m.rust,-.67,.79,.015,-.18);pillow(g,'Pillow_blue',m.blue,.59,.83,.015,.14);
  // A lightweight cloth mesh draped over the nearer arm and seat.
  const geo=new THREE.PlaneGeometry(.68,1.18,40,64),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const u=pos.getX(i),v=(pos.getY(i)+.59)/1.18;
    const fold=Math.sin(u*43+v*7)*.021+Math.sin(u*72-v*4)*.008;
    const top=.86-.23*Math.pow((u+.34)/.68,2.3);
    const yy=v<.48?top+Math.sin(v/.48*Math.PI)*.023:top-(v-.48)/.52*(top-.16);
    const zz=v<.48?-.28+v/.48*.81:.53+Math.sin((v-.48)*3)*.05;
    pos.setXYZ(i,u-.73,yy+fold,zz+fold*(v>.48?1:.35));
  }geo.computeVertexNormals();const throwMesh=new THREE.Mesh(geo,m.throw);throwMesh.name='Throw_draped';throwMesh.castShadow=throwMesh.receiveShadow=true;g.add(throwMesh);
  for(let i=0;i<30;i++){const x=-1.07+i*.023,dy=Math.sin(x*43+7)*.02;tube(g,'Throw_fringe_'+i,[[x,.16+dy,.58],[x+.004,.115+dy,.59],[x-.004,.095+dy,.58]],.002,m.throw);}
  return g;
}

function chair(root,m){
  const g=group(root,'Reading_chair');g.position.set(1.12,0,-.42);g.rotation.y=-.43;g.scale.set(1.12,1.18,1.12);
  for(const x of[-.28,.28])for(const z of[-.25,.25]){const leg=cylinder(g,'Chair_leg',.025,.018,.25,x,.17,z,m.wood,12);leg.rotation.z=x>0?-.08:.08;}
  box(g,'Chair_base',.78,.25,.76,0,.36,0,m.chair,.09);
  cushion(g,'Chair_seat',.59,.16,.58,0,.49,.045,m.chair);
  const back=cushion(g,'Chair_back',.75,.62,.24,0,.79,-.27,m.chair);back.rotation.x=-.16;
  for(const x of[-.34,.34])cushion(g,'Chair_arm',.16,.34,.70,x,.58,.01,m.chair);
  const p=pillow(g,'Pillow_chair',m.blue,0,.74,-.06,.15);p.scale.set(.76,.68,.8);return g;
}

function coffeeTable(root,m){
  const g=group(root,'Coffee_table');g.position.set(-.12,0,.50);g.rotation.y=-.04;g.scale.set(1.19,1.12,1.15);
  box(g,'Coffee_table_top',1.18,.065,.57,0,.45,0,m.wood,.047);
  for(const x of[-.46,.46])for(const z of[-.19,.19])box(g,'Coffee_table_leg',.052,.39,.052,x,.235,z,m.wood,.007);
  box(g,'Coffee_table_lower_shelf',.97,.027,.42,0,.17,0,m.wood,.018);
  for(let i=0;i<3;i++)box(g,'Shelf_book_'+i,.27-i*.012,.023,.20,-.2+i*.02,.199+i*.025,.02,i===1?m.blue:m.paper,.003);
  const mug=group(g,'Everyday_mug');mug.position.set(-.32,.49,-.015);
  cylinder(mug,'Mug_body',.047,.040,.085,0,.045,0,m.ceramic);cylinder(mug,'Coffee',.040,.040,.001,0,.087,0,material('Coffee','#554330',.3));
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.029,.008,8,18),m.ceramic);handle.name='Mug_handle';handle.position.set(.048,.05,0);mug.add(handle);
  for(let i=0;i<3;i++){const mail=box(g,'Everyday_mail_'+i,.19,.0015,.095,.08+i*.007,.488+i*.002,-.015,m.paper,0);mail.rotation.y=.14-i*.08;}
  box(g,'TV_remote',.043,.019,.135,.35,.492,.015,m.dark,.012);
  for(let i=0;i<5;i++)cylinder(g,'Remote_button',.003,.003,.001,.35,.503,-.025+i*.016,m.outlet,8);
}

function plant(root,m,name,x,z,scale=1){
  const g=group(root,name);g.position.set(x,0,z);g.scale.setScalar(scale);
  cylinder(g,name+'_woven_pot',.145,.11,.255,0,.14,0,m.basket);cylinder(g,name+'_soil',.135,.135,.012,0,.268,0,m.soil);
  for(let i=0;i<13;i++){const y=.40+i*.035,t=i*2.399,px=Math.cos(t)*(.09+i*.004),pz=Math.sin(t)*(.09+i*.004);
    tube(g,name+'_stem_'+i,[[0,.25,0],[px*.5,y*.85,pz*.5],[px,y,pz]],.004,m.green);
    const leaf=sphere(g,name+'_leaf_'+i,.055,.105,.008,px,y+.04,pz,i%3?m.green:m.leafLight);leaf.rotation.set(.5*Math.cos(t),t,.6*Math.sin(t));
  }
  // Basket ribs are merged into one mesh for efficient draw calls.
  const ribs=[];for(let i=0;i<8;i++){const gg=new THREE.TorusGeometry(.114+i*.003,.0017,4,32);gg.rotateX(Math.PI/2);gg.translate(0,.04+i*.027,0);ribs.push(gg);}const ring=new THREE.Mesh(mergeGeometries(ribs),m.wood);ring.name=name+'_basket_weave';g.add(ring);
  return g;
}

function lamp(root,m){
  const g=group(root,'Lamp');g.position.set(-1.26,0,-1.20);g.userData.interaction='lamp';
  cylinder(g,'Lamp_base',.17,.17,.032,0,.027,0,m.dark);cylinder(g,'Lamp_stem',.012,.012,1.45,0,.75,0,m.brass,16);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.185,.235,.32,48,1,true),m.lamp);shade.name='Lamp_shade';shade.position.y=1.56;shade.castShadow=shade.receiveShadow=true;g.add(shade);
  for(const y of[1.4,1.72]){const ring=new THREE.Mesh(new THREE.TorusGeometry(y===1.4?.235:.185,.004,6,48),m.trim);ring.name='Lamp_shade_rim';ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring);}
  const bulb=sphere(g,'Lamp_bulb',.027,.037,.027,0,1.53,0,material('Warm bulb','#eee3b8',.2,{emissive:'#ffc779',emissiveIntensity:0}));
  const light=new THREE.PointLight('#ffcc88',0,4,2);light.name='Lamp_light';light.position.set(0,1.48,0);g.add(light);
  return {g,light,shade,bulb};
}

function architecture(root,m){
  const W=ROOM.width,D=ROOM.depth,H=ROOM.height,w=ROOM.window,t=.12;
  const a=group(root,'Architecture');a.userData={units:'meters',roomDimensions:[W,H,D],windowOpening:[w.width,w.height],purpose:'Illustrative shopping room, not customer measurement'};
  box(a,'Oak_plinth',W+.28,.16,D+.28,0,-.10,0,m.plinth,.10);
  const floor=group(a,'Oak_floor');const r=seedRandom(9),plankWidth=.16;
  for(let i=0;i<Math.ceil(W/plankWidth);i++){
    const wid=Math.min(plankWidth,W-i*plankWidth)-.003;
    const mat=m.wood.clone();mat.name='Oak_plank_tone_'+(i%5);mat.color.multiplyScalar(.89+(i%5)*.045);
    const seam=-D/2+r()*D;
    for(const[start,end]of[[-D/2,seam],[seam,D/2]])if(end-start>.02)box(floor,'Floorboard_'+i,wid,.025,end-start-.002,-W/2+i*plankWidth+wid/2,.003,(start+end)/2,mat,.001);
  }
  box(a,'Left_wall',t,H,D,-W/2-t/2,H/2,0,m.wall,.009);
  const wl=w.x-w.width/2,wr=w.x+w.width/2;
  box(a,'Window_wall_left',wl+W/2,H,t,(-W/2+wl)/2,H/2,-D/2-t/2,m.wall,.004);
  box(a,'Window_wall_right',W/2-wr,H,t,(wr+W/2)/2,H/2,-D/2-t/2,m.wall,.004);
  box(a,'Window_wall_below',w.width,w.bottom,t,w.x,w.bottom/2,-D/2-t/2,m.wall,.003);
  box(a,'Window_wall_above',w.width,H-w.top,t,w.x,(H+w.top)/2,-D/2-t/2,m.wall,.003);
  // Only a back-facing wall shell on the right: its exterior vanishes when looking in.
  const right=surface(a,'Right_wall_interior',D,H,m.wall,W/2,H/2,0,[0,-Math.PI/2,0]);right.castShadow=true;
  box(a,'Right_back_wall_return',t,H,.23,W/2+t/2,H/2,-D/2+.055,m.wall,.009);
  box(a,'Left_baseboard',.024,.08,D,-W/2+.014,.052,0,m.trim,.003);
  box(a,'Rear_baseboard',W,.08,.025,0,.052,-D/2+.016,m.trim,.003);
  box(a,'Right_baseboard',.025,.08,D,W/2-.015,.052,0,m.trim,.003);
  const ceilingMat=m.trim.clone();ceilingMat.name='Ceiling_interior';ceilingMat.side=THREE.FrontSide;ceilingMat.shadowSide=THREE.DoubleSide;
  const ceiling=surface(a,'Ceiling',W,D,ceilingMat,0,H,0,[Math.PI/2,0,0]);ceiling.castShadow=true;ceiling.userData={cameraRule:'One-sided interior. Invisible from above; still casts shadows. Visible when viewed from inside.'};
  box(a,'Ceiling_rear_edge',W+.16,.065,.14,0,H+.025,-D/2-.025,m.trim,.012);
  box(a,'Ceiling_left_edge',.12,.065,D,-W/2-.018,H+.025,0,m.trim,.008);
  for(const x of[wl-.032,wr+.032])box(a,'Window_vertical_casing',.07,w.height+.13,.06,x,w.bottom+w.height/2,-D/2+.034,m.trim,.007);
  for(const y of[w.bottom-.035,w.top+.035])box(a,'Window_horizontal_casing',w.width+.14,.07,.06,w.x,y,-D/2+.035,m.trim,.007);
  box(a,'Window_sill',w.width+.20,.035,.20,w.x,w.bottom-.04,-D/2+.075,m.trim,.01);
  for(const x of[wl+.024,wr-.024])box(a,'Window_sash_vertical',.035,w.height,.05,x,w.bottom+w.height/2,-D/2+.02,m.trim,.002);
  box(a,'Window_sash_meeting_rail',w.width,.033,.045,w.x,w.bottom+w.height*.5,-D/2+.025,m.trim,.002);
  const pane=surface(a,'Window_glass',w.width-.055,w.height-.035,m.glass,w.x,w.bottom+w.height/2,-D/2+.005);pane.castShadow=false;
  const outside=new THREE.MeshBasicMaterial({map:exteriorTexture(),color:'#ffffff'});outside.name='Neighborhood outside';
  const view=surface(a,'Neighborhood_view',w.width,w.height,outside,w.x,w.bottom+w.height/2,-D/2-.087);view.castShadow=false;view.receiveShadow=false;
  // Exterior view is a compact original illustrated texture; it is not a shadow blocker.
  const outlet=box(a,'Wall_outlet',.017,.11,.075,-W/2+.012,.19,.98,m.outlet,.009);
  for(const z of[.965,.99])box(a,'Outlet_socket',.004,.025,.005,-W/2+.023,.20,z,m.dark,.001);
  tube(a,'Phone_charging_cable',[[-W/2+.025,.16,.98],[-1.87,.04,.99],[-1.58,.045,.91],[-1.50,.12,.75],[-1.49,.57,.72]],.004,m.paper);
  box(a,'Phone_on_sofa_arm',.075,.009,.145,-1.49,.704,.72,m.dark,.009);
}

function television(root,m){
  const g=group(root,'TV_and_stand');g.position.set(1.72,0,.40);g.rotation.y=-1.02;
  box(g,'TV_stand_top',.96,.04,.34,0,.49,0,m.wood,.013);
  box(g,'TV_stand_bottom',.91,.035,.30,0,.105,0,m.wood,.006);
  for(const x of[-.45,.45])box(g,'TV_stand_side',.03,.36,.30,x,.30,0,m.wood,.004);
  box(g,'TV_stand_divider',.024,.36,.29,0,.30,0,m.wood,.004);
  for(const x of[-.36,.36])for(const z of[-.1,.1])box(g,'TV_stand_foot',.04,.10,.04,x,.05,z,m.wood,.004);
  for(let i=0;i<4;i++)box(g,'TV_shelf_book_'+i,.20,.022,.17,-.22,.14+i*.025,.02,i%2?m.paper:m.blue,.002);
  box(g,'TV_frame',.91,.54,.025,0,.86,-.02,m.dark,.012);
  box(g,'TV_screen',.87,.493,.005,0,.867,-.004,m.tv,.006);
  for(const x of[-.28,.28]){const foot=box(g,'TV_foot',.025,.10,.12,x,.555,-.005,m.dark,.004);foot.rotation.z=x>0?-.22:.22;}
}

function wallArt(root,m){
  const g=group(root,'Everyday_landscape_print');g.position.set(-ROOM.width/2+.03,1.76,.10);g.rotation.y=Math.PI/2;
  box(g,'Picture_frame',.76,.77,.035,0,0,0,m.wood,.012);box(g,'Picture_mat',.715,.725,.006,0,0,.021,m.paper,.001);
  surface(g,'Little_landscape',.60,.60,material('Original illustrated print','#ffffff',.94,{map:paintingTexture()}),0,0,.027);
}

export function createLivingRoom(){
  const root=new THREE.Group();root.name='Shadys_Everyday_Living_Room';root.userData={assetVersion:'1.0.0',units:'meters',upAxis:'Y',frontAxis:'+Z',origin:'Floor center',license:'Original Shady’s procedural geometry and textures',kind:'Editable 3D shopping illustration'};
  const m=buildMaterials();architecture(root,m);
  const rug=box(root,'Everyday_wool_rug',2.90,.035,2.25,0,.038,.24,m.rug,.016);rug.rotation.y=-.035;
  // A real woven binding catches light around the rug instead of a paper-thin slab.
  for(let i=0;i<3;i++)tube(root,'Rug_bound_edge_'+i,[[-1.43,.055+i*.003,-.85],[1.38,.055+i*.003,-.95],[1.49,.055+i*.003,1.30],[-1.40,.055+i*.003,1.40],[-1.43,.055+i*.003,-.85]],.0035,m.rug);
  sofa(root,m);chair(root,m);coffeeTable(root,m);const lampParts=lamp(root,m);
  plant(root,m,'Back_corner_houseplant',-.79,-1.27,1.28);
  television(root,m);wallArt(root,m);
  const cushions=[];root.traverse(o=>{if(o.userData.interaction==='pillow')cushions.push(o);});
  root.updateMatrixWorld(true);return {root,materials:m,lamp:lampParts,pillows:cushions};
}
