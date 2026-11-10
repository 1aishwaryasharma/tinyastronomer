import{createFrameLoop as H0,buildNav as W0,clamp as g,initMobileHints as M0,initMobileInfoPanels as D0,initSceneAccessibility as B0,prefersReducedMotion as L0,revealRailButton as R0,setText as A0}from"./chrome.js?v=20261008-1";import*as Y from"three";import{HalfFloatType as e2,NoBlending as Z0,Timer as $0,Vector2 as w2,WebGLRenderTarget as q0}from"three";var s={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};import{ShaderMaterial as T2,UniformsUtils as r2}from"three";import{BufferGeometry as d2,Float32BufferAttribute as b2,OrthographicCamera as o2,Mesh as s2}from"three";class m{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var t2=new o2(-1,1,1,-1,0,1);class z2 extends d2{constructor(){super();this.setAttribute("position",new b2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new b2([0,2,0,0,2,0],2))}}var a2=new z2;class i{constructor(Z){this._mesh=new s2(a2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,t2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class e extends m{constructor(Z,G="tDiffuse"){super();if(this.textureID=G,this.uniforms=null,this.material=null,Z instanceof T2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=r2.clone(Z.uniforms),this.material=new T2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new i(this.material)}render(Z,G,U){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=U.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(G),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class N2 extends m{constructor(Z,G){super();this.scene=Z,this.camera=G,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,G,U){let W=Z.getContext(),_=Z.state;_.buffers.color.setMask(!1),_.buffers.depth.setMask(!1),_.buffers.color.setLocked(!0),_.buffers.depth.setLocked(!0);let R,w;if(this.inverse)R=0,w=1;else R=1,w=0;if(_.buffers.stencil.setTest(!0),_.buffers.stencil.setOp(W.REPLACE,W.REPLACE,W.REPLACE),_.buffers.stencil.setFunc(W.ALWAYS,R,4294967295),_.buffers.stencil.setClear(w),_.buffers.stencil.setLocked(!0),Z.setRenderTarget(U),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(G),this.clear)Z.clear();Z.render(this.scene,this.camera),_.buffers.color.setLocked(!1),_.buffers.depth.setLocked(!1),_.buffers.color.setMask(!0),_.buffers.depth.setMask(!0),_.buffers.stencil.setLocked(!1),_.buffers.stencil.setFunc(W.EQUAL,1,4294967295),_.buffers.stencil.setOp(W.KEEP,W.KEEP,W.KEEP),_.buffers.stencil.setLocked(!0)}}class V2 extends m{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class H2{constructor(Z,G){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),G===void 0){let U=Z.getSize(new w2);this._width=U.width,this._height=U.height,G=new q0(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:e2}),G.texture.name="EffectComposer.rt1"}else this._width=G.width,this._height=G.height;this.renderTarget1=G,this.renderTarget2=G.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new e(s),this.copyPass.material.blending=Z0,this.timer=new $0}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,G){this.passes.splice(G,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let G=this.passes.indexOf(Z);if(G!==-1)this.passes.splice(G,1)}isLastEnabledPass(Z){for(let G=Z+1;G<this.passes.length;G++)if(this.passes[G].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let G=this.renderer.getRenderTarget(),U=!1;for(let W=0,_=this.passes.length;W<_;W++){let R=this.passes[W];if(R.enabled===!1)continue;if(R.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(W),R.render(this.renderer,this.writeBuffer,this.readBuffer,Z,U),R.needsSwap){if(U){let w=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(w.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(w.EQUAL,1,4294967295)}this.swapBuffers()}if(N2!==void 0){if(R instanceof N2)U=!0;else if(R instanceof V2)U=!1}}this.renderer.setRenderTarget(G)}reset(Z){if(Z===void 0){let G=this.renderer.getSize(new w2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=G.width,this._height=G.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,G){this._width=Z,this._height=G;let U=this._width*this._pixelRatio,W=this._height*this._pixelRatio;this.renderTarget1.setSize(U,W),this.renderTarget2.setSize(U,W);for(let _=0;_<this.passes.length;_++)this.passes[_].setSize(U,W)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as J0}from"three";var S2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new J0(0.0009765625,0.001953125)}},vertexShader:`

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

		}`};class W2 extends e{constructor(){super(S2)}setSize(Z,G){this.material.uniforms.resolution.value.set(1/Z,1/G)}}import{ColorManagement as K0,RawShaderMaterial as Y0,UniformsUtils as I0,LinearToneMapping as Q0,ReinhardToneMapping as N0,CineonToneMapping as _0,AgXToneMapping as G0,ACESFilmicToneMapping as F0,NeutralToneMapping as X0,CustomToneMapping as j0,SRGBTransfer as O0}from"three";var Z2={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class M2 extends m{constructor(){super();this.isOutputPass=!0,this.uniforms=I0.clone(Z2.uniforms),this.material=new Y0({name:Z2.name,uniforms:this.uniforms,vertexShader:Z2.vertexShader,fragmentShader:Z2.fragmentShader}),this._fsQuad=new i(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,G,U){if(this.uniforms.tDiffuse.value=U.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},K0.getTransfer(this._outputColorSpace)===O0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===Q0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===N0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===_0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===F0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===G0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===X0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===j0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(G),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as C0}from"three";class D2 extends m{constructor(Z,G,U=null,W=null,_=null){super();this.scene=Z,this.camera=G,this.overrideMaterial=U,this.clearColor=W,this.clearAlpha=_,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new C0}render(Z,G,U){let W=Z.autoClear;Z.autoClear=!1;let _,R;if(this.overrideMaterial!==null)R=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)_=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:U),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(_);if(this.overrideMaterial!==null)this.scene.overrideMaterial=R;Z.autoClear=W}}import{AdditiveBlending as E0,Color as P2,HalfFloatType as B2,MeshBasicMaterial as V0,ShaderMaterial as _2,UniformsUtils as x2,Vector2 as p,Vector3 as $2,WebGLRenderTarget as L2}from"three";import{Color as U0}from"three";var y2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new U0(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class n extends m{constructor(Z,G=1,U,W){super();this.strength=G,this.radius=U,this.threshold=W,this.resolution=Z!==void 0?new p(Z.x,Z.y):new p(256,256),this.clearColor=new P2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let _=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);this.renderTargetBright=new L2(_,R,{type:B2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let t=new L2(_,R,{type:B2});t.texture.name="UnrealBloomPass.h"+u,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let P=new L2(_,R,{type:B2});P.texture.name="UnrealBloomPass.v"+u,P.texture.generateMipmaps=!1,this.renderTargetsVertical.push(P),_=Math.round(_/2),R=Math.round(R/2)}let w=y2;this.highPassUniforms=x2.clone(w.uniforms),this.highPassUniforms.luminosityThreshold.value=W,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new _2({uniforms:this.highPassUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];_=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new p(1/_,1/R),_=Math.round(_/2),R=Math.round(R/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=G,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let q2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=q2,this.bloomTintColors=[new $2(1,1,1),new $2(1,1,1),new $2(1,1,1),new $2(1,1,1),new $2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=x2.clone(s.uniforms),this.blendMaterial=new _2({uniforms:this.copyUniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,premultipliedAlpha:!0,blending:E0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new P2,this._oldClearAlpha=1,this._basic=new V0,this._fsQuad=new i(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,G){let U=Math.round(Z/2),W=Math.round(G/2);this.renderTargetBright.setSize(U,W);for(let _=0;_<this.nMips;_++)this.renderTargetsHorizontal[_].setSize(U,W),this.renderTargetsVertical[_].setSize(U,W),this.separableBlurMaterials[_].uniforms.invSize.value=new p(1/U,1/W),U=Math.round(U/2),W=Math.round(W/2)}render(Z,G,U,W,_){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let R=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),_)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=U.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=U.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let w=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=w.texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),w=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,_)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(U),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=R}_getSeparableBlurMaterial(Z){let G=[],U=Z/3;for(let W=0;W<Z;W++)G.push(0.39894*Math.exp(-0.5*W*W/(U*U))/U);return new _2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new p(0.5,0.5)},direction:{value:new p(0.5,0.5)},gaussianCoefficients:{value:G}},vertexShader:`

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

				}`})}_getCompositeMaterial(Z){return new _2({defines:{NUM_MIPS:Z},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

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

				}`})}}n.BlurDirectionX=new p(1,0);n.BlurDirectionY=new p(0,1);var k0=function(){function Z($){let J=$>>>0;return()=>{return J=J*1664525+1013904223>>>0,J/4294967296}}let G=`
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
`;function U($,J,K){let q=(y)=>y-Math.floor(y/289)*289,X=(y)=>q((y*34+1)*y),E=($+J+K)/3,I=Math.floor($+E),F=Math.floor(J+E),j=Math.floor(K+E),D=(I+F+j)/6,V=$-I+D,C=J-F+D,M=K-j+D,L=V>=C?1:0,k=C>=M?1:0,v=M>=V?1:0,O=Math.min(L,1-v),H=Math.min(k,1-L),N=Math.min(v,1-k),B=Math.max(L,1-v),A=Math.max(k,1-L),b=Math.max(v,1-k),Q=[[V,C,M],[V-O+0.16666666666666666,C-H+0.16666666666666666,M-N+0.16666666666666666],[V-B+0.3333333333333333,C-A+0.3333333333333333,M-b+0.3333333333333333],[V-0.5,C-0.5,M-0.5]],f=q(I),T=q(F),h=q(j),c=[0,O,B,1],d=[0,H,A,1],o=[0,N,b,1],J2=0.142857142857,S=0.285714285714,l=-0.9285714285715,x=0.142857142857,r=0;for(let y=0;y<4;y++){let k2=X(X(X(h+o[y])+T+d[y])+f+c[y]),F2=k2-49*Math.floor(k2*0.142857142857*0.142857142857),X2=Math.floor(F2*0.142857142857)*0.285714285714+-0.9285714285715,j2=Math.floor(F2-7*Math.floor(F2*0.142857142857))*0.285714285714+-0.9285714285715,v2=1-Math.abs(X2)-Math.abs(j2),f2=v2<=0?-1:0,K2=X2+(Math.floor(X2)*2+1)*f2,Y2=j2+(Math.floor(j2)*2+1)*f2,I2=v2,O2=1.79284291400159-0.85373472095314*(K2*K2+Y2*Y2+I2*I2);K2*=O2,Y2*=O2,I2*=O2;let[C2,U2,E2]=Q[y],Q2=Math.max(0.6-(C2*C2+U2*U2+E2*E2),0);Q2*=Q2,r+=Q2*Q2*(K2*C2+Y2*U2+I2*E2)}return 42*r}function W($){$=$||{};let J=$.count||4500,K=$.innerR||600,q=$.outerR||1000,X={uTime:{value:0}},E=new Y.BufferGeometry,I=new Float32Array(J*3),F=new Float32Array(J*3),j=new Float32Array(J),D=new Float32Array(J);for(let C=0;C<J;C++){let M=K+Math.random()*(q-K),L=Math.random()*Math.PI*2,k=Math.acos(2*Math.random()-1);I[C*3]=M*Math.sin(k)*Math.cos(L),I[C*3+1]=M*Math.sin(k)*Math.sin(L),I[C*3+2]=M*Math.cos(k);let v=Math.random(),O=v<0.7?[1,1,1]:v<0.85?[1,0.92,0.78]:[0.78,0.86,1];F[C*3]=O[0],F[C*3+1]=O[1],F[C*3+2]=O[2],j[C]=Math.random()<0.05?5.5:1.5+Math.random()*2,D[C]=Math.random()*Math.PI*2}E.setAttribute("position",new Y.BufferAttribute(I,3)),E.setAttribute("color",new Y.BufferAttribute(F,3)),E.setAttribute("size",new Y.BufferAttribute(j,1)),E.setAttribute("phase",new Y.BufferAttribute(D,1));let V=new Y.ShaderMaterial({uniforms:X,vertexColors:!0,transparent:!0,depthWrite:!1,blending:Y.AdditiveBlending,vertexShader:`
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
        }`});return{points:new Y.Points(E,V),uniforms:X}}function _($,J,K,q,X){return new Y.Mesh(new Y.SphereGeometry($,64,64),new Y.ShaderMaterial({transparent:!0,side:Y.BackSide,blending:Y.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new Y.Color(J)},b:{value:K},e:{value:q},m:{value:X}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function R($){let J=new Y.Group,K={uOutputScale:{value:1},uTime:{value:0}},q=new Y.Mesh(new Y.SphereGeometry($,64,64),new Y.ShaderMaterial({uniforms:K,vertexShader:`
          varying vec3 vPos; varying vec3 vN;
          void main() {
            vPos = position; vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,fragmentShader:G+`
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
          }`})),X=_($*1.08,16759376,0.7,2,1),E=_($*1.45,16747056,0.55,3,0.6);return J.add(q,X,E),{group:J,core:q,inner:X,corona:E,uniforms:K}}function w($){let J={uIntensity:{value:1},uSunDir:{value:new Y.Vector3(-1,0,0)}},K=80.65*Math.PI/180,q=72.68*Math.PI/180;J.uMagNorth={value:new Y.Vector3(Math.cos(K)*Math.cos(q),Math.sin(K),Math.cos(K)*Math.sin(q)).normalize()};let X=0.4,E=0.072,I=0.028,F=1.2,j=0.21,D=0.59,V=512,C=96,M=J.uMagNorth.value,L=new Y.Vector3().crossVectors(M,new Y.Vector3(0,0,1)).normalize(),k=new Y.Vector3().crossVectors(M,L).normalize(),v=(A,b,Q)=>{let f=0,T=0.5;for(let h=0;h<3;h++)f+=T*U(A,b,Q),A*=2.02,b*=2.02,Q*=2.02,T*=0.5;return f},O=new Uint8Array(V*C),H=new Y.Vector3;for(let A=0;A<C;A++){let b=j+(A+0.5)/C*(D-j);for(let Q=0;Q<V;Q++){let f=(Q+0.5)/V*Math.PI*2-Math.PI;H.copy(M).multiplyScalar(Math.cos(b)).addScaledVector(L,Math.sin(b)*Math.cos(f)).addScaledVector(k,Math.sin(b)*Math.sin(f));let T=I*U(H.x*3.2,H.y*3.2,H.z*3.2),h=Math.exp(-(((b-X-T)/E)**2)),c=0.5+0.5*Math.sin(f*16+v(H.x*4.6,H.y*4.6,H.z*4.6)*3);c=Math.max(c,0)**1.8;let d=0.62+0.38*v(H.x*6.2,H.y*6.2,H.z*6.2),o=h*(0.32+0.68*c)*d;O[A*V+Q]=Math.round(Math.sqrt(Math.min(Math.max(o/F,0),1))*255)}}let N=new Y.DataTexture(O,V,C,Y.RedFormat);N.wrapS=Y.RepeatWrapping,N.wrapT=Y.ClampToEdgeWrapping,N.magFilter=Y.LinearFilter,N.minFilter=Y.LinearFilter,N.needsUpdate=!0,J.uPattern={value:N};let B=new Y.Mesh(new Y.SphereGeometry($,64,48),new Y.ShaderMaterial({uniforms:J,transparent:!0,depthWrite:!1,blending:Y.AdditiveBlending,side:Y.FrontSide,vertexShader:`
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
          }`}));return B.renderOrder=1,{mesh:B,uniforms:J}}function z($,J,K){K=K||{};let q={target:K.target?K.target.clone():new Y.Vector3(0,0,0),azimuth:K.azimuth!=null?K.azimuth:0.3,elevation:K.elevation!=null?K.elevation:0.2,distance:K.distance!=null?K.distance:11,interacting:!1};q.azimuthTarget=q.azimuth,q.elevationTarget=q.elevation,q.distanceTarget=q.distance;let X=K.minDistance!=null?K.minDistance:3,E=typeof K.maxDistance==="function"?K.maxDistance:()=>K.maxDistance!=null?K.maxDistance:55,I=K.zoomSpeed!=null?K.zoomSpeed:0.012,F=K.zoomDistanceScale!=null?K.zoomDistanceScale:0,j=K.damping!=null?K.damping:0.12,D=K.distanceDamping!=null?K.distanceDamping:j,V=K.onPick,C=K.pickThreshold!=null?K.pickThreshold:6,M=Math.PI/2-0.05;function L(){$.position.set(q.target.x+q.distance*Math.cos(q.elevation)*Math.sin(q.azimuth),q.target.y+q.distance*Math.sin(q.elevation),q.target.z+q.distance*Math.cos(q.elevation)*Math.cos(q.azimuth)),$.lookAt(q.target)}L();let k=!1,v=0,O=0,H=0;J.addEventListener("mousedown",(Q)=>{k=!0,q.interacting=!0,v=0,O=Q.clientX,H=Q.clientY}),window.addEventListener("mousemove",(Q)=>{if(!k)return;let f=Q.clientX-O,T=Q.clientY-H;v+=Math.abs(f)+Math.abs(T),q.azimuthTarget-=f*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-M,M),O=Q.clientX,H=Q.clientY}),window.addEventListener("mouseup",(Q)=>{if(k&&V&&v<C)V(Q.clientX,Q.clientY);k=!1,q.interacting=!1}),window.addEventListener("mouseleave",()=>{k=!1,q.interacting=!1}),J.addEventListener("wheel",(Q)=>{q.distanceTarget+=Q.deltaY*I*(1+q.distance*F),q.distanceTarget=g(q.distanceTarget,X,E()),Q.preventDefault()},{passive:!1});let N=null,B=null,A=null,b=0;return J.addEventListener("touchstart",(Q)=>{if(q.interacting=Q.touches.length>0,Q.touches.length===1)N={x:Q.touches[0].clientX,y:Q.touches[0].clientY},A={x:Q.touches[0].clientX,y:Q.touches[0].clientY},b=0;else if(Q.touches.length===2){let f=Q.touches[0].clientX-Q.touches[1].clientX,T=Q.touches[0].clientY-Q.touches[1].clientY;B=Math.hypot(f,T),A=null}},{passive:!0}),J.addEventListener("touchmove",(Q)=>{if(Q.touches.length===1&&N){let f=Q.touches[0].clientX-N.x,T=Q.touches[0].clientY-N.y;b+=Math.abs(f)+Math.abs(T),q.azimuthTarget-=f*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-M,M),N={x:Q.touches[0].clientX,y:Q.touches[0].clientY},Q.preventDefault()}else if(Q.touches.length===2&&B){let f=Q.touches[0].clientX-Q.touches[1].clientX,T=Q.touches[0].clientY-Q.touches[1].clientY,h=Math.hypot(f,T);q.distanceTarget*=B/h,q.distanceTarget=g(q.distanceTarget,X,E()),B=h,Q.preventDefault()}},{passive:!1}),J.addEventListener("touchend",(Q)=>{if(Q.touches.length===0&&V&&A&&b<10)V(A.x,A.y);N=Q.touches.length===1?{x:Q.touches[0].clientX,y:Q.touches[0].clientY}:null,B=null,A=null,q.interacting=Q.touches.length>0}),J.addEventListener("touchcancel",()=>{N=null,B=null,A=null,b=0,q.interacting=!1}),q.maxDistance=E,q.update=function(){q.azimuth+=(q.azimuthTarget-q.azimuth)*j,q.elevation+=(q.elevationTarget-q.elevation)*j,q.distanceTarget=g(q.distanceTarget,X,E()),q.distance+=(q.distanceTarget-q.distance)*D,L()},q}function q2($){let J=$.renderer,K=$.composer||null,q=$.bloomPass||null,X=$.fxaaPass||null,E=Boolean(globalThis.taQa),I=$.shadowLight||null,F=Math.min(window.devicePixelRatio||1,2),j=[F,Math.min(F,1.5),Math.min(F,1.25),Math.min(F,1)],D=[2048,2048,1024,512],V=1,C=18,M=24,L=1500,k=0.75,v=performance.now()+L,O=0,H=16,N=0,B=0,A=0,b=6,Q=-1/0,f=12000,T=600,h=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},c=F,d=h.width,o=h.height;function J2(){let S=j[O],{width:l,height:x}=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},r=S!==c,y=l!==d||x!==o;if(r){if(J.setPixelRatio(S),K)K.setPixelRatio(S)}if(y){if(J.setSize(l,x),K)K.setSize(l,x)}if((r||y)&&X&&typeof X.setSize==="function"&&!K)X.setSize(l*S,x*S);if(c=S,d=l,o=x,q)q.enabled=O<2;if(I&&I.shadow&&I.shadow.mapSize.x!==D[O]){if(I.shadow.mapSize.set(D[O],D[O]),I.shadow.map)I.shadow.map.dispose(),I.shadow.map=null}}return{frame(S,l=!1){if(E)return;if(!(S>0)||S>V)return;let x=performance.now();if(l||x<v){H=16,A=0,B=0;return}if(H=H*0.95+S*1000*0.05,x<N)return;if(H>M&&O<3){if(A+=S,B=0,A>k){if(x-Q<f)b=Math.min(b*4,T);O++,J2(),N=x+4000,A=0}return}if(A=0,H<C&&O>0){if(B+=S,B>b)O--,J2(),Q=x,N=x+4000,B=0}else B=0},setShadowLight(S){I=S||null,J2()},get tier(){return O}}}function u($){if($.altKey||$.ctrlKey||$.metaKey)return!0;let J=$.target;return!!(J&&J.closest&&J.closest("input, select, textarea, [contenteditable], dialog[open]"))}function t($,J){J=J||{};let K=J.rotateStep!=null?J.rotateStep:0.08,q=J.elevateStep!=null?J.elevateStep:0.06,X=J.minDistance!=null?J.minDistance:1.5,E=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,I=Math.PI/2-0.05;window.addEventListener("keydown",(F)=>{if(u(F))return;let j=!0;switch(F.key){case"ArrowLeft":$.azimuthTarget+=K;break;case"ArrowRight":$.azimuthTarget-=K;break;case"ArrowUp":$.elevationTarget=g($.elevationTarget+q,-I,I);break;case"ArrowDown":$.elevationTarget=g($.elevationTarget-q,-I,I);break;case"+":case"=":$.distanceTarget=g($.distanceTarget*0.9,X,E());break;case"-":case"_":$.distanceTarget=g($.distanceTarget*1.12,X,E());break;default:j=!1}if(j)F.preventDefault()})}let P,a=null;function g2($,J,K,q,X){if(!P)P=new Y.Vector3;if($.getWorldPosition(P),P.project(K),!X||P.z<-1||P.z>1||Math.abs(P.x)>1.1||Math.abs(P.y)>1.1){J.style.opacity=0,J.style.display="none";return}J.style.display="",J.style.transform="translate(-50%, -50%) translate("+(P.x*0.5+0.5)*(a?a.width:window.innerWidth)+"px, "+((P.y*-0.5+0.5)*(a?a.height:window.innerHeight)+q)+"px)",J.style.opacity=1}function R2($,J){let K=document.getElementById("loader");if(!K||K.classList.contains("loader-failed"))return null;let q=K.querySelector(".loader-text"),X=K.querySelector(".loader-bar"),E=K.classList.contains("hidden"),I=q?q.textContent:"";if(K.classList.add("loader-failed"),K.classList.remove("hidden"),K.removeAttribute("aria-hidden"),K.setAttribute("role","alert"),q)q.textContent=$;if(X)X.hidden=!0;let F=null;if(J&&J.reload&&q&&q.parentNode)F=document.createElement("button"),F.type="button",F.className="scene-nav-btn",F.textContent="Reload",F.addEventListener("click",()=>location.reload()),q.parentNode.appendChild(F);return()=>{if(F)F.remove();if(q)q.textContent=I;if(X)X.hidden=!1;if(K.setAttribute("role","status"),K.classList.remove("loader-failed"),E)K.classList.add("hidden"),K.setAttribute("aria-hidden","true")}}function G2($){if(R2("This device cannot run the 3D view. Try another browser, or turn on hardware acceleration."),$)console.error($)}function u2($){let J=null,K=null;$.addEventListener("webglcontextlost",()=>{clearTimeout(J),J=setTimeout(()=>{K=R2("The 3D view stopped. Reload the page to start it again.",{reload:!0})},3000)}),$.addEventListener("webglcontextrestored",()=>{if(clearTimeout(J),K)K();K=null})}function A2($){let J=null;try{J=new Y.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...$||{}})}catch(K){return G2(K),null}if(!J.getContext())return G2(Error("WebGL context unavailable")),null;return u2(J.domElement),J}function h2($){$=$||{};let J=document.getElementById($.containerId||"canvas-container"),K=()=>({width:$.sizeToContainer?Math.max(1,J.clientWidth):window.innerWidth,height:$.sizeToContainer?Math.max(1,J.clientHeight):window.innerHeight}),q=K(),X=new Y.Scene;X.background=new Y.Color($.background!=null?$.background:329744);let E=new Y.PerspectiveCamera($.fov!=null?$.fov:45,q.width/q.height,$.near!=null?$.near:0.1,$.far!=null?$.far:2000),I=A2({alpha:!1,antialias:!1});if(!I)return null;if(I.setSize(q.width,q.height),I.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),$.shadowMap)I.shadowMap.enabled=!0,I.shadowMap.type=$.shadowMapType??Y.PCFShadowMap;if(I.outputColorSpace=Y.SRGBColorSpace,I.toneMapping=Y.ACESFilmicToneMapping,I.toneMappingExposure=1.1,$.canvasLabel){let N=document.getElementById($.canvasDescriptionId);if(!N)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");I.domElement.setAttribute("tabindex","0"),I.domElement.setAttribute("role","img"),I.domElement.setAttribute("aria-label",$.canvasLabel),I.domElement.setAttribute("aria-describedby",N.id)}else I.domElement.setAttribute("aria-hidden","true");J.appendChild(I.domElement);let F=B0(),j=null,D=null,V=null;if($.composer!==!1)try{j=new H2(I),j.addPass(new D2(X,E));let N=$.bloom||{};D=new n(new Y.Vector2(window.innerWidth,window.innerHeight),N.strength!=null?N.strength:0.55,N.radius!=null?N.radius:0.4,N.threshold!=null?N.threshold:1.35*Math.PI),j.addPass(D),j.addPass(new M2),V=new W2,j.addPass(V)}catch(N){console.warn("Post-processing unavailable, falling back to direct render.",N),j=null}let C={width:q.width,height:q.height};a=C;let M=q2({getSize:()=>C,bloomPass:D,composer:j,fxaaPass:V,renderer:I,shadowLight:$.shadowLight||null});function L(){let{width:N,height:B}=K();if(N===C.width&&($.sizeToContainer?B===C.height:Math.abs(B-C.height)<120))return;if(C.width=N,C.height=B,E.aspect=N/B,E.updateProjectionMatrix(),I.setSize(N,B),j)j.setSize(N,B)}let k=!1,v=()=>{k=!0};if(window.addEventListener("resize",v),$.sizeToContainer)new ResizeObserver(v).observe(J);function O(){if(k){if(k=!1,L(),$.onResize)$.onResize()}if(j)j.render();else I.render(X,E)}let H={accessibility:F,bloomPass:D,camera:E,composer:j,fxaaPass:V,quality:M,render:O,renderer:I,resize:L,scene:X};if(/[?&]diag=1\b/.test(window.location.search))m2(H);return H}function m2($){let J=$.renderer,K=J.domElement,q=[],X=performance.now(),E=()=>+((performance.now()-X)/1000).toFixed(2),I=document.createElement("div");I.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(I);let F=0,j=0,D=$.quality.tier,V=K.width,C=K.height;function M(O,H){q.push({t:E(),kind:O,...H}),I.textContent="RENDER DIAG · "+q.length+` events · D dumps JSON · C clears
`+q.slice(-14).reverse().map((N)=>N.t.toFixed(2)+"s  "+N.kind+"  "+Object.entries(N).filter(([B])=>B!=="t"&&B!=="kind").map(([B,A])=>B+"="+A).join(" ")).join(`
`)}let L=J.setSize.bind(J);J.setSize=function(O,H,N){return M("renderer.setSize",{w:O,h:H,pr:+J.getPixelRatio().toFixed(2)}),L(O,H,N)};let k=J.setPixelRatio.bind(J);if(J.setPixelRatio=function(O){return M("setPixelRatio",{pr:+O.toFixed(2)}),k(O)},$.composer){let O=$.composer.setSize.bind($.composer);$.composer.setSize=function(H,N){return M("composer.setSize",{w:H,h:N}),O(H,N)}}M("start",{dpr:window.devicePixelRatio||1,canvas:K.width+"x"+K.height,bloom:$.bloomPass?$.bloomPass.enabled:"none"});let v=performance.now();(function O(){requestAnimationFrame(O);let H=performance.now(),N=H-v;if(v=H,j++,N>45&&N<1000)M("long frame",{ms:+N.toFixed(1),tier:$.quality.tier});if(N>F&&N<1000)F=N;if($.quality.tier!==D)M("QUALITY TIER",{from:D,to:$.quality.tier,bloom:$.bloomPass?$.bloomPass.enabled:"none"}),D=$.quality.tier;if(K.width!==V||K.height!==C)M("CANVAS RESIZED",{from:V+"x"+C,to:K.width+"x"+K.height}),V=K.width,C=K.height})(),window.addEventListener("keydown",(O)=>{if(O.key==="d"||O.key==="D"){let H=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:K.width+"x"+K.height,frames:j,worstFrameMs:+F.toFixed(1),tier:$.quality.tier,events:q},null,1);if(console.log(H),navigator.clipboard)navigator.clipboard.writeText(H);M("dumped",{events:q.length,toClipboard:!!navigator.clipboard})}if(O.key==="c"||O.key==="C")q.length=0,F=0,M("cleared",{})}),window.__diag={events:q,setup:$}}let c2='<path d="M2 1 L10 6 L2 11 Z"/>',l2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function p2($,J,K){function q(){J.innerHTML=K.playing?l2:c2,$.setAttribute("aria-label",K.playing?"Pause simulation":"Play simulation")}return $.addEventListener("click",()=>{K.playing=!K.playing,q()}),q(),q}function i2($,J){let K=!1,q=document.getElementById("loader"),X=q?q.querySelector(".loader-bar"):null,E=X?X.querySelector(".loader-bar-fill"):null,I=0;function F(D,V){if(!X||!(V>0))return;if(I=Math.max(I,g(D/V,0,1)),X.setAttribute("aria-valuenow",String(Math.round(I*100))),E)E.style.transform="scaleX("+I.toFixed(3)+")"}function j(){if(K)return;if(K=!0,F(1,1),q&&!q.classList.contains("loader-failed"))q.classList.add("hidden"),q.setAttribute("aria-hidden","true")}if($)$.onLoad=j,$.onProgress=(D,V,C)=>F(V,C);return window.setTimeout(j,J!=null?J:5000),j.progress=F,j}function n2($,J){J=J||{};let K=J.turnStep!=null?J.turnStep:0.35,q=J.zoomFactor!=null?J.zoomFactor:0.8,X=J.minDistance!=null?J.minDistance:1.5,E=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,I=document.createElement("div");I.className="view-pad",I.setAttribute("role","group"),I.setAttribute("aria-label",J.label||"View controls");function F(D,V,C,M){let L=document.createElement("button");return L.type="button",L.className="view-pad-btn "+D,L.setAttribute("aria-label",C),L.innerHTML='<span aria-hidden="true">'+V+"</span>",L.addEventListener("click",M),I.appendChild(L),L}F("view-pad-left","‹","Turn left",()=>{$.azimuthTarget+=K}),F("view-pad-right","›","Turn right",()=>{$.azimuthTarget-=K}),F("view-pad-in","+","Zoom in",()=>{$.distanceTarget=g($.distanceTarget*q,X,E())}),F("view-pad-out","−","Zoom out",()=>{$.distanceTarget=g($.distanceTarget/q,X,E())});let j=null;if(J.onRecenter)j=F("view-pad-recenter","⌖","Recenter the view",J.onRecenter),j.hidden=!0;return(J.parent||document.body).appendChild(I),{element:I,setRecenter(D,V){if(!j)return;if(D)j.setAttribute("aria-label",D);j.hidden=!V,I.classList.toggle("has-recenter",!!V)}}}return{bindCameraKeys:t,createFrameLoop:H0,buildNav:W0,clamp:g,createAurora:w,createLoader:i2,createOrbitControls:z,createQualityGovernor:q2,createRenderer:A2,createScene:h2,createStarfield:W,createSun:R,createViewPad:n2,failWebGL:G2,GLSL_NOISE:G,glowShell:_,ignoresSceneKeys:u,initMobileHints:M0,initMobileInfoPanels:D0,prefersReducedMotion:L0,projectToScreen:g2,revealRailButton:R0,seededRandom:Z,setText:A0,wirePlayPause:p2}}();window.SPACE=k0;window.THREE=Y;export{Y as THREE,k0 as SPACE};
