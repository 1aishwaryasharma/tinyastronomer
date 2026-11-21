import{createFrameLoop as H0,buildNav as W0,clamp as g,initMobileHints as M0,initMobileInfoPanels as D0,initSceneAccessibility as B0,prefersReducedMotion as L0,revealRailButton as R0,setText as A0}from"./chrome.js?v=20261008-1";import*as I from"three";import{HalfFloatType as e2,NoBlending as Z0,Timer as $0,Vector2 as w2,WebGLRenderTarget as q0}from"three";var t={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};import{ShaderMaterial as T2,UniformsUtils as r2}from"three";import{BufferGeometry as n2,Float32BufferAttribute as b2,OrthographicCamera as o2,Mesh as s2}from"three";class m{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var t2=new o2(-1,1,1,-1,0,1);class z2 extends n2{constructor(){super();this.setAttribute("position",new b2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new b2([0,2,0,0,2,0],2))}}var a2=new z2;class d{constructor(Z){this._mesh=new s2(a2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,t2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class Z2 extends m{constructor(Z,F="tDiffuse"){super();if(this.textureID=F,this.uniforms=null,this.material=null,Z instanceof T2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=r2.clone(Z.uniforms),this.material=new T2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new d(this.material)}render(Z,F,U){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=U.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(F),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class G2 extends m{constructor(Z,F){super();this.scene=Z,this.camera=F,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,F,U){let W=Z.getContext(),G=Z.state;G.buffers.color.setMask(!1),G.buffers.depth.setMask(!1),G.buffers.color.setLocked(!0),G.buffers.depth.setLocked(!0);let R,w;if(this.inverse)R=0,w=1;else R=1,w=0;if(G.buffers.stencil.setTest(!0),G.buffers.stencil.setOp(W.REPLACE,W.REPLACE,W.REPLACE),G.buffers.stencil.setFunc(W.ALWAYS,R,4294967295),G.buffers.stencil.setClear(w),G.buffers.stencil.setLocked(!0),Z.setRenderTarget(U),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(F),this.clear)Z.clear();Z.render(this.scene,this.camera),G.buffers.color.setLocked(!1),G.buffers.depth.setLocked(!1),G.buffers.color.setMask(!0),G.buffers.depth.setMask(!0),G.buffers.stencil.setLocked(!1),G.buffers.stencil.setFunc(W.EQUAL,1,4294967295),G.buffers.stencil.setOp(W.KEEP,W.KEEP,W.KEEP),G.buffers.stencil.setLocked(!0)}}class H2 extends m{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class W2{constructor(Z,F){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),F===void 0){let U=Z.getSize(new w2);this._width=U.width,this._height=U.height,F=new q0(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:e2}),F.texture.name="EffectComposer.rt1"}else this._width=F.width,this._height=F.height;this.renderTarget1=F,this.renderTarget2=F.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Z2(t),this.copyPass.material.blending=Z0,this.timer=new $0}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,F){this.passes.splice(F,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let F=this.passes.indexOf(Z);if(F!==-1)this.passes.splice(F,1)}isLastEnabledPass(Z){for(let F=Z+1;F<this.passes.length;F++)if(this.passes[F].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let F=this.renderer.getRenderTarget(),U=!1;for(let W=0,G=this.passes.length;W<G;W++){let R=this.passes[W];if(R.enabled===!1)continue;if(R.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(W),R.render(this.renderer,this.writeBuffer,this.readBuffer,Z,U),R.needsSwap){if(U){let w=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(w.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(w.EQUAL,1,4294967295)}this.swapBuffers()}if(G2!==void 0){if(R instanceof G2)U=!0;else if(R instanceof H2)U=!1}}this.renderer.setRenderTarget(F)}reset(Z){if(Z===void 0){let F=this.renderer.getSize(new w2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=F.width,this._height=F.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,F){this._width=Z,this._height=F;let U=this._width*this._pixelRatio,W=this._height*this._pixelRatio;this.renderTarget1.setSize(U,W),this.renderTarget2.setSize(U,W);for(let G=0;G<this.passes.length;G++)this.passes[G].setSize(U,W)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as J0}from"three";var y2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new J0(0.0009765625,0.001953125)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`};class M2 extends Z2{constructor(){super(y2)}setSize(Z,F){this.material.uniforms.resolution.value.set(1/Z,1/F)}}import{ColorManagement as K0,RawShaderMaterial as Y0,UniformsUtils as I0,LinearToneMapping as Q0,ReinhardToneMapping as _0,CineonToneMapping as G0,AgXToneMapping as F0,ACESFilmicToneMapping as X0,NeutralToneMapping as j0,CustomToneMapping as N0,SRGBTransfer as O0}from"three";var $2={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class D2 extends m{constructor(){super();this.isOutputPass=!0,this.uniforms=I0.clone($2.uniforms),this.material=new Y0({name:$2.name,uniforms:this.uniforms,vertexShader:$2.vertexShader,fragmentShader:$2.fragmentShader}),this._fsQuad=new d(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,F,U){if(this.uniforms.tDiffuse.value=U.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},K0.getTransfer(this._outputColorSpace)===O0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===Q0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===_0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===G0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===X0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===F0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===j0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===N0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(F),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as C0}from"three";class B2 extends m{constructor(Z,F,U=null,W=null,G=null){super();this.scene=Z,this.camera=F,this.overrideMaterial=U,this.clearColor=W,this.clearAlpha=G,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new C0}render(Z,F,U){let W=Z.autoClear;Z.autoClear=!1;let G,R;if(this.overrideMaterial!==null)R=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)G=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:U),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(G);if(this.overrideMaterial!==null)this.scene.overrideMaterial=R;Z.autoClear=W}}import{AdditiveBlending as E0,Color as P2,HalfFloatType as L2,MeshBasicMaterial as V0,ShaderMaterial as F2,UniformsUtils as x2,Vector2 as i,Vector3 as q2,WebGLRenderTarget as R2}from"three";import{Color as U0}from"three";var S2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new U0(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class n extends m{constructor(Z,F=1,U,W){super();this.strength=F,this.radius=U,this.threshold=W,this.resolution=Z!==void 0?new i(Z.x,Z.y):new i(256,256),this.clearColor=new P2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let G=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);this.renderTargetBright=new R2(G,R,{type:L2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let a=new R2(G,R,{type:L2});a.texture.name="UnrealBloomPass.h"+u,a.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(a);let P=new R2(G,R,{type:L2});P.texture.name="UnrealBloomPass.v"+u,P.texture.generateMipmaps=!1,this.renderTargetsVertical.push(P),G=Math.round(G/2),R=Math.round(R/2)}let w=S2;this.highPassUniforms=x2.clone(w.uniforms),this.highPassUniforms.luminosityThreshold.value=W,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new F2({uniforms:this.highPassUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];G=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new i(1/G,1/R),G=Math.round(G/2),R=Math.round(R/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=F,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let J2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=J2,this.bloomTintColors=[new q2(1,1,1),new q2(1,1,1),new q2(1,1,1),new q2(1,1,1),new q2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=x2.clone(t.uniforms),this.blendMaterial=new F2({uniforms:this.copyUniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,premultipliedAlpha:!0,blending:E0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new P2,this._oldClearAlpha=1,this._basic=new V0,this._fsQuad=new d(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,F){let U=Math.round(Z/2),W=Math.round(F/2);this.renderTargetBright.setSize(U,W);for(let G=0;G<this.nMips;G++)this.renderTargetsHorizontal[G].setSize(U,W),this.renderTargetsVertical[G].setSize(U,W),this.separableBlurMaterials[G].uniforms.invSize.value=new i(1/U,1/W),U=Math.round(U/2),W=Math.round(W/2)}render(Z,F,U,W,G){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let R=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),G)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=U.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=U.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let w=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=w.texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),w=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,G)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(U),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=R}_getSeparableBlurMaterial(Z){let F=[],U=Z/3;for(let W=0;W<Z;W++)F.push(0.39894*Math.exp(-0.5*W*W/(U*U))/U);return new F2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new i(0.5,0.5)},direction:{value:new i(0.5,0.5)},gaussianCoefficients:{value:F}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(Z){return new F2({defines:{NUM_MIPS:Z},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}n.BlurDirectionX=new i(1,0);n.BlurDirectionY=new i(0,1);var k0=function(){function Z($){let J=$>>>0;return()=>{return J=J*1664525+1013904223>>>0,J/4294967296}}let F=`
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p) {
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * snoise(p); p *= 2.02; a *= 0.5; }
  return f;
}
`;function U($,J,K){let q=(S)=>S-Math.floor(S/289)*289,j=(S)=>q((S*34+1)*S),E=($+J+K)/3,Y=Math.floor($+E),O=Math.floor(J+E),X=Math.floor(K+E),D=(Y+O+X)/6,V=$-Y+D,C=J-O+D,M=K-X+D,L=V>=C?1:0,k=C>=M?1:0,v=M>=V?1:0,N=Math.min(L,1-v),H=Math.min(k,1-L),_=Math.min(v,1-k),B=Math.max(L,1-v),A=Math.max(k,1-L),b=Math.max(v,1-k),Q=[[V,C,M],[V-N+0.16666666666666666,C-H+0.16666666666666666,M-_+0.16666666666666666],[V-B+0.3333333333333333,C-A+0.3333333333333333,M-b+0.3333333333333333],[V-0.5,C-0.5,M-0.5]],f=q(Y),T=q(O),h=q(X),c=[0,N,B,1],o=[0,H,A,1],s=[0,_,b,1],K2=0.142857142857,y=0.285714285714,p=-0.9285714285715,x=0.142857142857,e=0;for(let S=0;S<4;S++){let k2=j(j(j(h+s[S])+T+o[S])+f+c[S]),j2=k2-49*Math.floor(k2*0.142857142857*0.142857142857),N2=Math.floor(j2*0.142857142857)*0.285714285714+-0.9285714285715,O2=Math.floor(j2-7*Math.floor(j2*0.142857142857))*0.285714285714+-0.9285714285715,v2=1-Math.abs(N2)-Math.abs(O2),f2=v2<=0?-1:0,Y2=N2+(Math.floor(N2)*2+1)*f2,I2=O2+(Math.floor(O2)*2+1)*f2,Q2=v2,C2=1.79284291400159-0.85373472095314*(Y2*Y2+I2*I2+Q2*Q2);Y2*=C2,I2*=C2,Q2*=C2;let[U2,E2,V2]=Q[S],_2=Math.max(0.6-(U2*U2+E2*E2+V2*V2),0);_2*=_2,e+=_2*_2*(Y2*U2+I2*E2+Q2*V2)}return 42*e}function W($){$=$||{};let J=$.count||4500,K=$.innerR||600,q=$.outerR||1000,j={uTime:{value:0}},E=new I.BufferGeometry,Y=new Float32Array(J*3),O=new Float32Array(J*3),X=new Float32Array(J),D=new Float32Array(J);for(let C=0;C<J;C++){let M=K+Math.random()*(q-K),L=Math.random()*Math.PI*2,k=Math.acos(2*Math.random()-1);Y[C*3]=M*Math.sin(k)*Math.cos(L),Y[C*3+1]=M*Math.sin(k)*Math.sin(L),Y[C*3+2]=M*Math.cos(k);let v=Math.random(),N=v<0.7?[1,1,1]:v<0.85?[1,0.92,0.78]:[0.78,0.86,1];O[C*3]=N[0],O[C*3+1]=N[1],O[C*3+2]=N[2],X[C]=Math.random()<0.05?5.5:1.5+Math.random()*2,D[C]=Math.random()*Math.PI*2}E.setAttribute("position",new I.BufferAttribute(Y,3)),E.setAttribute("color",new I.BufferAttribute(O,3)),E.setAttribute("size",new I.BufferAttribute(X,1)),E.setAttribute("phase",new I.BufferAttribute(D,1));let V=new I.ShaderMaterial({uniforms:j,vertexColors:!0,transparent:!0,depthWrite:!1,blending:I.AdditiveBlending,vertexShader:`
        attribute float size; attribute float phase;
        uniform float uTime; varying vec3 vColor; varying float vTwinkle;
        void main() {
          vColor = color;
          vTwinkle = 0.65 + 0.35 * sin(uTime * 1.7 + phase);
          gl_PointSize = size * (0.85 + 0.3 * sin(uTime * 2.3 + phase * 1.7));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,fragmentShader:`
        varying vec3 vColor; varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = (1.0 - smoothstep(0.0, 0.5, d)) * vTwinkle * 0.9;
          gl_FragColor = vec4(vColor, a);
        }`});return{points:new I.Points(E,V),uniforms:j}}function G($,J,K,q,j){return new I.Mesh(new I.SphereGeometry($,64,64),new I.ShaderMaterial({transparent:!0,side:I.BackSide,blending:I.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new I.Color(J)},b:{value:K},e:{value:q},m:{value:j}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function R($){let J=new I.Group,K={uOutputScale:{value:1},uTime:{value:0}},q=new I.Mesh(new I.SphereGeometry($,64,64),new I.ShaderMaterial({uniforms:K,vertexShader:`
          varying vec3 vPos; varying vec3 vN;
          void main() {
            vPos = position; vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,fragmentShader:F+`
          varying vec3 vPos; varying vec3 vN; uniform float uOutputScale; uniform float uTime;
          void main() {
            vec3 p = normalize(vPos);
            float n1 = fbm(p * 3.5 + vec3(uTime * 0.04, uTime * 0.03, -uTime * 0.02));
            float n2 = fbm(p * 9.0 - vec3(uTime * 0.06, 0.0, uTime * 0.05));
            float v = clamp(0.5 + n1 * 0.55 + n2 * 0.35, 0.0, 1.0);
            vec3 deep = vec3(0.82, 0.28, 0.02);
            vec3 mid  = vec3(1.00, 0.62, 0.12);
            vec3 hot  = vec3(1.00, 0.95, 0.74);
            vec3 col = mix(deep, mid, smoothstep(0.18, 0.55, v));
            col = mix(col, hot, smoothstep(0.55, 0.92, v));
            float limb = clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
            col *= 0.5 + 0.7 * limb;
            // Keep this custom emissive shader in the same HDR range as the
            // r155-migrated direct lights so its hottest regions still bloom.
            gl_FragColor = vec4(col * 1.45 * uOutputScale, 1.0);
          }`})),j=G($*1.08,16759376,0.7,2,1),E=G($*1.45,16747056,0.55,3,0.6);return J.add(q,j,E),{group:J,core:q,inner:j,corona:E,uniforms:K}}function w($){let J={uIntensity:{value:1},uSunDir:{value:new I.Vector3(-1,0,0)}},K=80.65*Math.PI/180,q=72.68*Math.PI/180;J.uMagNorth={value:new I.Vector3(Math.cos(K)*Math.cos(q),Math.sin(K),Math.cos(K)*Math.sin(q)).normalize()};let j=0.4,E=0.072,Y=0.028,O=1.2,X=0.21,D=0.59,V=512,C=96,M=J.uMagNorth.value,L=new I.Vector3().crossVectors(M,new I.Vector3(0,0,1)).normalize(),k=new I.Vector3().crossVectors(M,L).normalize(),v=(A,b,Q)=>{let f=0,T=0.5;for(let h=0;h<3;h++)f+=T*U(A,b,Q),A*=2.02,b*=2.02,Q*=2.02,T*=0.5;return f},N=new Uint8Array(V*C),H=new I.Vector3;for(let A=0;A<C;A++){let b=X+(A+0.5)/C*(D-X);for(let Q=0;Q<V;Q++){let f=(Q+0.5)/V*Math.PI*2-Math.PI;H.copy(M).multiplyScalar(Math.cos(b)).addScaledVector(L,Math.sin(b)*Math.cos(f)).addScaledVector(k,Math.sin(b)*Math.sin(f));let T=Y*U(H.x*3.2,H.y*3.2,H.z*3.2),h=Math.exp(-(((b-j-T)/E)**2)),c=0.5+0.5*Math.sin(f*16+v(H.x*4.6,H.y*4.6,H.z*4.6)*3);c=Math.max(c,0)**1.8;let o=0.62+0.38*v(H.x*6.2,H.y*6.2,H.z*6.2),s=h*(0.32+0.68*c)*o;N[A*V+Q]=Math.round(Math.sqrt(Math.min(Math.max(s/O,0),1))*255)}}let _=new I.DataTexture(N,V,C,I.RedFormat);_.wrapS=I.RepeatWrapping,_.wrapT=I.ClampToEdgeWrapping,_.magFilter=I.LinearFilter,_.minFilter=I.LinearFilter,_.needsUpdate=!0,J.uPattern={value:_};let B=new I.Mesh(new I.SphereGeometry($,64,48),new I.ShaderMaterial({uniforms:J,transparent:!0,depthWrite:!1,blending:I.AdditiveBlending,side:I.FrontSide,vertexShader:`
          varying vec3 vPos;
          varying vec3 vViewN;
          varying vec3 vWorldN;
          void main() {
            vPos = position;
            vViewN = normalize(normalMatrix * normal);
            vWorldN = normalize(mat3(modelMatrix) * position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,fragmentShader:`
          varying vec3 vPos;
          varying vec3 vViewN;
          varying vec3 vWorldN;
          uniform vec3 uMagNorth;
          uniform vec3 uSunDir;
          uniform float uIntensity;
          uniform sampler2D uPattern;

          // Quiet oval ~23° from each magnetic pole and ~8° thick. Its small
          // irregularities are fixed to Earth and pre-baked into uPattern;
          // a single slow intensity envelope supplies the storm response
          // without per-pixel shimmer.
          const float COLAT_MIN = 0.21;
          const float COLAT_MAX = 0.59;
          const float CUTOFF = 0.008;
          // patches peaks a little above 1 because fbm3 is not normalised.
          const float PATCH_MAX = 1.2;

          void main() {
            vec3 p = normalize(vPos);
            vec3 magN = normalize(uMagNorth);
            float magColat = acos(clamp(abs(dot(p, magN)), 0.0, 1.0));
            // Everything the baked pattern can light sits inside this
            // colatitude ring; the rest of the shell pays nothing.
            if (magColat <= COLAT_MIN || magColat >= COLAT_MAX) discard;
            float night = 1.0 - smoothstep(-0.06, 0.18, dot(normalize(vWorldN), normalize(uSunDir)));
            float limb = 0.4 + 0.6 * pow(1.0 - abs(dot(normalize(vViewN), vec3(0.0, 0.0, 1.0))), 1.35);
            float envelope = night * limb * uIntensity;
            if (envelope * PATCH_MAX < CUTOFF) discard;

            vec3 magRef = normalize(cross(magN, vec3(0.0, 0.0, 1.0)));
            vec3 magE = normalize(cross(magN, magRef));
            float magLon = atan(dot(p, magE), dot(p, magRef));

            float shape = texture2D(uPattern, vec2(
              magLon / 6.28318530718 + 0.5,
              (magColat - COLAT_MIN) / (COLAT_MAX - COLAT_MIN)
            )).r;
            shape = shape * shape * PATCH_MAX;

            float glow = shape * envelope;

            float hue = clamp((magColat - 0.30) / 0.18, 0.0, 1.0);
            vec3 red = vec3(0.95, 0.20, 0.28);
            vec3 green = vec3(0.18, 1.0, 0.42);
            vec3 violet = vec3(0.52, 0.28, 1.0);
            vec3 col = mix(red, green, smoothstep(0.12, 0.55, hue));
            col = mix(col, violet, smoothstep(0.78, 1.0, hue) * 0.4);

            // Keep the surface output stable when adaptive quality enables or
            // disables bloom. The additive blend already reads as a glow.
            gl_FragColor = vec4(col * glow * 1.1, glow);
          }`}));return B.renderOrder=1,{mesh:B,uniforms:J}}function z($,J,K){K=K||{};let q={target:K.target?K.target.clone():new I.Vector3(0,0,0),azimuth:K.azimuth!=null?K.azimuth:0.3,elevation:K.elevation!=null?K.elevation:0.2,distance:K.distance!=null?K.distance:11,interacting:!1};q.azimuthTarget=q.azimuth,q.elevationTarget=q.elevation,q.distanceTarget=q.distance;let j=K.minDistance!=null?K.minDistance:3,E=typeof K.maxDistance==="function"?K.maxDistance:()=>K.maxDistance!=null?K.maxDistance:55,Y=K.zoomSpeed!=null?K.zoomSpeed:0.012,O=K.zoomDistanceScale!=null?K.zoomDistanceScale:0,X=K.damping!=null?K.damping:0.12,D=K.distanceDamping!=null?K.distanceDamping:X,V=K.onPick,C=K.pickThreshold!=null?K.pickThreshold:6,M=Math.PI/2-0.05;function L(){$.position.set(q.target.x+q.distance*Math.cos(q.elevation)*Math.sin(q.azimuth),q.target.y+q.distance*Math.sin(q.elevation),q.target.z+q.distance*Math.cos(q.elevation)*Math.cos(q.azimuth)),$.lookAt(q.target)}L();let k=!1,v=0,N=0,H=0;J.addEventListener("mousedown",(Q)=>{k=!0,q.interacting=!0,v=0,N=Q.clientX,H=Q.clientY}),window.addEventListener("mousemove",(Q)=>{if(!k)return;let f=Q.clientX-N,T=Q.clientY-H;v+=Math.abs(f)+Math.abs(T),q.azimuthTarget-=f*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-M,M),N=Q.clientX,H=Q.clientY}),window.addEventListener("mouseup",(Q)=>{if(k&&V&&v<C)V(Q.clientX,Q.clientY);k=!1,q.interacting=!1}),window.addEventListener("mouseleave",()=>{k=!1,q.interacting=!1}),J.addEventListener("wheel",(Q)=>{q.distanceTarget+=Q.deltaY*Y*(1+q.distance*O),q.distanceTarget=g(q.distanceTarget,j,E()),Q.preventDefault()},{passive:!1});let _=null,B=null,A=null,b=0;return J.addEventListener("touchstart",(Q)=>{if(q.interacting=Q.touches.length>0,Q.touches.length===1)_={x:Q.touches[0].clientX,y:Q.touches[0].clientY},A={x:Q.touches[0].clientX,y:Q.touches[0].clientY},b=0;else if(Q.touches.length===2){let f=Q.touches[0].clientX-Q.touches[1].clientX,T=Q.touches[0].clientY-Q.touches[1].clientY;B=Math.hypot(f,T),A=null}},{passive:!0}),J.addEventListener("touchmove",(Q)=>{if(Q.touches.length===1&&_){let f=Q.touches[0].clientX-_.x,T=Q.touches[0].clientY-_.y;b+=Math.abs(f)+Math.abs(T),q.azimuthTarget-=f*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-M,M),_={x:Q.touches[0].clientX,y:Q.touches[0].clientY},Q.preventDefault()}else if(Q.touches.length===2&&B){let f=Q.touches[0].clientX-Q.touches[1].clientX,T=Q.touches[0].clientY-Q.touches[1].clientY,h=Math.hypot(f,T);q.distanceTarget*=B/h,q.distanceTarget=g(q.distanceTarget,j,E()),B=h,Q.preventDefault()}},{passive:!1}),J.addEventListener("touchend",(Q)=>{if(Q.touches.length===0&&V&&A&&b<10)V(A.x,A.y);_=Q.touches.length===1?{x:Q.touches[0].clientX,y:Q.touches[0].clientY}:null,B=null,A=null,q.interacting=Q.touches.length>0}),J.addEventListener("touchcancel",()=>{_=null,B=null,A=null,b=0,q.interacting=!1}),q.maxDistance=E,q.update=function(){q.azimuth+=(q.azimuthTarget-q.azimuth)*X,q.elevation+=(q.elevationTarget-q.elevation)*X,q.distanceTarget=g(q.distanceTarget,j,E()),q.distance+=(q.distanceTarget-q.distance)*D,L()},q}function J2($){let J=$.renderer,K=$.composer||null,q=$.bloomPass||null,j=$.fxaaPass||null,E=Boolean(globalThis.taQa),Y=$.shadowLight||null,O=Math.min(window.devicePixelRatio||1,2),X=[O,Math.min(O,1.5),Math.min(O,1.25),Math.min(O,1)],D=[2048,2048,1024,512],V=1,C=18,M=24,L=1500,k=0.75,v=performance.now()+L,N=0,H=16,_=0,B=0,A=0,b=6,Q=-1/0,f=12000,T=600,h=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},c=O,o=h.width,s=h.height;function K2(){let y=X[N],{width:p,height:x}=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},e=y!==c,S=p!==o||x!==s;if(e){if(J.setPixelRatio(y),K)K.setPixelRatio(y)}if(S){if(J.setSize(p,x),K)K.setSize(p,x)}if((e||S)&&j&&typeof j.setSize==="function"&&!K)j.setSize(p*y,x*y);if(c=y,o=p,s=x,q)q.enabled=N<2;if(Y&&Y.shadow&&Y.shadow.mapSize.x!==D[N]){if(Y.shadow.mapSize.set(D[N],D[N]),Y.shadow.map)Y.shadow.map.dispose(),Y.shadow.map=null}}return{frame(y,p=!1){if(E)return;if(!(y>0)||y>V)return;let x=performance.now();if(p||x<v){H=16,A=0,B=0;return}if(H=H*0.95+y*1000*0.05,x<_)return;if(H>M&&N<3){if(A+=y,B=0,A>k){if(x-Q<f)b=Math.min(b*4,T);N++,K2(),_=x+4000,A=0}return}if(A=0,H<C&&N>0){if(B+=y,B>b)N--,K2(),Q=x,_=x+4000,B=0}else B=0},setShadowLight(y){Y=y||null,K2()},get tier(){return N}}}function u($){if($.altKey||$.ctrlKey||$.metaKey)return!0;let J=$.target;return!!(J&&J.closest&&J.closest("input, select, textarea, [contenteditable], dialog[open]"))}function a($,J){J=J||{};let K=J.rotateStep!=null?J.rotateStep:0.08,q=J.elevateStep!=null?J.elevateStep:0.06,j=J.minDistance!=null?J.minDistance:1.5,E=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,Y=Math.PI/2-0.05;window.addEventListener("keydown",(O)=>{if(u(O))return;let X=!0;switch(O.key){case"ArrowLeft":$.azimuthTarget+=K;break;case"ArrowRight":$.azimuthTarget-=K;break;case"ArrowUp":$.elevationTarget=g($.elevationTarget+q,-Y,Y);break;case"ArrowDown":$.elevationTarget=g($.elevationTarget-q,-Y,Y);break;case"+":case"=":$.distanceTarget=g($.distanceTarget*0.9,j,E());break;case"-":case"_":$.distanceTarget=g($.distanceTarget*1.12,j,E());break;default:X=!1}if(X)O.preventDefault()})}let P,r=null;function g2($,J,K,q,j){if(!P)P=new I.Vector3;if($.getWorldPosition(P),P.project(K),!j||P.z<-1||P.z>1||Math.abs(P.x)>1.1||Math.abs(P.y)>1.1){J.style.opacity=0,J.style.display="none";return}J.style.display="",J.style.transform="translate(-50%, -50%) translate("+(P.x*0.5+0.5)*(r?r.width:window.innerWidth)+"px, "+((P.y*-0.5+0.5)*(r?r.height:window.innerHeight)+q)+"px)",J.style.opacity=1}function l($,J){let K=document.getElementById("loader");if(l.clearPassing)l.clearPassing();if(!K||K.classList.contains("loader-failed"))return null;let q=K.querySelector(".loader-text"),j=K.querySelector(".loader-bar"),E=q?q.textContent:"";if(K.classList.add("loader-failed"),K.removeAttribute("aria-hidden"),K.setAttribute("role","alert"),q)q.textContent=$;if(j)j.hidden=!0;let Y=null;if(J&&J.reload&&q&&q.parentNode)Y=document.createElement("button"),Y.type="button",Y.className="scene-nav-btn",Y.textContent="Reload",Y.addEventListener("click",()=>location.reload()),q.parentNode.appendChild(Y);let O=!0,X=()=>{if(!O)return;if(O=!1,l.clearPassing===X)l.clearPassing=null;if(Y)Y.remove();if(q)q.textContent=E;if(j)j.hidden=!1;if(K.setAttribute("role","status"),K.classList.remove("loader-failed"),K.classList.contains("hidden"))K.setAttribute("aria-hidden","true")};if(J&&J.passing)l.clearPassing=X;return X}function X2($){if(l("This device cannot run the 3D view. Try another browser, or turn on hardware acceleration."),$)console.error($)}function u2($){let J=null,K=null;$.addEventListener("webglcontextlost",()=>{clearTimeout(J),J=setTimeout(()=>{K=l("The 3D view stopped. Reload the page to start it again.",{reload:!0})},3000)}),$.addEventListener("webglcontextrestored",()=>{if(clearTimeout(J),K)K();K=null})}function A2($){let J=null;try{J=new I.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...$||{}})}catch(K){return X2(K),null}if(!J.getContext())return X2(Error("WebGL context unavailable")),null;return u2(J.domElement),J}function h2($){$=$||{};let J=document.getElementById($.containerId||"canvas-container"),K=()=>({width:$.sizeToContainer?Math.max(1,J.clientWidth):window.innerWidth,height:$.sizeToContainer?Math.max(1,J.clientHeight):window.innerHeight}),q=K(),j=new I.Scene;j.background=new I.Color($.background!=null?$.background:329744);let E=new I.PerspectiveCamera($.fov!=null?$.fov:45,q.width/q.height,$.near!=null?$.near:0.1,$.far!=null?$.far:2000),Y=A2({alpha:!1,antialias:!1});if(!Y)return null;if(Y.setSize(q.width,q.height),Y.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),$.shadowMap)Y.shadowMap.enabled=!0,Y.shadowMap.type=$.shadowMapType??I.PCFShadowMap;if(Y.outputColorSpace=I.SRGBColorSpace,Y.toneMapping=I.ACESFilmicToneMapping,Y.toneMappingExposure=1.1,$.canvasLabel){let _=document.getElementById($.canvasDescriptionId);if(!_)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");Y.domElement.setAttribute("tabindex","0"),Y.domElement.setAttribute("role","img"),Y.domElement.setAttribute("aria-label",$.canvasLabel),Y.domElement.setAttribute("aria-describedby",_.id)}else Y.domElement.setAttribute("aria-hidden","true");J.appendChild(Y.domElement);let O=B0(),X=null,D=null,V=null;if($.composer!==!1)try{X=new W2(Y),X.addPass(new B2(j,E));let _=$.bloom||{};D=new n(new I.Vector2(window.innerWidth,window.innerHeight),_.strength!=null?_.strength:0.55,_.radius!=null?_.radius:0.4,_.threshold!=null?_.threshold:1.35*Math.PI),X.addPass(D),X.addPass(new D2),V=new M2,X.addPass(V)}catch(_){console.warn("Post-processing unavailable, falling back to direct render.",_),X=null}let C={width:q.width,height:q.height};r=C;let M=J2({getSize:()=>C,bloomPass:D,composer:X,fxaaPass:V,renderer:Y,shadowLight:$.shadowLight||null});function L(){let{width:_,height:B}=K();if(_===C.width&&($.sizeToContainer?B===C.height:Math.abs(B-C.height)<120))return;if(C.width=_,C.height=B,E.aspect=_/B,E.updateProjectionMatrix(),Y.setSize(_,B),X)X.setSize(_,B)}let k=!1,v=()=>{k=!0};if(window.addEventListener("resize",v),$.sizeToContainer)new ResizeObserver(v).observe(J);function N(){if(k){if(k=!1,L(),$.onResize)$.onResize()}if(X)X.render();else Y.render(j,E)}let H={accessibility:O,bloomPass:D,camera:E,composer:X,fxaaPass:V,quality:M,render:N,renderer:Y,resize:L,scene:j};if(/[?&]diag=1\b/.test(window.location.search))m2(H);return H}function m2($){let J=$.renderer,K=J.domElement,q=[],j=performance.now(),E=()=>+((performance.now()-j)/1000).toFixed(2),Y=document.createElement("div");Y.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(Y);let O=0,X=0,D=$.quality.tier,V=K.width,C=K.height;function M(N,H){q.push({t:E(),kind:N,...H}),Y.textContent="RENDER DIAG · "+q.length+` events · D dumps JSON · C clears
`+q.slice(-14).reverse().map((_)=>_.t.toFixed(2)+"s  "+_.kind+"  "+Object.entries(_).filter(([B])=>B!=="t"&&B!=="kind").map(([B,A])=>B+"="+A).join(" ")).join(`
`)}let L=J.setSize.bind(J);J.setSize=function(N,H,_){return M("renderer.setSize",{w:N,h:H,pr:+J.getPixelRatio().toFixed(2)}),L(N,H,_)};let k=J.setPixelRatio.bind(J);if(J.setPixelRatio=function(N){return M("setPixelRatio",{pr:+N.toFixed(2)}),k(N)},$.composer){let N=$.composer.setSize.bind($.composer);$.composer.setSize=function(H,_){return M("composer.setSize",{w:H,h:_}),N(H,_)}}M("start",{dpr:window.devicePixelRatio||1,canvas:K.width+"x"+K.height,bloom:$.bloomPass?$.bloomPass.enabled:"none"});let v=performance.now();(function N(){requestAnimationFrame(N);let H=performance.now(),_=H-v;if(v=H,X++,_>45&&_<1000)M("long frame",{ms:+_.toFixed(1),tier:$.quality.tier});if(_>O&&_<1000)O=_;if($.quality.tier!==D)M("QUALITY TIER",{from:D,to:$.quality.tier,bloom:$.bloomPass?$.bloomPass.enabled:"none"}),D=$.quality.tier;if(K.width!==V||K.height!==C)M("CANVAS RESIZED",{from:V+"x"+C,to:K.width+"x"+K.height}),V=K.width,C=K.height})(),window.addEventListener("keydown",(N)=>{if(N.key==="d"||N.key==="D"){let H=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:K.width+"x"+K.height,frames:X,worstFrameMs:+O.toFixed(1),tier:$.quality.tier,events:q},null,1);if(console.log(H),navigator.clipboard)navigator.clipboard.writeText(H);M("dumped",{events:q.length,toClipboard:!!navigator.clipboard})}if(N.key==="c"||N.key==="C")q.length=0,O=0,M("cleared",{})}),window.__diag={events:q,setup:$}}let l2='<path d="M2 1 L10 6 L2 11 Z"/>',c2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function p2($,J,K){function q(){J.innerHTML=K.playing?c2:l2,$.setAttribute("aria-label",K.playing?"Pause simulation":"Play simulation")}return $.addEventListener("click",()=>{K.playing=!K.playing,q()}),q(),q}function i2($,J){let K=!1,q=document.getElementById("loader"),j=q?q.querySelector(".loader-bar"):null,E=j?j.querySelector(".loader-bar-fill"):null,Y=0;function O(D,V){if(!j||!(V>0))return;if(Y=Math.max(Y,g(D/V,0,1)),j.setAttribute("aria-valuenow",String(Math.round(Y*100))),E)E.style.transform="scaleX("+Y.toFixed(3)+")"}function X(){if(K)return;if(K=!0,O(1,1),q){if(q.classList.add("hidden"),!q.classList.contains("loader-failed"))q.setAttribute("aria-hidden","true")}}if($)$.onLoad=X,$.onProgress=(D,V,C)=>O(V,C);return window.setTimeout(X,J!=null?J:5000),X.progress=O,X}function d2($,J){J=J||{};let K=J.turnStep!=null?J.turnStep:0.35,q=J.zoomFactor!=null?J.zoomFactor:0.8,j=J.minDistance!=null?J.minDistance:1.5,E=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,Y=document.createElement("div");Y.className="view-pad",Y.setAttribute("role","group"),Y.setAttribute("aria-label",J.label||"View controls");function O(D,V,C,M){let L=document.createElement("button");return L.type="button",L.className="view-pad-btn "+D,L.setAttribute("aria-label",C),L.innerHTML='<span aria-hidden="true">'+V+"</span>",L.addEventListener("click",M),Y.appendChild(L),L}O("view-pad-left","‹","Turn left",()=>{$.azimuthTarget+=K}),O("view-pad-right","›","Turn right",()=>{$.azimuthTarget-=K}),O("view-pad-in","+","Zoom in",()=>{$.distanceTarget=g($.distanceTarget*q,j,E())}),O("view-pad-out","−","Zoom out",()=>{$.distanceTarget=g($.distanceTarget/q,j,E())});let X=null;if(J.onRecenter)X=O("view-pad-recenter","⌖","Recenter the view",J.onRecenter),X.hidden=!0;return(J.parent||document.body).appendChild(Y),{element:Y,setRecenter(D,V){if(!X)return;if(D)X.setAttribute("aria-label",D);X.hidden=!V,Y.classList.toggle("has-recenter",!!V)}}}return{bindCameraKeys:a,createFrameLoop:H0,buildNav:W0,clamp:g,createAurora:w,createLoader:i2,createOrbitControls:z,createQualityGovernor:J2,createRenderer:A2,createScene:h2,createStarfield:W,createSun:R,createViewPad:d2,failWebGL:X2,GLSL_NOISE:F,glowShell:G,ignoresSceneKeys:u,initMobileHints:M0,initMobileInfoPanels:D0,prefersReducedMotion:L0,projectToScreen:g2,revealRailButton:R0,seededRandom:Z,setText:A0,showSceneNotice:l,wirePlayPause:p2}}();window.SPACE=k0;window.THREE=I;export{I as THREE,k0 as SPACE};
