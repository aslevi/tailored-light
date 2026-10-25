import * as THREE from 'three';
import { ROOM, box } from './model.js';
import { clothTexture, normalFromHeight, COLORS, material } from './materials.js';

export const DEFAULT_OPTIONS = Object.freeze({style:'roller',fabric:'linen',color:'oat',drop:55,opacity:'filtering',open:false});
const STYLES=['roller','zebra','woven'],FABRICS=['linen','basket','smooth'];
export function normalizeOptions(input={}){
  const out={...DEFAULT_OPTIONS,...input};
  if(!STYLES.includes(out.style))throw new Error('Unknown shade style.');
  if(!FABRICS.includes(out.fabric))throw new Error('Unknown fabric.');
  if(!COLORS[out.color])throw new Error('Unknown shade color.');
  if(!['filtering','blackout'].includes(out.opacity))throw new Error('Unknown opacity.');
  if(!Number.isFinite(Number(out.drop)))throw new Error('Shade drop must be a number.');
  out.drop=THREE.MathUtils.clamp(Number(out.drop),0,100);return out;
}
function shadeMaterial(options){
  const tex=clothTexture(options.style==='woven'?'basket':options.fabric),woven=options.style==='woven';
  const m=material('Shade_fabric',COLORS[options.color].hex,.94,{map:tex,normalMap:normalFromHeight(tex),side:THREE.DoubleSide});
  // The viewer adds approximate backlighting; this is not measured transmission.
  m.userData={fabric:options.fabric,color:options.color,opticalCalibration:false};return m;
}
function addCord(parent,width){
  const metal=material('Cordless_bracket','#e6dfd0',.65);
  for(const x of[-width/2,width/2])box(parent,'Shade_end_bracket',.028,.075,.095,x,-.005,0,metal,.006);
}

export function createShade(input={}){
  const options=normalizeOptions(input),w=ROOM.window;
  const group=new THREE.Group();group.name='Shade_'+options.style;group.position.set(w.x,w.top,-ROOM.depth/2+.088);
  group.visible=!options.open;
  group.userData={...options,kind:'shade',anchor:'top-center',widthMeters:w.width,heightMeters:w.height,localAxes:'X width; Y downward drop from 0; Z into room',illustrative:true};
  const mat=shadeMaterial(options),frame=material('Shade_hardware','#e6dfcf',.55);
  const width=w.width-.045,height=Math.max(.012,w.height*(options.open?0:options.drop/100));
  box(group,'Shade_headrail',width+.055,.055,.078,0,.015,0,frame,.022);addCord(group,width);
  const fabricGroup=new THREE.Group();fabricGroup.name='Shade_drop';group.add(fabricGroup);
  if(options.style==='roller'){
    const panel=box(fabricGroup,'Roller_fabric',width,height,.007,0,-height/2,-.005,mat,.001);
    panel.userData={part:'fabric',dropAnchor:'top'};
    box(fabricGroup,'Roller_bottom_rail',width+.005,.019,.021,0,-height,0,frame,.007);
    // Slight rolled edge rather than a featureless flat rectangle.
    const roll=new THREE.Mesh(new THREE.CylinderGeometry(.023,.023,width,40),mat);roll.name='Roller_fabric_roll';roll.rotation.z=Math.PI/2;roll.position.y=.006;roll.castShadow=true;group.add(roll);
  }else if(options.style==='zebra'){
    const sheer=material('Zebra_sheer',COLORS[options.color].hex,1,{map:clothTexture('linen'),transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
    const rear=new THREE.Mesh(new THREE.PlaneGeometry(width,height),sheer);rear.name='Zebra_sheer_backing';rear.position.set(0,-height/2,-.01);rear.receiveShadow=true;fabricGroup.add(rear);
    const pitch=.115,solid=.071;
    for(let i=0;i<Math.ceil(height/pitch);i++){
      const start=i*pitch,h=Math.min(solid,height-start);if(h<=0)continue;
      box(fabricGroup,'Zebra_opaque_band_'+i,width,h,.009,0,-start-h/2,.001,mat,0);
    }
    box(fabricGroup,'Zebra_bottom_rail',width+.008,.031,.04,0,-height,.005,frame,.010);
  }else{
    const backing=material('Woven_wood_backing',COLORS[options.color].hex,1,{map:clothTexture('basket'),transparent:true,opacity:.84,side:THREE.DoubleSide});
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),backing);panel.name='Woven_textile_backing';panel.position.set(0,-height/2,-.008);panel.receiveShadow=true;fabricGroup.add(panel);
    const reedMat=mat.clone();reedMat.name='Woven_wood_reeds';reedMat.color.multiplyScalar(.86);
    for(let i=0;i<Math.floor(height/.012);i++)box(fabricGroup,'Woven_reed_'+i,width,.0075,.005,0,-i*.012-.005,.002,i%3?mat:reedMat,0);
    const threadMat=material('Woven_warp_threads','#8b765a',1);
    for(let i=0;i<13;i++)box(fabricGroup,'Woven_warp_'+i,.0025,height,.002,-width/2+.035+i*(width-.07)/12,-height/2,.008,threadMat,0);
    box(fabricGroup,'Woven_bottom_rail',width,.022,.026,0,-height,0,reedMat,.006);
  }
  if(options.open||options.drop===0)fabricGroup.visible=false;
  group.updateMatrixWorld(true);return group;
}
export function disposeShade(shade){const geometries=new Set(),materials=new Set();shade.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
