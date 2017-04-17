//#version 150 core
#define PI 3.14159265
//#define SAMPLES 3
//#define RINGS 4
#define SAMPLES 3
#define RINGS 3
#vendor_ifdef ATI
#define SSAO_BRIGHT_FACTOR 1.0
#vendor_else
#define SSAO_BRIGHT_FACTOR 1.2
#vendor_endif
//
// tone mapping
//
uniform sampler2D texUnit0;
uniform sampler2D texUnit1;
uniform sampler2D texUnit2;
uniform sampler2D texUnit3; // depth texture
uniform float blurOpacity;
uniform float hdrIntencity;
uniform vec4 mulColor;
uniform float brightMax;
//
// dof
//
uniform float focalLength;
uniform float focalDNear;
uniform float focalDFar;
uniform vec2 viewPort;
//
// contrast+vignette
//
uniform float bright;
uniform float saturate;
uniform float contrast;
uniform float avgLumR;
uniform float avgLumG;
uniform float avgLumB;
uniform float afterBlur;
uniform float vignetteInner;  // 0.7 by default
uniform float vignetteOuter;  // 1.75 by default
uniform float vignetteAdjust; // 1.25 by default
//
// ssao
//
uniform vec2 ssaoNearFar;
uniform float ssaoCap;
uniform float ssaoMultiplier;
uniform float ssaoRange;
uniform float ssaoDepthTolerance;
uniform vec3 ssaoColor;
//
// contrast+vignette
//
// vignetting effect (makes corners of image darker)
float vignette(vec2 pos, float inner, float outer)
{
   float r=length(pos);
   r=vignetteAdjust-smoothstep(inner, outer, r);
   return r;
}

// For all settings: 1.0 = 100% 0.5=50% 1.5 = 150%
vec3 contrastSaturationBrightness(vec3 color, float brt, float sat, float con)
{
   //Increase or decrease theese values to adjust r, g and b color channels seperately
   //const float avglumr=0.5;
   //const float avglumg=0.5;
   //const float avglumb=0.5;
   
   const vec3 lumcoeff=vec3(0.2125, 0.7154, 0.0721);
   
   vec3 avglumin=vec3(avgLumR, avgLumG, avgLumB);
   vec3 brtcolor=color*brt;
   vec3 intensity=vec3(dot(brtcolor, lumcoeff));
   vec3 satcolor=mix(intensity, brtcolor, sat);
   vec3 concolor=mix(avglumin, satcolor, con);
   return concolor;
}
//
// dof
//
float getDepth(vec2 coord)
{
   return 2.0*1.0*focalDFar/(focalDFar+1.0-(2.0*texture2D(texUnit3, coord).x-1.0)*(focalDFar-1.0));
}
//
// ssao
//
vec2 ssaoRand(in vec2 coord) // generating random noise
{
   float noisex=(fract(sin(dot(coord, vec2(12.9898, 78.233)))*43758.5453));
   float noisey=(fract(sin(dot(coord, vec2(12.9898, 78.233)*2.0))*43758.5453));
   return vec2(noisex, noisey)*0.007;
}

float ssaoDepth(in vec2 coord)
{
   return (2.0*0.1)/(ssaoNearFar.y+ssaoNearFar.x-texture2D(texUnit3, coord).x*(ssaoNearFar.y-ssaoNearFar.x));
}

float ssaoCompareDepths(in float depth1, in float depth2)
{
   float diff=sqrt(clamp(1.0-(depth1-depth2)/(ssaoRange/(ssaoNearFar.y-ssaoNearFar.x)), 0.0, 1.0));
   return min(ssaoCap, max(0.0, depth1-depth2-ssaoDepthTolerance)*ssaoMultiplier)*diff;
}

/*// Convert z-depth value into camera distance coordinate
float ssaoConvertZ(in float depth)
{
   // compute distance to the viewer
   float znear=ssaoNearFar.x;
   float zfar=ssaoNearFar.y;
   float a=zfar/(zfar-znear);
   float b=zfar*znear/(znear-zfar);
   float dist=b/(depth-a);
   return (dist-znear)/(zfar-znear);
}*/

