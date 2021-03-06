uniform sampler2D texUnit0;
uniform sampler2DShadow texShadow;
uniform int fogMode;
uniform int shadowed;
uniform vec4 shadowColor;
uniform int shadowSize;
uniform vec4 custColor;

void main()
{
   // ambient/diffuse/specular operations
   vec3 l=gl_TexCoord[4].xyz;
   vec3 h=gl_TexCoord[5].xyz;
   vec3 n=gl_TexCoord[6].xyz;
   vec4 ambient=gl_FrontLightModelProduct.sceneColor+gl_FrontLightProduct[0].ambient;

    //number of levels
   //for diffuse color
   const float levels = 2;
   const float scaleFactor = 1.0 / levels;
   float diffuseFactor = max(0.0, dot(l,n));
   vec4 diffuse = gl_FrontLightProduct[0].diffuse * floor(diffuseFactor * levels) * scaleFactor;
   //vec4 diffuse=max(dot(l, n), 0.0)*gl_FrontLightProduct[0].diffuse;

   vec4 specular=pow(max(dot(h, n), 0.0), gl_FrontMaterial.shininess)*gl_FrontLightProduct[0].specular;
   // base textures operations
   vec4 tex0=texture2D(texUnit0, gl_TexCoord[0].xy);
   tex0.rgb=mix(tex0.rgb, custColor.rgb*tex0.rgb, tex0.a*custColor.a);
   // lighting operations
   vec4 color=tex0*(ambient+diffuse*2.5)+specular;
   // alpha/transparency operations
   color.a=gl_FrontMaterial.diffuse.a;

   // shadow operations
   if(shadowed==1)
   {
      float of=1.0/shadowSize;
      float sh=0.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4( of, of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4( of,-of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4(-of, of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]-vec4( of, of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4(0.0, of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4( of,0.0, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4(0.0,-of, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh+=shadow2DProj(texShadow, gl_TexCoord[3]+vec4(-of,0.0, 0.0, 0.0)).r<0.999?0.0:1.0;
      sh=sh/9.0;
      color.xyz*=(sh+shadowColor.xyz*(1.0-sh)).xyz;
   }

   // fog operations
   if(fogMode>0)
   {
      // find fog
      float fog=1.0;
      if (fogMode==1) //LINEAR
      fog=clamp((gl_Fog.end-gl_TexCoord[0].w)*gl_Fog.scale, 0.0, 1.0);
      else
      if (fogMode==2) //EXP
      fog=clamp(exp2(-gl_Fog.density*gl_TexCoord[0].w*1.442695), 0.0, 1.0);
      else
      if (fogMode==3) //EXP2
      fog=clamp(exp2(-pow(gl_Fog.density*gl_TexCoord[0].w, 2.0)*1.442695), 0.0, 1.0);
      color.xyz=mix(gl_Fog.color.xyz, color.xyz, fog).xyz;
   }

   // final operation
   gl_FragColor = color;
}