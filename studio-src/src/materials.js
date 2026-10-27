import * as THREE from 'three';

export const COLORS = {
  oat: { label: 'Oat', hex: '#d7c5a2' }, ivory: { label: 'Ivory', hex: '#eee9db' },
  sage: { label: 'Sage', hex: '#929b81' }, clay: { label: 'Clay', hex: '#b7836d' },
  charcoal: { label: 'Charcoal', hex: '#575851' },
};
const cache = new Map();
let sourceImages={};
export function configureTextureImages(images){sourceImages={...images};cache.clear();}
export function seedRandom(seed=17) { let n=seed; return () => { n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296; }; }
function canvas(size=256) {const c=document.createElement('canvas');c.width=size;c.height=size;return c;}
function texture(key, painter, size=256){
  if(cache.has(key))return cache.get(key);
  // willReadFrequently keeps the canvas on the CPU, so normalFromHeight's getImageData is a plain copy, not a GPU readback.
  const c=canvas(size),ctx=c.getContext('2d',{willReadFrequently:true});painter(ctx,size);
  const t=new THREE.CanvasTexture(c);t.name=key;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.userData.mimeType='image/jpeg';cache.set(key,t);return t;
}
export function clothTexture(kind='linen') {
  return texture('weave-'+kind,(ctx,s)=>{
    if(kind==='linen'&&sourceImages.linen){ctx.drawImage(sourceImages.linen,0,0,s,s);return;}
    if(kind==='stripe'&&sourceImages.linen){ctx.drawImage(sourceImages.linen,0,0,s,s);ctx.fillStyle='#5d6a7a66';for(let x=0;x<s;x+=128)ctx.fillRect(x,0,20,s);ctx.fillStyle='#5d6a7a2a';for(let x=0;x<s;x+=128)ctx.fillRect(x+24,0,6,s);return;}
    const r=seedRandom(109);ctx.fillStyle='#e9e5dc';ctx.fillRect(0,0,s,s);
    const image=ctx.getImageData(0,0,s,s),d=image.data;
    for(let y=0;y<s;y++)for(let x=0;x<s;x++){
      let k=(r()-.5)*18;
      if(kind==='linen')k+=((x%4===0)?-19:4)+((y%5===0)?-17:4);
      if(kind==='basket')k+=((Math.floor(x/5)+Math.floor(y/5))%2?-17:10)+((x%5===0||y%5===0)?-13:0);
      if(kind==='smooth')k=(r()-.5)*5+Math.sin(y*.8)*2;
      if(kind==='stripe')k+=((x%4===0)?-12:3)+((y%5===0)?-10:3)+((x%128)<20?-46:(x%128)<26?-18:0);
      if(kind==='reed')k=(r()-.5)*14+((y%21)<4?-62:(y%21)<8?-20:10)+Math.sin(x*.09+y*.7)*9+((x%85)<2?-40:0);
      const i=(y*s+x)*4;d[i]=Math.max(0,Math.min(255,233+k));d[i+1]=Math.max(0,Math.min(255,229+k));d[i+2]=Math.max(0,Math.min(255,220+k));d[i+3]=255;
    }ctx.putImageData(image,0,0);
  },512);
}
export function woodTexture(){return texture('oak-grain',(ctx,s)=>{
  if(sourceImages.oak){ctx.drawImage(sourceImages.oak,0,0,s,s);return;}
  const r=seedRandom(62);ctx.fillStyle='#ddc3a0';ctx.fillRect(0,0,s,s);
  for(let x=0;x<s;x++){
    const tone=112+Math.floor(r()*75);ctx.strokeStyle=`rgba(${tone},${tone*.78|0},${tone*.52|0},${.09+r()*.17})`;ctx.lineWidth=.4+r()*.8;ctx.beginPath();
    for(let y=0;y<=s;y+=4){const dx=Math.sin(y/53+x*.1)*1.7+Math.sin(y/22+x*.13)*.55;y?ctx.lineTo(x+dx,y):ctx.moveTo(x+dx,y);}ctx.stroke();
  }
  for(let i=0;i<3;i++){ctx.strokeStyle='rgba(105,75,46,.09)';ctx.beginPath();ctx.ellipse(r()*s,r()*s,3+r()*5,15+r()*15,.08,0,Math.PI*2);ctx.stroke();}
},512);}
function rugTexture(){return texture('looped-wool',(ctx,s)=>{
  if(sourceImages.rug){ctx.drawImage(sourceImages.rug,0,0,s,s);return;}
  const r=seedRandom(8);ctx.fillStyle='#ded3bd';ctx.fillRect(0,0,s,s);
  for(let y=0;y<s;y+=6)for(let x=0;x<s;x+=5){ctx.strokeStyle=r()>.5?'#bfb29b':'#efe6d3';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(x+(y%12?2:0),y,1.7,2.3,0,0,Math.PI*2);ctx.stroke();}
},512);}
export function paintingTexture(){return texture('little-landscape',(ctx,s)=>{
  if(sourceImages.painting){ctx.drawImage(sourceImages.painting,0,0,s,s);return;}
  ctx.fillStyle='#d2d0b8';ctx.fillRect(0,0,s,s);const r=seedRandom(89);
  ['#b2b59a','#939e7c','#79896e','#a8a389','#c1b294'].forEach((col,i)=>{ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,s);ctx.lineTo(0,s*(.27+i*.13));for(let x=0;x<=s;x+=5)ctx.lineTo(x,s*(.3+i*.13)+Math.sin(x/50+i*2)*19+Math.sin(x/17+i)*5);ctx.lineTo(s,s);ctx.fill();});
  for(let i=0;i<1800;i++){ctx.fillStyle=`rgba(242,231,200,${r()*.08})`;ctx.fillRect(r()*s,r()*s,2,1);}
});}
export function exteriorTexture(){return texture('ordinary-neighborhood',(ctx,s)=>{
  if(sourceImages.neighborhood){ctx.drawImage(sourceImages.neighborhood,0,0,s,s);return;}
  const r=seedRandom(401);const sky=ctx.createLinearGradient(0,0,0,s);sky.addColorStop(0,'#c4d6dc');sky.addColorStop(.65,'#e4e5d2');ctx.fillStyle=sky;ctx.fillRect(0,0,s,s);
  ctx.fillStyle='#bdc2b4';ctx.fillRect(s*.1,s*.16,s*.9,s*.53);ctx.fillStyle='#777a70';ctx.beginPath();ctx.moveTo(s*.04,s*.18);ctx.lineTo(s*.50,-s*.05);ctx.lineTo(s*1.08,s*.18);ctx.closePath();ctx.fill();
  for(let y=s*.18;y<s*.7;y+=s*.025){ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(s*.1,y,s*.9,1);}
  for(const [x,y]of[[.25,.24],[.65,.24],[.25,.48],[.65,.48]]){ctx.fillStyle='#eef0e6';ctx.fillRect(x*s,y*s,s*.13,s*.18);ctx.fillStyle='#788c90';ctx.fillRect((x+.015)*s,(y+.015)*s,s*.10,s*.15);ctx.fillStyle='#eceee5';ctx.fillRect((x+.06)*s,y*s,s*.012,s*.18);ctx.fillRect(x*s,(y+.09)*s,s*.13,s*.009);}
  ctx.fillStyle='#7e9565';ctx.fillRect(0,s*.68,s,s*.32);
  for(let x=0;x<s;x+=s*.033){ctx.fillStyle=r()>.5?'#a9997c':'#b4a283';ctx.fillRect(x,s*.65,s*.030,s*.22);ctx.fillStyle='#887b64';ctx.fillRect(x,s*.65,s*.003,s*.22);}ctx.fillStyle='#9e8d70';ctx.fillRect(0,s*.77,s,s*.015);
  for(let i=0;i<350;i++){const x=r()*s,y=s*(.55+r()*.45);if(x>s*.18&&x<s*.83&&y<s*.87)continue;ctx.fillStyle=['#819367','#6b835b','#9daa73','#b5b77e'][i%4];ctx.beginPath();ctx.ellipse(x,y,2+r()*9,2+r()*6,0,0,Math.PI*2);ctx.fill();}
},1024);}
export function material(name,color,roughness=.8,extra={}) {const Material=extra.sheen?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Material({color,roughness,...extra});m.name=name;return m;}
export function normalFromHeight(source){
  const key=source.name+'-normal';if(cache.has(key))return cache.get(key);
  const image=source.image,s=image.width,c=canvas(s),ctx=c.getContext('2d'),src=image.getContext('2d',{willReadFrequently:true}).getImageData(0,0,s,s).data,out=ctx.createImageData(s,s),o=out.data;
  // Height = red channel. Tight typed-array loop (no closures or Math.hypot): this runs once per fabric on first load.
  const hgt=new Float32Array(s*s);for(let i=0;i<s*s;i++)hgt[i]=src[i*4]/255;
  for(let y=0;y<s;y++){const up=((y-1+s)%s)*s,dn=((y+1)%s)*s,row=y*s;
    for(let x=0;x<s;x++){const l=(x-1+s)%s,r=(x+1)%s,nx=(hgt[row+l]-hgt[row+r])*.9,ny=(hgt[up+x]-hgt[dn+x])*.9,inv=1/Math.sqrt(nx*nx+ny*ny+1),i=(row+x)*4;
      o[i]=(nx*inv*.5+.5)*255;o[i+1]=(ny*inv*.5+.5)*255;o[i+2]=(inv*.5+.5)*255;o[i+3]=255;}}
  ctx.putImageData(out,0,0);const t=new THREE.CanvasTexture(c);t.name=key;t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.copy(source.repeat);cache.set(key,t);return t;
}
export function buildMaterials(){
  const cloth=clothTexture(),wood=woodTexture(),rug=rugTexture();
  cloth.repeat.set(3,3);rug.repeat.set(3,2);
  const clothNormal=normalFromHeight(cloth),rugNormal=normalFromHeight(rug);
  const plaster=texture('fine-painted-plaster',(ctx,s)=>{const r=seedRandom(117),im=ctx.createImageData(s,s);for(let i=0;i<im.data.length;i+=4){const v=224+r()*28;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ctx.putImageData(im,0,0);});plaster.repeat.set(9,7);
  return {
    wall:material('Warm painted plaster','#e2d2ba',.96,{normalMap:normalFromHeight(plaster),normalScale:new THREE.Vector2(.3,.3)}),trim:material('Simple warm-white trim','#f1ebdd',.55),
    plinth:material('Oak architectural plinth','#ddd0b8',.72,{map:wood,normalMap:normalFromHeight(wood),normalScale:new THREE.Vector2(.22,.22)}),wood:material('Everyday oak furniture','#eee4d6',.7,{map:wood,normalMap:normalFromHeight(wood),normalScale:new THREE.Vector2(.25,.25)}),
    sofa:material('Warm taupe sofa fabric','#b5a18a',.94,{map:cloth,normalMap:clothNormal,normalScale:new THREE.Vector2(.7,.7),sheen:.55,sheenColor:'#e2cbb0',sheenRoughness:.9}),
    seam:material('Upholstery piping','#93816d',.98,{map:cloth}),
    rust:material('Rust cushion weave','#c27b50',.94,{map:cloth,normalMap:clothNormal}),blue:material('Blue cushion weave','#8298a0',.96,{map:cloth,normalMap:clothNormal}),
    chair:material('Reading chair oatmeal','#c6bba6',.95,{map:cloth,normalMap:clothNormal,sheen:.4,sheenColor:'#eadbc4',sheenRoughness:.9}),throw:material('Casual cotton throw','#e5d9bf',1,{map:cloth,normalMap:clothNormal,normalScale:new THREE.Vector2(.3,.3),side:THREE.DoubleSide,shadowSide:THREE.FrontSide}),
    rug:material('Wool flatweave rug','#d9cbb1',1,{map:rug,normalMap:rugNormal}),
    dark:material('Soft charcoal metal','#3f4039',.43,{metalness:.35}),brass:material('Warm brushed lamp stem','#867653',.42,{metalness:.7}),
    ceramic:material('Everyday stoneware','#d4c9b1',.37),paper:material('Paper','#eee7d9',.94),green:material('Plant leaves','#60754a',.77),leafLight:material('Young plant leaves','#7e8957',.82),
    basket:material('Woven plant pot','#9c8056',.94,{map:clothTexture('basket'),normalMap:normalFromHeight(clothTexture('basket'))}),soil:material('Potting soil','#4e4232',1),
    glass:material('Clear window glass','#f6fbf8',.07,{transparent:true,opacity:.075,depthWrite:false,side:THREE.DoubleSide}),
    tv:material('Television screen','#232c2c',.25,{metalness:.22}),lamp:material('Linen lamp shade','#e6d9bb',.93,{map:cloth,side:THREE.DoubleSide}),
    outlet:material('Outlet ivory','#e9e5d9',.65),
  };
}