float ssao()
{
   float depth=ssaoDepth(gl_TexCoord[3].st);
   float aspect=viewPort.x/viewPort.y;
   vec2 noise=ssaoRand(gl_TexCoord[3].st);
   float w=(1.0/viewPort.x)/clamp(depth, 0.05, 1.0)+(noise.x*(1.0-noise.x));
   float h=(1.0/viewPort.y)/clamp(depth, 0.05, 1.0)+(noise.y*(1.0-noise.y));
   float pw, ph, ao, s, d;
   for (int i=-RINGS; i<RINGS; i+=1)
   {
      for (int j=-SAMPLES; j<SAMPLES; j+=1)
      {
         float step=PI*2.0/float(SAMPLES*i);
         pw=(cos(float(j)*step)*float(i));
         ph=(sin(float(j)*step)*float(i))*aspect;
         d=ssaoDepth(vec2(gl_TexCoord[3].s+pw*w, gl_TexCoord[3].t+ph*h));
         ao+=ssaoCompareDepths(depth, d);
         s+=1.0;
      }
   }
   ao/=s;
   ao=1.0-ao;
   return ao;
}
//
// fxaa
//
vec4 fxaa(in sampler2D buf, in vec2 coord)
{
   const float FXAA_SUBPIX_SHIFT=0.0;   //0.0        //1.0/4.0
   const float FXAA_EDGE_SENS=1.0/64.0; //1.0/4096.0 //1.0/2048.0

   vec2 rcpfrm=vec2(1.0/viewPort.x, 1.0/viewPort.y);
   vec2 coord_zw=coord-(rcpfrm*(0.5+FXAA_SUBPIX_SHIFT));

   vec2 c_nw=coord_zw;
   vec2 c_ne=coord_zw+(vec2(1.0, 0.0)/viewPort);
   vec2 c_sw=coord_zw+(vec2(0.0, 1.0)/viewPort);
   vec2 c_se=coord_zw+(vec2(1.0, 1.0)/viewPort);

   float d_nw=getDepth(c_nw);
   float d_ne=getDepth(c_ne);
   float d_sw=getDepth(c_sw);
   float d_se=getDepth(c_se);
   float d_m =getDepth(coord);
   float d_av=(d_nw+d_ne+d_sw+d_se)/4.0;
   float d_diff=d_m-d_av;
   if (d_diff<FXAA_EDGE_SENS)
   {
      return texture2D(buf, coord);
   }

   const float FXAA_SPAN_MAX   = 8.0;                  //2.0     //4.0
   const float FXAA_REDUCE_MUL = 0.0;        //1.0/8.0 //1.0/2.0 //1.0/4.0
   const float FXAA_REDUCE_MIN = 1.0/128.0;  //1.0/8.0

   vec3  luma=vec3(0.299, 0.587, 0.114);
   float luma_nw=dot(texture2D(buf, c_nw).xyz,  luma); //rgb_nw
   float luma_ne=dot(texture2D(buf, c_ne).xyz,  luma); //rgb_ne
   float luma_sw=dot(texture2D(buf, c_sw).xyz,  luma); //rgb_sw
   float luma_se=dot(texture2D(buf, c_se).xyz,  luma); //rgb_se
   float luma_m =dot(texture2D(buf, coord).xyz, luma); //rgb_m

   float lumamin=min(luma_m, min(min(luma_nw, luma_ne), min(luma_sw, luma_se)));
   float lumamax=max(luma_m, max(max(luma_nw, luma_ne), max(luma_sw, luma_se)));

   vec2 dir;
   dir.x=-((luma_nw+luma_ne)-(luma_sw+luma_se));
   dir.y= ((luma_nw+luma_sw)-(luma_ne+luma_se));

   float dirreduce=max((luma_nw+luma_ne+luma_sw+luma_se)*(0.25*FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

   float rcpdirmin=1.0/(min(abs(dir.x), abs(dir.y))+dirreduce);
   
   dir=min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir*rcpdirmin))/viewPort;

   vec3 rgb_a=(1.0/2.0)*(texture2D(buf, coord.xy+dir*(1.0/3.0-0.5)).xyz+texture2D(buf, coord.xy+dir*(2.0/3.0-0.5)).xyz);
   vec3 rgb_b=rgb_a*(1.0/2.0)+(1.0/4.0)*(texture2D(buf, coord.xy+dir*(0.0/3.0-0.5)).xyz+texture2D(buf, coord.xy+dir*(3.0/3.0-0.5)).xyz);
   float luma_b=dot(rgb_b, luma);

   if((luma_b<lumamin)||(luma_b>lumamax))
   {
      return vec4(rgb_a, 1.0);
   }
   else
   {
      return vec4(rgb_b, 1.0);
   }
}

