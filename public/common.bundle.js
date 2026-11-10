import{createFrameLoop as V0,buildNav as H0,clamp as g,initMobileHints as W0,initMobileInfoPanels as D0,initSceneAccessibility as M0,prefersReducedMotion as B0,revealRailButton as L0,setText as R0}from"./chrome.js?v=20261008-1";import*as N from"three";import{HalfFloatType as r2,NoBlending as e2,Timer as Z0,Vector2 as T2,WebGLRenderTarget as $0}from"three";var s={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};import{ShaderMaterial as z2,UniformsUtils as t2}from"three";import{BufferGeometry as d2,Float32BufferAttribute as b2,OrthographicCamera as n2,Mesh as o2}from"three";class m{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var s2=new n2(-1,1,1,-1,0,1);class f2 extends d2{constructor(){super();this.setAttribute("position",new b2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new b2([0,2,0,0,2,0],2))}}var a2=new f2;class i{constructor(Z){this._mesh=new o2(a2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,s2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class e extends m{constructor(Z,G="tDiffuse"){super();if(this.textureID=G,this.uniforms=null,this.material=null,Z instanceof z2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=t2.clone(Z.uniforms),this.material=new z2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new i(this.material)}render(Z,G,U){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=U.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(G),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Q2 extends m{constructor(Z,G){super();this.scene=Z,this.camera=G,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,G,U){let H=Z.getContext(),_=Z.state;_.buffers.color.setMask(!1),_.buffers.depth.setMask(!1),_.buffers.color.setLocked(!0),_.buffers.depth.setLocked(!0);let R,w;if(this.inverse)R=0,w=1;else R=1,w=0;if(_.buffers.stencil.setTest(!0),_.buffers.stencil.setOp(H.REPLACE,H.REPLACE,H.REPLACE),_.buffers.stencil.setFunc(H.ALWAYS,R,4294967295),_.buffers.stencil.setClear(w),_.buffers.stencil.setLocked(!0),Z.setRenderTarget(U),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(G),this.clear)Z.clear();Z.render(this.scene,this.camera),_.buffers.color.setLocked(!1),_.buffers.depth.setLocked(!1),_.buffers.color.setMask(!0),_.buffers.depth.setMask(!0),_.buffers.stencil.setLocked(!1),_.buffers.stencil.setFunc(H.EQUAL,1,4294967295),_.buffers.stencil.setOp(H.KEEP,H.KEEP,H.KEEP),_.buffers.stencil.setLocked(!0)}}class V2 extends m{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class H2{constructor(Z,G){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),G===void 0){let U=Z.getSize(new T2);this._width=U.width,this._height=U.height,G=new $0(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:r2}),G.texture.name="EffectComposer.rt1"}else this._width=G.width,this._height=G.height;this.renderTarget1=G,this.renderTarget2=G.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new e(s),this.copyPass.material.blending=e2,this.timer=new Z0}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,G){this.passes.splice(G,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let G=this.passes.indexOf(Z);if(G!==-1)this.passes.splice(G,1)}isLastEnabledPass(Z){for(let G=Z+1;G<this.passes.length;G++)if(this.passes[G].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let G=this.renderer.getRenderTarget(),U=!1;for(let H=0,_=this.passes.length;H<_;H++){let R=this.passes[H];if(R.enabled===!1)continue;if(R.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(H),R.render(this.renderer,this.writeBuffer,this.readBuffer,Z,U),R.needsSwap){if(U){let w=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(w.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(w.EQUAL,1,4294967295)}this.swapBuffers()}if(Q2!==void 0){if(R instanceof Q2)U=!0;else if(R instanceof V2)U=!1}}this.renderer.setRenderTarget(G)}reset(Z){if(Z===void 0){let G=this.renderer.getSize(new T2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=G.width,this._height=G.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,G){this._width=Z,this._height=G;let U=this._width*this._pixelRatio,H=this._height*this._pixelRatio;this.renderTarget1.setSize(U,H),this.renderTarget2.setSize(U,H);for(let _=0;_<this.passes.length;_++)this.passes[_].setSize(U,H)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as q0}from"three";var w2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new q0(0.0009765625,0.001953125)}},vertexShader:`

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

		}`};class W2 extends e{constructor(){super(w2)}setSize(Z,G){this.material.uniforms.resolution.value.set(1/Z,1/G)}}import{ColorManagement as J0,RawShaderMaterial as K0,UniformsUtils as N0,LinearToneMapping as Y0,ReinhardToneMapping as I0,CineonToneMapping as Q0,AgXToneMapping as _0,ACESFilmicToneMapping as G0,NeutralToneMapping as F0,CustomToneMapping as X0,SRGBTransfer as j0}from"three";var Z2={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class D2 extends m{constructor(){super();this.isOutputPass=!0,this.uniforms=N0.clone(Z2.uniforms),this.material=new K0({name:Z2.name,uniforms:this.uniforms,vertexShader:Z2.vertexShader,fragmentShader:Z2.fragmentShader}),this._fsQuad=new i(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,G,U){if(this.uniforms.tDiffuse.value=U.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},J0.getTransfer(this._outputColorSpace)===j0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===Y0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===I0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===Q0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===G0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===_0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===F0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===X0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(G),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as O0}from"three";class M2 extends m{constructor(Z,G,U=null,H=null,_=null){super();this.scene=Z,this.camera=G,this.overrideMaterial=U,this.clearColor=H,this.clearAlpha=_,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new O0}render(Z,G,U){let H=Z.autoClear;Z.autoClear=!1;let _,R;if(this.overrideMaterial!==null)R=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)_=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:U),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(_);if(this.overrideMaterial!==null)this.scene.overrideMaterial=R;Z.autoClear=H}}import{AdditiveBlending as U0,Color as y2,HalfFloatType as B2,MeshBasicMaterial as E0,ShaderMaterial as _2,UniformsUtils as P2,Vector2 as p,Vector3 as $2,WebGLRenderTarget as L2}from"three";import{Color as C0}from"three";var S2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new C0(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class d extends m{constructor(Z,G=1,U,H){super();this.strength=G,this.radius=U,this.threshold=H,this.resolution=Z!==void 0?new p(Z.x,Z.y):new p(256,256),this.clearColor=new y2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let _=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);this.renderTargetBright=new L2(_,R,{type:B2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let a=new L2(_,R,{type:B2});a.texture.name="UnrealBloomPass.h"+u,a.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(a);let P=new L2(_,R,{type:B2});P.texture.name="UnrealBloomPass.v"+u,P.texture.generateMipmaps=!1,this.renderTargetsVertical.push(P),_=Math.round(_/2),R=Math.round(R/2)}let w=S2;this.highPassUniforms=P2.clone(w.uniforms),this.highPassUniforms.luminosityThreshold.value=H,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new _2({uniforms:this.highPassUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];_=Math.round(this.resolution.x/2),R=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new p(1/_,1/R),_=Math.round(_/2),R=Math.round(R/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=G,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let q2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=q2,this.bloomTintColors=[new $2(1,1,1),new $2(1,1,1),new $2(1,1,1),new $2(1,1,1),new $2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=P2.clone(s.uniforms),this.blendMaterial=new _2({uniforms:this.copyUniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,premultipliedAlpha:!0,blending:U0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new y2,this._oldClearAlpha=1,this._basic=new E0,this._fsQuad=new i(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,G){let U=Math.round(Z/2),H=Math.round(G/2);this.renderTargetBright.setSize(U,H);for(let _=0;_<this.nMips;_++)this.renderTargetsHorizontal[_].setSize(U,H),this.renderTargetsVertical[_].setSize(U,H),this.separableBlurMaterials[_].uniforms.invSize.value=new p(1/U,1/H),U=Math.round(U/2),H=Math.round(H/2)}render(Z,G,U,H,_){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let R=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),_)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=U.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=U.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let w=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=w.texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),w=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,_)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(U),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=R}_getSeparableBlurMaterial(Z){let G=[],U=Z/3;for(let H=0;H<Z;H++)G.push(0.39894*Math.exp(-0.5*H*H/(U*U))/U);return new _2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new p(0.5,0.5)},direction:{value:new p(0.5,0.5)},gaussianCoefficients:{value:G}},vertexShader:`

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

				}`})}}d.BlurDirectionX=new p(1,0);d.BlurDirectionY=new p(0,1);var A0=function(){function Z($){let J=$>>>0;return()=>{return J=J*1664525+1013904223>>>0,J/4294967296}}let G=`
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
`;function U($,J,K){let q=(y)=>y-Math.floor(y/289)*289,F=(y)=>q((y*34+1)*y),j=($+J+K)/3,Y=Math.floor($+j),W=Math.floor(J+j),X=Math.floor(K+j),M=(Y+W+X)/6,E=$-Y+M,C=J-W+M,D=K-X+M,L=E>=C?1:0,k=C>=D?1:0,v=D>=E?1:0,O=Math.min(L,1-v),V=Math.min(k,1-L),Q=Math.min(v,1-k),B=Math.max(L,1-v),A=Math.max(k,1-L),f=Math.max(v,1-k),I=[[E,C,D],[E-O+0.16666666666666666,C-V+0.16666666666666666,D-Q+0.16666666666666666],[E-B+0.3333333333333333,C-A+0.3333333333333333,D-f+0.3333333333333333],[E-0.5,C-0.5,D-0.5]],b=q(Y),T=q(W),h=q(X),l=[0,O,B,1],n=[0,V,A,1],o=[0,Q,f,1],J2=0.142857142857,S=0.285714285714,c=-0.9285714285715,x=0.142857142857,r=0;for(let y=0;y<4;y++){let A2=F(F(F(h+o[y])+T+n[y])+b+l[y]),F2=A2-49*Math.floor(A2*0.142857142857*0.142857142857),X2=Math.floor(F2*0.142857142857)*0.285714285714+-0.9285714285715,j2=Math.floor(F2-7*Math.floor(F2*0.142857142857))*0.285714285714+-0.9285714285715,k2=1-Math.abs(X2)-Math.abs(j2),v2=k2<=0?-1:0,K2=X2+(Math.floor(X2)*2+1)*v2,N2=j2+(Math.floor(j2)*2+1)*v2,Y2=k2,O2=1.79284291400159-0.85373472095314*(K2*K2+N2*N2+Y2*Y2);K2*=O2,N2*=O2,Y2*=O2;let[C2,U2,E2]=I[y],I2=Math.max(0.6-(C2*C2+U2*U2+E2*E2),0);I2*=I2,r+=I2*I2*(K2*C2+N2*U2+Y2*E2)}return 42*r}function H($){$=$||{};let J=$.count||4500,K=$.innerR||600,q=$.outerR||1000,F={uTime:{value:0}},j=new N.BufferGeometry,Y=new Float32Array(J*3),W=new Float32Array(J*3),X=new Float32Array(J),M=new Float32Array(J);for(let C=0;C<J;C++){let D=K+Math.random()*(q-K),L=Math.random()*Math.PI*2,k=Math.acos(2*Math.random()-1);Y[C*3]=D*Math.sin(k)*Math.cos(L),Y[C*3+1]=D*Math.sin(k)*Math.sin(L),Y[C*3+2]=D*Math.cos(k);let v=Math.random(),O=v<0.7?[1,1,1]:v<0.85?[1,0.92,0.78]:[0.78,0.86,1];W[C*3]=O[0],W[C*3+1]=O[1],W[C*3+2]=O[2],X[C]=Math.random()<0.05?5.5:1.5+Math.random()*2,M[C]=Math.random()*Math.PI*2}j.setAttribute("position",new N.BufferAttribute(Y,3)),j.setAttribute("color",new N.BufferAttribute(W,3)),j.setAttribute("size",new N.BufferAttribute(X,1)),j.setAttribute("phase",new N.BufferAttribute(M,1));let E=new N.ShaderMaterial({uniforms:F,vertexColors:!0,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,vertexShader:`
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
        }`});return{points:new N.Points(j,E),uniforms:F}}function _($,J,K,q,F){return new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({transparent:!0,side:N.BackSide,blending:N.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new N.Color(J)},b:{value:K},e:{value:q},m:{value:F}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function R($){let J=new N.Group,K={uOutputScale:{value:1},uTime:{value:0}},q=new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({uniforms:K,vertexShader:`
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
          }`})),F=_($*1.08,16759376,0.7,2,1),j=_($*1.45,16747056,0.55,3,0.6);return J.add(q,F,j),{group:J,core:q,inner:F,corona:j,uniforms:K}}function w($){let J={uIntensity:{value:1},uSunDir:{value:new N.Vector3(-1,0,0)}},K=80.65*Math.PI/180,q=72.68*Math.PI/180;J.uMagNorth={value:new N.Vector3(Math.cos(K)*Math.cos(q),Math.sin(K),Math.cos(K)*Math.sin(q)).normalize()};let F=0.4,j=0.072,Y=0.028,W=1.2,X=0.21,M=0.59,E=512,C=96,D=J.uMagNorth.value,L=new N.Vector3().crossVectors(D,new N.Vector3(0,0,1)).normalize(),k=new N.Vector3().crossVectors(D,L).normalize(),v=(A,f,I)=>{let b=0,T=0.5;for(let h=0;h<3;h++)b+=T*U(A,f,I),A*=2.02,f*=2.02,I*=2.02,T*=0.5;return b},O=new Uint8Array(E*C),V=new N.Vector3;for(let A=0;A<C;A++){let f=X+(A+0.5)/C*(M-X);for(let I=0;I<E;I++){let b=(I+0.5)/E*Math.PI*2-Math.PI;V.copy(D).multiplyScalar(Math.cos(f)).addScaledVector(L,Math.sin(f)*Math.cos(b)).addScaledVector(k,Math.sin(f)*Math.sin(b));let T=Y*U(V.x*3.2,V.y*3.2,V.z*3.2),h=Math.exp(-(((f-F-T)/j)**2)),l=0.5+0.5*Math.sin(b*16+v(V.x*4.6,V.y*4.6,V.z*4.6)*3);l=Math.max(l,0)**1.8;let n=0.62+0.38*v(V.x*6.2,V.y*6.2,V.z*6.2),o=h*(0.32+0.68*l)*n;O[A*E+I]=Math.round(Math.sqrt(Math.min(Math.max(o/W,0),1))*255)}}let Q=new N.DataTexture(O,E,C,N.RedFormat);Q.wrapS=N.RepeatWrapping,Q.wrapT=N.ClampToEdgeWrapping,Q.magFilter=N.LinearFilter,Q.minFilter=N.LinearFilter,Q.needsUpdate=!0,J.uPattern={value:Q};let B=new N.Mesh(new N.SphereGeometry($,64,48),new N.ShaderMaterial({uniforms:J,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,side:N.FrontSide,vertexShader:`
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
          }`}));return B.renderOrder=1,{mesh:B,uniforms:J}}function z($,J,K){K=K||{};let q={target:K.target?K.target.clone():new N.Vector3(0,0,0),azimuth:K.azimuth!=null?K.azimuth:0.3,elevation:K.elevation!=null?K.elevation:0.2,distance:K.distance!=null?K.distance:11,interacting:!1};q.azimuthTarget=q.azimuth,q.elevationTarget=q.elevation,q.distanceTarget=q.distance;let F=K.minDistance!=null?K.minDistance:3,j=typeof K.maxDistance==="function"?K.maxDistance:()=>K.maxDistance!=null?K.maxDistance:55,Y=K.zoomSpeed!=null?K.zoomSpeed:0.012,W=K.zoomDistanceScale!=null?K.zoomDistanceScale:0,X=K.damping!=null?K.damping:0.12,M=K.distanceDamping!=null?K.distanceDamping:X,E=K.onPick,C=K.pickThreshold!=null?K.pickThreshold:6,D=Math.PI/2-0.05;function L(){$.position.set(q.target.x+q.distance*Math.cos(q.elevation)*Math.sin(q.azimuth),q.target.y+q.distance*Math.sin(q.elevation),q.target.z+q.distance*Math.cos(q.elevation)*Math.cos(q.azimuth)),$.lookAt(q.target)}L();let k=!1,v=0,O=0,V=0;J.addEventListener("mousedown",(I)=>{k=!0,q.interacting=!0,v=0,O=I.clientX,V=I.clientY}),window.addEventListener("mousemove",(I)=>{if(!k)return;let b=I.clientX-O,T=I.clientY-V;v+=Math.abs(b)+Math.abs(T),q.azimuthTarget-=b*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-D,D),O=I.clientX,V=I.clientY}),window.addEventListener("mouseup",(I)=>{if(k&&E&&v<C)E(I.clientX,I.clientY);k=!1,q.interacting=!1}),window.addEventListener("mouseleave",()=>{k=!1,q.interacting=!1}),J.addEventListener("wheel",(I)=>{q.distanceTarget+=I.deltaY*Y*(1+q.distance*W),q.distanceTarget=g(q.distanceTarget,F,j()),I.preventDefault()},{passive:!1});let Q=null,B=null,A=null,f=0;return J.addEventListener("touchstart",(I)=>{if(q.interacting=I.touches.length>0,I.touches.length===1)Q={x:I.touches[0].clientX,y:I.touches[0].clientY},A={x:I.touches[0].clientX,y:I.touches[0].clientY},f=0;else if(I.touches.length===2){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY;B=Math.hypot(b,T),A=null}},{passive:!0}),J.addEventListener("touchmove",(I)=>{if(I.touches.length===1&&Q){let b=I.touches[0].clientX-Q.x,T=I.touches[0].clientY-Q.y;f+=Math.abs(b)+Math.abs(T),q.azimuthTarget-=b*0.005,q.elevationTarget+=T*0.005,q.elevationTarget=g(q.elevationTarget,-D,D),Q={x:I.touches[0].clientX,y:I.touches[0].clientY},I.preventDefault()}else if(I.touches.length===2&&B){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY,h=Math.hypot(b,T);q.distanceTarget*=B/h,q.distanceTarget=g(q.distanceTarget,F,j()),B=h,I.preventDefault()}},{passive:!1}),J.addEventListener("touchend",(I)=>{if(I.touches.length===0&&E&&A&&f<10)E(A.x,A.y);Q=I.touches.length===1?{x:I.touches[0].clientX,y:I.touches[0].clientY}:null,B=null,A=null,q.interacting=I.touches.length>0}),J.addEventListener("touchcancel",()=>{Q=null,B=null,A=null,f=0,q.interacting=!1}),q.maxDistance=j,q.update=function(){q.azimuth+=(q.azimuthTarget-q.azimuth)*X,q.elevation+=(q.elevationTarget-q.elevation)*X,q.distanceTarget=g(q.distanceTarget,F,j()),q.distance+=(q.distanceTarget-q.distance)*M,L()},q}function q2($){let J=$.renderer,K=$.composer||null,q=$.bloomPass||null,F=$.fxaaPass||null,j=Boolean(globalThis.taQa),Y=$.shadowLight||null,W=Math.min(window.devicePixelRatio||1,2),X=[W,Math.min(W,1.5),Math.min(W,1.25),Math.min(W,1)],M=[2048,2048,1024,512],E=1,C=18,D=24,L=1500,k=0.75,v=performance.now()+L,O=0,V=16,Q=0,B=0,A=0,f=6,I=-1/0,b=12000,T=600,h=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},l=W,n=h.width,o=h.height;function J2(){let S=X[O],{width:c,height:x}=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},r=S!==l,y=c!==n||x!==o;if(r){if(J.setPixelRatio(S),K)K.setPixelRatio(S)}if(y){if(J.setSize(c,x),K)K.setSize(c,x)}if((r||y)&&F&&typeof F.setSize==="function"&&!K)F.setSize(c*S,x*S);if(l=S,n=c,o=x,q)q.enabled=O<2;if(Y&&Y.shadow&&Y.shadow.mapSize.x!==M[O]){if(Y.shadow.mapSize.set(M[O],M[O]),Y.shadow.map)Y.shadow.map.dispose(),Y.shadow.map=null}}return{frame(S,c=!1){if(j)return;if(!(S>0)||S>E)return;let x=performance.now();if(c||x<v){V=16,A=0,B=0;return}if(V=V*0.95+S*1000*0.05,x<Q)return;if(V>D&&O<3){if(A+=S,B=0,A>k){if(x-I<b)f=Math.min(f*4,T);O++,J2(),Q=x+4000,A=0}return}if(A=0,V<C&&O>0){if(B+=S,B>f)O--,J2(),I=x,Q=x+4000,B=0}else B=0},setShadowLight(S){Y=S||null,J2()},get tier(){return O}}}function u($){if($.altKey||$.ctrlKey||$.metaKey)return!0;let J=$.target;return!!(J&&J.closest&&J.closest("input, select, textarea, [contenteditable], dialog[open]"))}function a($,J){J=J||{};let K=J.rotateStep!=null?J.rotateStep:0.08,q=J.elevateStep!=null?J.elevateStep:0.06,F=J.minDistance!=null?J.minDistance:1.5,j=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,Y=Math.PI/2-0.05;window.addEventListener("keydown",(W)=>{if(u(W))return;let X=!0;switch(W.key){case"ArrowLeft":$.azimuthTarget+=K;break;case"ArrowRight":$.azimuthTarget-=K;break;case"ArrowUp":$.elevationTarget=g($.elevationTarget+q,-Y,Y);break;case"ArrowDown":$.elevationTarget=g($.elevationTarget-q,-Y,Y);break;case"+":case"=":$.distanceTarget=g($.distanceTarget*0.9,F,j());break;case"-":case"_":$.distanceTarget=g($.distanceTarget*1.12,F,j());break;default:X=!1}if(X)W.preventDefault()})}let P,t=null;function x2($,J,K,q,F){if(!P)P=new N.Vector3;if($.getWorldPosition(P),P.project(K),!F||P.z<-1||P.z>1||Math.abs(P.x)>1.1||Math.abs(P.y)>1.1){J.style.opacity=0,J.style.display="none";return}J.style.display="",J.style.transform="translate(-50%, -50%) translate("+(P.x*0.5+0.5)*(t?t.width:window.innerWidth)+"px, "+((P.y*-0.5+0.5)*(t?t.height:window.innerHeight)+q)+"px)",J.style.opacity=1}function G2($){let J=document.getElementById("loader");if(J){J.classList.remove("hidden");let K=J.querySelector(".loader-text");if(K)K.textContent="This device cannot run the 3D view. Try another browser, or turn on hardware acceleration.",K.style.animation="none";J.setAttribute("role","alert")}if($)console.error($)}function g2($,J){let K=null,q=null;$.addEventListener("webglcontextlost",()=>{clearTimeout(K),K=setTimeout(()=>{q=document.createElement("div"),q.className="loader",q.setAttribute("role","alert");let F=document.createElement("div");F.className="loader-inner";let j=document.createElement("div");j.className="loader-text",j.style.animation="none",j.textContent="The 3D view stopped. Reload the page to start it again.";let Y=document.createElement("button");Y.type="button",Y.className="scene-nav-btn",Y.textContent="Reload",Y.addEventListener("click",()=>location.reload()),F.append(j,Y),q.appendChild(F),document.body.appendChild(q)},J!=null?J:3000)}),$.addEventListener("webglcontextrestored",()=>{if(clearTimeout(K),q)q.remove();q=null})}function R2($){let J=null;try{J=new N.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...$||{}})}catch(K){return G2(K),null}if(!J.getContext())return G2(Error("WebGL context unavailable")),null;return g2(J.domElement),J}function u2($){$=$||{};let J=document.getElementById($.containerId||"canvas-container"),K=()=>({width:$.sizeToContainer?Math.max(1,J.clientWidth):window.innerWidth,height:$.sizeToContainer?Math.max(1,J.clientHeight):window.innerHeight}),q=K(),F=new N.Scene;F.background=new N.Color($.background!=null?$.background:329744);let j=new N.PerspectiveCamera($.fov!=null?$.fov:45,q.width/q.height,$.near!=null?$.near:0.1,$.far!=null?$.far:2000),Y=R2({alpha:!1,antialias:!1});if(!Y)return null;if(Y.setSize(q.width,q.height),Y.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),$.shadowMap)Y.shadowMap.enabled=!0,Y.shadowMap.type=$.shadowMapType??N.PCFShadowMap;if(Y.outputColorSpace=N.SRGBColorSpace,Y.toneMapping=N.ACESFilmicToneMapping,Y.toneMappingExposure=1.1,$.canvasLabel){let Q=document.getElementById($.canvasDescriptionId);if(!Q)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");Y.domElement.setAttribute("tabindex","0"),Y.domElement.setAttribute("role","img"),Y.domElement.setAttribute("aria-label",$.canvasLabel),Y.domElement.setAttribute("aria-describedby",Q.id)}else Y.domElement.setAttribute("aria-hidden","true");J.appendChild(Y.domElement);let W=M0(),X=null,M=null,E=null;if($.composer!==!1)try{X=new H2(Y),X.addPass(new M2(F,j));let Q=$.bloom||{};M=new d(new N.Vector2(window.innerWidth,window.innerHeight),Q.strength!=null?Q.strength:0.55,Q.radius!=null?Q.radius:0.4,Q.threshold!=null?Q.threshold:1.35*Math.PI),X.addPass(M),X.addPass(new D2),E=new W2,X.addPass(E)}catch(Q){console.warn("Post-processing unavailable, falling back to direct render.",Q),X=null}let C={width:q.width,height:q.height};t=C;let D=q2({getSize:()=>C,bloomPass:M,composer:X,fxaaPass:E,renderer:Y,shadowLight:$.shadowLight||null});function L(){let{width:Q,height:B}=K();if(Q===C.width&&($.sizeToContainer?B===C.height:Math.abs(B-C.height)<120))return;if(C.width=Q,C.height=B,j.aspect=Q/B,j.updateProjectionMatrix(),Y.setSize(Q,B),X)X.setSize(Q,B)}let k=!1,v=()=>{k=!0};if(window.addEventListener("resize",v),$.sizeToContainer)new ResizeObserver(v).observe(J);function O(){if(k){if(k=!1,L(),$.onResize)$.onResize()}if(X)X.render();else Y.render(F,j)}let V={accessibility:W,bloomPass:M,camera:j,composer:X,fxaaPass:E,quality:D,render:O,renderer:Y,resize:L,scene:F};if(/[?&]diag=1\b/.test(window.location.search))h2(V);return V}function h2($){let J=$.renderer,K=J.domElement,q=[],F=performance.now(),j=()=>+((performance.now()-F)/1000).toFixed(2),Y=document.createElement("div");Y.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(Y);let W=0,X=0,M=$.quality.tier,E=K.width,C=K.height;function D(O,V){q.push({t:j(),kind:O,...V}),Y.textContent="RENDER DIAG · "+q.length+` events · D dumps JSON · C clears
`+q.slice(-14).reverse().map((Q)=>Q.t.toFixed(2)+"s  "+Q.kind+"  "+Object.entries(Q).filter(([B])=>B!=="t"&&B!=="kind").map(([B,A])=>B+"="+A).join(" ")).join(`
`)}let L=J.setSize.bind(J);J.setSize=function(O,V,Q){return D("renderer.setSize",{w:O,h:V,pr:+J.getPixelRatio().toFixed(2)}),L(O,V,Q)};let k=J.setPixelRatio.bind(J);if(J.setPixelRatio=function(O){return D("setPixelRatio",{pr:+O.toFixed(2)}),k(O)},$.composer){let O=$.composer.setSize.bind($.composer);$.composer.setSize=function(V,Q){return D("composer.setSize",{w:V,h:Q}),O(V,Q)}}D("start",{dpr:window.devicePixelRatio||1,canvas:K.width+"x"+K.height,bloom:$.bloomPass?$.bloomPass.enabled:"none"});let v=performance.now();(function O(){requestAnimationFrame(O);let V=performance.now(),Q=V-v;if(v=V,X++,Q>45&&Q<1000)D("long frame",{ms:+Q.toFixed(1),tier:$.quality.tier});if(Q>W&&Q<1000)W=Q;if($.quality.tier!==M)D("QUALITY TIER",{from:M,to:$.quality.tier,bloom:$.bloomPass?$.bloomPass.enabled:"none"}),M=$.quality.tier;if(K.width!==E||K.height!==C)D("CANVAS RESIZED",{from:E+"x"+C,to:K.width+"x"+K.height}),E=K.width,C=K.height})(),window.addEventListener("keydown",(O)=>{if(O.key==="d"||O.key==="D"){let V=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:K.width+"x"+K.height,frames:X,worstFrameMs:+W.toFixed(1),tier:$.quality.tier,events:q},null,1);if(console.log(V),navigator.clipboard)navigator.clipboard.writeText(V);D("dumped",{events:q.length,toClipboard:!!navigator.clipboard})}if(O.key==="c"||O.key==="C")q.length=0,W=0,D("cleared",{})}),window.__diag={events:q,setup:$}}let m2='<path d="M2 1 L10 6 L2 11 Z"/>',l2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function c2($,J,K){function q(){J.innerHTML=K.playing?l2:m2,$.setAttribute("aria-label",K.playing?"Pause simulation":"Play simulation")}return $.addEventListener("click",()=>{K.playing=!K.playing,q()}),q(),q}function p2($,J){let K=!1,q=document.getElementById("loader"),F=q?q.querySelector(".loader-bar"):null,j=F?F.querySelector(".loader-bar-fill"):null,Y=0;function W(M,E){if(!F||!(E>0))return;if(Y=Math.max(Y,g(M/E,0,1)),F.setAttribute("aria-valuenow",String(Math.round(Y*100))),j)j.style.transform="scaleX("+Y.toFixed(3)+")"}function X(){if(K)return;if(K=!0,W(1,1),q)q.classList.add("hidden"),q.setAttribute("aria-hidden","true")}if($)$.onLoad=X,$.onProgress=(M,E,C)=>W(E,C);return window.setTimeout(X,J!=null?J:5000),X.progress=W,X}function i2($,J){J=J||{};let K=J.turnStep!=null?J.turnStep:0.35,q=J.zoomFactor!=null?J.zoomFactor:0.8,F=J.minDistance!=null?J.minDistance:1.5,j=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,Y=document.createElement("div");Y.className="view-pad",Y.setAttribute("role","group"),Y.setAttribute("aria-label",J.label||"View controls");function W(M,E,C,D){let L=document.createElement("button");return L.type="button",L.className="view-pad-btn "+M,L.setAttribute("aria-label",C),L.innerHTML='<span aria-hidden="true">'+E+"</span>",L.addEventListener("click",D),Y.appendChild(L),L}W("view-pad-left","‹","Turn left",()=>{$.azimuthTarget+=K}),W("view-pad-right","›","Turn right",()=>{$.azimuthTarget-=K}),W("view-pad-in","+","Zoom in",()=>{$.distanceTarget=g($.distanceTarget*q,F,j())}),W("view-pad-out","−","Zoom out",()=>{$.distanceTarget=g($.distanceTarget/q,F,j())});let X=null;if(J.onRecenter)X=W("view-pad-recenter","⌖","Recenter the view",J.onRecenter),X.hidden=!0;return(J.parent||document.body).appendChild(Y),{element:Y,setRecenter(M,E){if(!X)return;if(M)X.setAttribute("aria-label",M);X.hidden=!E,Y.classList.toggle("has-recenter",!!E)}}}return{bindCameraKeys:a,createFrameLoop:V0,buildNav:H0,clamp:g,createAurora:w,createLoader:p2,createOrbitControls:z,createQualityGovernor:q2,createRenderer:R2,createScene:u2,createStarfield:H,createSun:R,createViewPad:i2,failWebGL:G2,GLSL_NOISE:G,glowShell:_,ignoresSceneKeys:u,initMobileHints:W0,initMobileInfoPanels:D0,prefersReducedMotion:B0,projectToScreen:x2,revealRailButton:L0,seededRandom:Z,setText:R0,wirePlayPause:c2}}();window.SPACE=A0;window.THREE=N;export{N as THREE,A0 as SPACE};
