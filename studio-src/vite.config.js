import { defineConfig } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
// Only ship assets used by the approved hybrid. Earlier 3D work stays in source.
export default defineConfig(({command})=>({base:'./',publicDir:command==='serve'?'public':false,plugins:[{
 name:'hybrid-public-assets',async closeBundle(){
  for(const path of ['rooms/frontal-v2','textures/linen-web.webp']){
   const destination=new URL('./dist/'+path,import.meta.url);
   await mkdir(new URL('./',destination),{recursive:true});
   await cp(new URL('./public/'+path,import.meta.url),destination,{recursive:true});
  }
 }
}]}));
