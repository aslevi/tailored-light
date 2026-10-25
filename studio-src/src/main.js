import { mountRoomViewer } from './viewer.js';
import { COLORS, configureTextureImages } from './materials.js';
const $=id=>document.getElementById(id),label=s=>s[0].toUpperCase()+s.slice(1);
let viewer;
const refresh=()=>{
  const s=viewer.getState();
  document.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===s.style)));
  document.querySelectorAll('[data-fabric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fabric===s.fabric)));
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===s.color)));
  document.querySelectorAll('[data-opacity]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.opacity===s.opacity)));
  $('fabric-name').textContent=s.style==='woven'?'Woven wood':label(s.fabric);$('color-name').textContent=COLORS[s.color].label;
  $('fabrics').closest('fieldset').disabled=s.style==='woven';$('opacity-field').disabled=s.style!=='roller';
  $('lamp-toggle').textContent=s.lamp?'Lamp on':'Lamp off';$('lamp-toggle').setAttribute('aria-pressed',String(s.lamp));
  $('view-toggle').textContent=s.inside?'Back to the little room ↗':'Step inside ↗';
  $('compare').setAttribute('aria-pressed',String(s.open));$('compare').textContent=s.open?'Bring back my shade':'See the bare window';
  $('selection').textContent=(s.style==='woven'?'Woven wood':label(s.fabric)+' '+s.style)+' · '+COLORS[s.color].label+(s.style==='roller'?' · '+(s.opacity==='blackout'?'Blackout':'Light filtering'):'');
};
try{
  const images=await Promise.all(['oak','linen','rug','neighborhood','painting'].map(name=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve([name,img]);img.onerror=reject;img.src=new URL('textures/'+name+'-albedo.png',document.baseURI).href;})));
  configureTextureImages(Object.fromEntries(images));viewer=mountRoomViewer($('stage'),{onInteraction:event=>{refresh();if(event.type==='pillow')$('selection').textContent='Pillow nudged. '+$('selection').textContent;}});await viewer.loadGLB(new URL('models/living-room.glb',document.baseURI).href);$('loading').remove();refresh();
}
catch(error){$('loading').classList.add('error');$('loading').textContent='This room needs a browser with WebGL 2. Try a recent Safari or Chrome browser. The downloadable models can still be imported into your website.';console.error(error);}
if(viewer){
  document.querySelectorAll('[data-style],[data-fabric],[data-color],[data-opacity]').forEach(button=>button.addEventListener('click',()=>{viewer.setOptions({...button.dataset});refresh();}));
  $('drop').addEventListener('input',e=>{viewer.setOptions({drop:Number(e.target.value)});$('drop-value').value=e.target.value+'%';});
  $('time').addEventListener('input',e=>{const time=Number(e.target.value);viewer.setOptions({time});const hour=Math.floor(time),minute=Math.round((time-hour)*60);$('time-value').value=(hour%12||12)+':'+String(minute).padStart(2,'0')+' '+(hour>=12?'PM':'AM');});
  $('lamp-toggle').addEventListener('click',()=>{viewer.toggleLamp();refresh();});
  $('pillow-nudge').addEventListener('click',()=>viewer.nudgePillow());
  $('view-toggle').addEventListener('click',()=>{viewer.setInside(!viewer.getState().inside);refresh();});
  $('reset-view').addEventListener('click',()=>{viewer.resetView();refresh();});
  $('compare').addEventListener('click',()=>{viewer.setOptions({open:!viewer.getState().open});refresh();});
  $('export-selection').addEventListener('click',async()=>{const button=$('export-selection');button.disabled=true;try{const data=await viewer.exportSelection(),url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='shadys-living-room-'+viewer.getState().style+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){$('selection').textContent='The export could not finish. The prepared room download above is still available.';console.error(e);}finally{button.disabled=false;}});
  // DOM-only QA status: useful to verify control state and actual renderer counts.
  const stats=document.createElement('output');stats.id='scene-stats';stats.hidden=true;document.body.append(stats);setInterval(()=>{stats.textContent=JSON.stringify({...viewer.getState(),...viewer.getStats()});},1000);
}
