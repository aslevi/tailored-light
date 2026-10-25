import * as THREE from 'three';

// Illustrative metres, +Z into the room. These are not supplier dimensions.
export const WINDOW_SECTION=Object.freeze({glassZ:-.24,sashZ:-.20,jambFrontZ:.15,
 shadeBackZ:-.019,headboxBackZ:-.015,headboxFrontZ:.13,top:.07,bottom:-1.31});
export function createWindowAssembly(){
 const root=new THREE.Group();root.name='Inside_mount_window_section';
 const paint=new THREE.MeshStandardMaterial({color:'#d7cbbb',roughness:.9});
 const sashPaint=new THREE.MeshStandardMaterial({color:'#e0d8cb',roughness:.87});
 function box(name,w,h,d,x,y,z,mat=paint){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
 }
 box('Upper_jamb_mounting_surface',1.76,.035,.39,0,.0875,-.045);
 for(const side of [-1,1]){
  box('Jamb_board_'+side,.03,1.38,.39,side*.865,-.62,-.045);
  box('Rear_sash_stile_'+side,.044,1.30,.035,side*.807,-.62,-.20,sashPaint);
 }
 box('Sill_depth_below_hem',1.76,.035,.44,0,-1.3275,-.02);
 box('Rear_sash_header',1.66,.038,.035,0,.012,-.20,sashPaint);
 box('Rear_sash_lower_rail',1.66,.038,.035,0,-1.252,-.20,sashPaint);
 const headbox=box('Top_jamb_mounted_headbox',1.684,.076,.145,0,.032,.0575);
 box('Headbox_fabric_exit_lip',1.665,.004,.009,0,-.008,.135,
  new THREE.MeshStandardMaterial({color:'#b5aa98',roughness:1}));
 for(const side of [-1,1])box('Top_fixing_plate_'+side,.045,.005,.10,side*.73,.0675,.035,sashPaint);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.57,1.23),new THREE.MeshStandardMaterial({color:'#bdd4de',transparent:true,opacity:.16,roughness:.2,side:THREE.DoubleSide,depthWrite:false}));
 glass.name='Glass_plane_inspection_only';glass.position.set(0,-.62,WINDOW_SECTION.glassZ);glass.visible=false;root.add(glass);
 return {root,headbox,glass};
}
export function addRecessParallax(camera){
 // Dead-on orthographic view: depth does not shift horizontal/vertical edges.
 // Real jamb/glass clearance remains visible in the separate orbit inspection.
 camera.updateProjectionMatrix();
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