// Celshading
float edepth(vec2 coord) 
{
	return texture2D(texUnit3,coord).x;
}

const float BORDER = 1.1;
float pw = 1.0/viewPort.x;
float ph = 1.0/viewPort.y;

vec4 celshade(vec4 color, vec2 texcoord)
{
	//edge detect
	float d = edepth(gl_TexCoord[3].xy);
	float dtresh = 1.0/(ssaoNearFar.y-ssaoNearFar.x)/ssaoNearFar.y;	
	vec4 dc = vec4(d,d,d,d);
	vec4 sa;
	vec4 sb;
	
	sa.x = edepth(texcoord.xy + vec2(-pw,-ph)*BORDER);
	sa.y = edepth(texcoord.xy + vec2(pw,-ph)*BORDER);
	sa.z = edepth(texcoord.xy + vec2(-pw,0.0)*BORDER);
	sa.w = edepth(texcoord.xy + vec2(0.0,ph)*BORDER);
	
	//opposite side samples
	sb.x = edepth(texcoord.xy + vec2(pw,ph)*BORDER);
	sb.y = edepth(texcoord.xy + vec2(-pw,ph)*BORDER);
	sb.z = edepth(texcoord.xy + vec2(pw,0.0)*BORDER);
	sb.w = edepth(texcoord.xy + vec2(0.0,-ph)*BORDER);
	
	vec4 dd = abs(2.0* dc - sa - sb) - dtresh;
	dd = vec4(step(dd.x,0.0),step(dd.y,0.0),step(dd.z,0.0),step(dd.w,0.0));
	
	float e = clamp(dot(dd,vec4(0.25,0.25,0.25,0.25)),0.0,1.0);
	return color * e;
}

void main()
{
   //
   // tone mapping
   //
   vec4 color0=fxaa(texUnit0, gl_TexCoord[0].xy); // fxaa
   vec4 color1=texture2D(texUnit1, gl_TexCoord[1].xy);
   vec4 color2=texture2D(texUnit2, gl_TexCoord[2].xy);
   //
   // ssao
   //
   float ao=ssao();
   //
   // dof
   //
   float depth=getDepth(gl_TexCoord[3].xy);
   if (depth>=focalLength)
   {
      float bluramount=clamp(abs(depth-focalLength)/focalDNear, 0.0, 1.0);
      color0=mix(color0, color1, bluramount);
   }
   //
   // tone mapping
   //
   color0+=color1*blurOpacity;
   //float y=dot(vec4(0.30, 0.59, 0.11, 0.0), color0);
   float yd=SSAO_BRIGHT_FACTOR*hdrIntencity*(hdrIntencity/brightMax+1.0)/(hdrIntencity+1.0);
   color0*=yd/vignetteAdjust+color2*mulColor;
   //
   // contrast+vignette
   //
   color0.xyz=contrastSaturationBrightness(color0.xyz, bright, saturate, contrast);
   color0=mix(color0, color1, vec4(afterBlur));
   //
   // ssao
   //
   //color0=vec4(color0.xyz/*vec3(1.0)*/*ssao(), 1.0);
   //float ao=ssao();
   color0.xyz*=(ao+ssaoColor*(1.0-ao)).xyz;
   //
   // contrast+vignette
   //
   // vignette effect
   vec2 crd=2.0*gl_TexCoord[0].xy-1.0;
   color0*=vignette(crd, vignetteInner, vignetteOuter);
   gl_FragColor=celshade(color0, gl_TexCoord[0].xy);
}