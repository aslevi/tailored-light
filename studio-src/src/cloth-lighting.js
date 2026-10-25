// A diffuse textile response: light passes through, a clear image does not.
// This is an art-directed approximation, not measured fabric photometry.
export function prepareClothLighting(material,lightField){
 if(material.userData.diffuseCloth)return;
 material.userData.diffuseCloth=true;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{
   clothDay:lightField.day,clothSun:lightField.sun,clothMood:lightField.mood,
   clothClock:lightField.clock,clothBreeze:lightField.breeze,clothRegistration:lightField.registration
  });
  shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 clothPosition;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nclothPosition = position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>
   varying vec3 clothPosition;
   uniform sampler2D clothDay,clothSun;
   uniform float clothMood,clothClock,clothBreeze;
   uniform mat3 clothRegistration;
   float leafOval(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.62,1.,length((p-c)/r));}
   vec3 outdoorSample(vec2 p){
    vec2 uv=vec2(p.x/1536.,1.-p.y/1024.);
    return mix(texture2D(clothDay,uv).rgb,texture2D(clothSun,uv).rgb,min(clothMood,1.));
   }
   float foliageDensity(vec2 p){
    // The right canopy uses a mirrored crop of the nearby left tree, not the
    // distant roof behind the right tree. This is an authored shadow proxy.
    vec2 treeSample=clamp(p,vec2(526.,180.),vec2(1016.,512.));
    vec3 c=outdoorSample(treeSample);
    float canopy=max(1.-smoothstep(650.,735.,p.x),smoothstep(860.,960.,p.x));
    // Only nearby vegetation participates in the shadow pass. Architecture is
    // deliberately excluded, rather than blurring a photograph of the house.
    float green=smoothstep(.02,.10,min(c.g,c.r)-c.b);
    float shade=smoothstep(.12,.75,1.-dot(c,vec3(.2126,.7152,.0722)));
    return canopy*green*shade;
   }
   float diffuseOutdoor(vec2 p,float radius){
    float leaves=foliageDensity(p);
    float glass=smoothstep(526.,542.,p.x)*(1.-smoothstep(1000.,1016.,p.x))*smoothstep(180.,196.,p.y)*(1.-smoothstep(495.,512.,p.y));
    p+=leaves*glass*clothBreeze*vec2(3.*sin(clothClock*.91+p.y*.017)+.8*sin(clothClock*1.57+p.x*.023),1.2*sin(clothClock*1.13+p.x*.018));
    float c=foliageDensity(p)*4.;
    c+=2.*(foliageDensity(p+vec2(radius,0.))+foliageDensity(p-vec2(radius,0.))+foliageDensity(p+vec2(0.,radius))+foliageDensity(p-vec2(0.,radius)));
    c+=foliageDensity(p+vec2(radius,radius))+foliageDensity(p-vec2(radius,radius))+foliageDensity(p+vec2(radius,-radius))+foliageDensity(p+vec2(-radius,radius));
    return 1.-clamp(c/16.*.95,0.,.65);
   }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `
   #include <color_fragment>
   // Low-contrast irregular yarn bundles remain legible at room scale.
   float warp = sin(clothPosition.x*279.0 + 2.3*sin(clothPosition.x*37.0) + .8*sin(clothPosition.y*19.0));
   float weft = sin(clothPosition.y*341.0 + 1.7*sin(clothPosition.y*43.0) + .6*sin(clothPosition.x*31.0));
   // Yarn variation, not a larger checkerboard. Attenuate fine threads once
   // they fall below pixel size to keep the zoomed-out view from shimmering.
   float threadAA=1.-smoothstep(.6,2.0,max(fwidth(clothPosition.x*279.),fwidth(clothPosition.y*341.)));
   float slub=sin(clothPosition.x*83.+1.3*sin(clothPosition.y*17.))*sin(clothPosition.y*109.+sin(clothPosition.x*31.));
   float weave = .98 + threadAA*(.029*warp + .023*weft) + .018*slub;
   diffuseColor.rgb *= weave;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', `
   #include <emissivemap_fragment>
   // Recessed mounting edges and gathered pockets admit less backlight.
   float edge = smoothstep(0.0, 0.018, 0.83-abs(clothPosition.x));
   float head = smoothstep(0.0, 0.075, -clothPosition.y);
   float thickness = smoothstep(0.045,0.12,clothPosition.z);
   float pocket = 1.0 - 0.65*thickness;
   vec2 windowUV=vec2((clothPosition.x+.85)/1.7,(.07-clothPosition.y)/1.38);
   vec3 projected=clothRegistration*vec3(windowUV,1.);
   float outdoor=diffuseOutdoor(projected.xy/projected.z,1.8+thickness*9.);
   float sky = .85+.25*smoothstep(-1.3,0.,clothPosition.y);
   float broadLight = sky*(.34+.95*outdoor);
   totalEmissiveRadiance *= (0.65+0.35*edge)*(.55+.45*head)*pocket*broadLight*weave;
  `);
 };
 material.customProgramCacheKey=()=> 'frontal-room-diffuse-cloth-v4';
 material.needsUpdate=true;
}
