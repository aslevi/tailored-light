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
export const roomAsset=(id,kind='day')=>'rooms/frontal-v2/'+id+(kind==='day'?'':'-'+kind)+'.webp';
