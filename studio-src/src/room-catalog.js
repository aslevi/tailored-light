import { site } from './site-root.js';
// Every room uses the same front-on installation. Artwork is 1536 × 1024.
export const ROOMS=[
 {id:'living-room',floor:640,label:'Living room',lamp:[228,305],fixture:[768,35,65,40],note:'Books, blue throws and a neighborhood street.'},
 {id:'bathroom',floor:760,label:'Bathroom',lamp:[180,218],fixture:[765,35,65,40],note:'Dusty-blue tile and textured privacy glass.'},
 {id:'kitchen',floor:730,label:'Kitchen',lamp:[155,440],fixture:[768,22,360,28],note:'Sage cabinets, breakfast dishes and a side-driveway view.'},
 {id:'dining-room',floor:690,label:'Dining room',lamp:[218,380],fixture:[775,85,110,50],note:'Terracotta walls, mismatched chairs and a small patio.'},
 {id:'home-office',floor:680,label:'Home office',lamp:[240,397],fixture:[768,42,70,35],note:'Blue-gray walls, everyday work and neighborhood rooftops.'},
 {id:'bedroom',floor:660,label:'Bedroom',lamp:[202,393],fixture:[764,47,80,43],note:'Rumpled linen, dusty rose and a leafy backyard.'},
 {id:'nursery',floor:660,label:'Nursery',lamp:[265,320],fixture:[767,43,95,36],note:'Playful prints, a blue rug and a flowering tree.'}
];
export const roomAsset=(id,kind='day')=>site('rooms/frontal-v2/'+id+(kind==='day'?'':'-'+kind)+'.webp');

// Window opening in plate pixels. Stock rooms share the frontal installation; a customer's own room
// ("mine") carries its own rectangle. glass = the clear opening the sun comes through (inside the sash).
export const STOCK_WINDOW={outer:[504,154,1040,535],glass:[536,182,1008,508]};
export function roomWindow(room){
 if(!room?.win)return STOCK_WINDOW;
 const [x0,y0,x1,y1]=room.win,ix=Math.min(32,(x1-x0)*.06),iy=Math.min(28,(y1-y0)*.07);
 return {outer:[x0,y0,x1,y1],glass:room.glass||[x0+ix,y0+iy,x1-ix,y1-iy]};
}
export const windowCorners=room=>{const [x0,y0,x1,y1]=roomWindow(room).outer;return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];};
