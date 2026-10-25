// Registration measured against the 1536 × 1024 room master, not the viewport.
// Clockwise reveal corners: top-left, top-right, bottom-right, bottom-left.
export const ROOM_SIZE={width:1536,height:1024};
// Front opening between jamb boards, not the smaller rear glass opening.
export const MOUNT_CORNERS=[[504,154],[1040,154],[1040,535],[504,535]];
export function homography(corners){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=corners;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const den=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
 return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h,1];
}
export function projectPoint(m,u,v){const w=m[6]*u+m[7]*v+1;return [(m[0]*u+m[1]*v+m[2])/w,(m[3]*u+m[4]*v+m[5])/w];}
const clamp=x=>Math.min(1,Math.max(0,x));
export function roomLightingLevels(state,response){
 return {day:state.mood==='evening'?.065:Math.max(.055,Math.pow(response.daylight,.65)),
 ceiling:state.ceiling?clamp(state.ceilingBrightness):0,lamp:state.lamp?1:0};
}
export function roomResponse({coverage=0,style='roman',fabric='linen',color='#d7c5a2',opacity='filtering',alignment=1,mood='afternoon',lamp=true}={}){
 coverage=clamp(coverage);alignment=clamp(alignment);
 const rgb=color.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);
 const luma=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 // Diffuse light transmission is independent of image/view transmission.
 // These are illustrative privacy fabrics, not open solar-screen meshes.
 const textile={linen:.43,basket:.30,smooth:.51}[fabric]??.43;
 const clothTransmission=opacity==='blackout'?.008:textile*(.35+.65*luma);
 const transmission=style==='zebra'?.035*(.35+.65*luma)+.46*alignment:clothTransmission;
 const daylight=clamp(1-coverage+coverage*transmission);
 // Uncovered glass admits a sun patch; filtering fabric primarily scatters it.
 const direct=clamp(1-coverage+coverage*(style==='zebra'?.42*alignment:opacity==='blackout'?0:.012));
 const evening=mood==='evening';
 return {transmission,daylight,direct,
  clothOpacity:1,
  sun:evening?0:(mood==='afternoon'?.96:.18)*direct,
  dimming:evening?.12*coverage:.74*(1-Math.pow(daylight,.34)),
  diffuse:evening?0:coverage*transmission,
  reveal:evening?0:.035+.16*daylight,
  ambient:evening?.10:.13+.62*daylight,
  bounce:evening?.10:.18+1.3*daylight,
  environment:evening?.025:.06+.20*daylight,
  lampIntensity:lamp?5.8:0,
  // Mild diffuse cloth scattering, independent of the room-facing lamp.
  backscatter:evening||opacity==='blackout'?0:(style==='zebra'?.035:clothTransmission*3.7)
 };
}
