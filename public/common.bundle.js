import{createFrameLoop as O0,buildNav as C0,clamp as m,initMobileHints as U0,initMobileInfoPanels as V0,initSceneAccessibility as E0,prefersReducedMotion as H0,revealRailButton as M0,setText as W0}from"./chrome.js?v=20260907-2";import*as N from"three";import{HalfFloatType as o2,NoBlending as t2,Timer as a2,Vector2 as z2,WebGLRenderTarget as s2}from"three";var t={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};import{ShaderMaterial as f2,UniformsUtils as d2}from"three";import{BufferGeometry as l2,Float32BufferAttribute as A2,OrthographicCamera as c2,Mesh as p2}from"three";class u{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var i2=new c2(-1,1,1,-1,0,1);class k2 extends l2{constructor(){super();this.setAttribute("position",new A2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new A2([0,2,0,0,2,0],2))}}var n2=new k2;class i{constructor(Z){this._mesh=new p2(n2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,i2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class r extends u{constructor(Z,Q="tDiffuse"){super();if(this.textureID=Q,this.uniforms=null,this.material=null,Z instanceof f2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=d2.clone(Z.uniforms),this.material=new f2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new i(this.material)}render(Z,Q,X){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=X.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(Q),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Y2 extends u{constructor(Z,Q){super();this.scene=Z,this.camera=Q,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,Q,X){let O=Z.getContext(),Y=Z.state;Y.buffers.color.setMask(!1),Y.buffers.depth.setMask(!1),Y.buffers.color.setLocked(!0),Y.buffers.depth.setLocked(!0);let L,T;if(this.inverse)L=0,T=1;else L=1,T=0;if(Y.buffers.stencil.setTest(!0),Y.buffers.stencil.setOp(O.REPLACE,O.REPLACE,O.REPLACE),Y.buffers.stencil.setFunc(O.ALWAYS,L,4294967295),Y.buffers.stencil.setClear(T),Y.buffers.stencil.setLocked(!0),Z.setRenderTarget(X),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(Q),this.clear)Z.clear();Z.render(this.scene,this.camera),Y.buffers.color.setLocked(!1),Y.buffers.depth.setLocked(!1),Y.buffers.color.setMask(!0),Y.buffers.depth.setMask(!0),Y.buffers.stencil.setLocked(!1),Y.buffers.stencil.setFunc(O.EQUAL,1,4294967295),Y.buffers.stencil.setOp(O.KEEP,O.KEEP,O.KEEP),Y.buffers.stencil.setLocked(!0)}}class V2 extends u{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class E2{constructor(Z,Q){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),Q===void 0){let X=Z.getSize(new z2);this._width=X.width,this._height=X.height,Q=new s2(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:o2}),Q.texture.name="EffectComposer.rt1"}else this._width=Q.width,this._height=Q.height;this.renderTarget1=Q,this.renderTarget2=Q.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new r(t),this.copyPass.material.blending=t2,this.timer=new a2}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,Q){this.passes.splice(Q,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let Q=this.passes.indexOf(Z);if(Q!==-1)this.passes.splice(Q,1)}isLastEnabledPass(Z){for(let Q=Z+1;Q<this.passes.length;Q++)if(this.passes[Q].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let Q=this.renderer.getRenderTarget(),X=!1;for(let O=0,Y=this.passes.length;O<Y;O++){let L=this.passes[O];if(L.enabled===!1)continue;if(L.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(O),L.render(this.renderer,this.writeBuffer,this.readBuffer,Z,X),L.needsSwap){if(X){let T=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(T.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(T.EQUAL,1,4294967295)}this.swapBuffers()}if(Y2!==void 0){if(L instanceof Y2)X=!0;else if(L instanceof V2)X=!1}}this.renderer.setRenderTarget(Q)}reset(Z){if(Z===void 0){let Q=this.renderer.getSize(new z2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=Q.width,this._height=Q.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,Q){this._width=Z,this._height=Q;let X=this._width*this._pixelRatio,O=this._height*this._pixelRatio;this.renderTarget1.setSize(X,O),this.renderTarget2.setSize(X,O);for(let Y=0;Y<this.passes.length;Y++)this.passes[Y].setSize(X,O)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as r2}from"three";var w2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new r2(0.0009765625,0.001953125)}},vertexShader:`

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

		}`};class H2 extends r{constructor(){super(w2)}setSize(Z,Q){this.material.uniforms.resolution.value.set(1/Z,1/Q)}}import{ColorManagement as e2,RawShaderMaterial as Z0,UniformsUtils as $0,LinearToneMapping as K0,ReinhardToneMapping as q0,CineonToneMapping as J0,AgXToneMapping as N0,ACESFilmicToneMapping as I0,NeutralToneMapping as Y0,CustomToneMapping as Q0,SRGBTransfer as _0}from"three";var e={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class M2 extends u{constructor(){super();this.isOutputPass=!0,this.uniforms=$0.clone(e.uniforms),this.material=new Z0({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this._fsQuad=new i(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,Q,X){if(this.uniforms.tDiffuse.value=X.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},e2.getTransfer(this._outputColorSpace)===_0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===K0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===q0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===J0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===I0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===N0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===Y0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===Q0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(Q),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as F0}from"three";class W2 extends u{constructor(Z,Q,X=null,O=null,Y=null){super();this.scene=Z,this.camera=Q,this.overrideMaterial=X,this.clearColor=O,this.clearAlpha=Y,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new F0}render(Z,Q,X){let O=Z.autoClear;Z.autoClear=!1;let Y,L;if(this.overrideMaterial!==null)L=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)Y=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:X),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(Y);if(this.overrideMaterial!==null)this.scene.overrideMaterial=L;Z.autoClear=O}}import{AdditiveBlending as X0,Color as S2,HalfFloatType as D2,MeshBasicMaterial as j0,ShaderMaterial as Q2,UniformsUtils as y2,Vector2 as p,Vector3 as Z2,WebGLRenderTarget as B2}from"three";import{Color as G0}from"three";var T2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new G0(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class n extends u{constructor(Z,Q=1,X,O){super();this.strength=Q,this.radius=X,this.threshold=O,this.resolution=Z!==void 0?new p(Z.x,Z.y):new p(256,256),this.clearColor=new S2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let Y=Math.round(this.resolution.x/2),L=Math.round(this.resolution.y/2);this.renderTargetBright=new B2(Y,L,{type:D2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let x=new B2(Y,L,{type:D2});x.texture.name="UnrealBloomPass.h"+h,x.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(x);let a=new B2(Y,L,{type:D2});a.texture.name="UnrealBloomPass.v"+h,a.texture.generateMipmaps=!1,this.renderTargetsVertical.push(a),Y=Math.round(Y/2),L=Math.round(L/2)}let T=T2;this.highPassUniforms=y2.clone(T.uniforms),this.highPassUniforms.luminosityThreshold.value=O,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new Q2({uniforms:this.highPassUniforms,vertexShader:T.vertexShader,fragmentShader:T.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];Y=Math.round(this.resolution.x/2),L=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new p(1/Y,1/L),Y=Math.round(Y/2),L=Math.round(L/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=Q,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let $2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=$2,this.bloomTintColors=[new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=y2.clone(t.uniforms),this.blendMaterial=new Q2({uniforms:this.copyUniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,premultipliedAlpha:!0,blending:X0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new S2,this._oldClearAlpha=1,this._basic=new j0,this._fsQuad=new i(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,Q){let X=Math.round(Z/2),O=Math.round(Q/2);this.renderTargetBright.setSize(X,O);for(let Y=0;Y<this.nMips;Y++)this.renderTargetsHorizontal[Y].setSize(X,O),this.renderTargetsVertical[Y].setSize(X,O),this.separableBlurMaterials[Y].uniforms.invSize.value=new p(1/X,1/O),X=Math.round(X/2),O=Math.round(O/2)}render(Z,Q,X,O,Y){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let L=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),Y)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=X.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=X.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let T=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=T.texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=n.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),T=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,Y)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(X),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=L}_getSeparableBlurMaterial(Z){let Q=[],X=Z/3;for(let O=0;O<Z;O++)Q.push(0.39894*Math.exp(-0.5*O*O/(X*X))/X);return new Q2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new p(0.5,0.5)},direction:{value:new p(0.5,0.5)},gaussianCoefficients:{value:Q}},vertexShader:`

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

				}`})}_getCompositeMaterial(Z){return new Q2({defines:{NUM_MIPS:Z},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

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

				}`})}}n.BlurDirectionX=new p(1,0);n.BlurDirectionY=new p(0,1);var D0=function(){function Z($){let J=$>>>0;return()=>{return J=J*1664525+1013904223>>>0,J/4294967296}}let Q=`
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
`;function X($,J,q){let K=(y)=>y-Math.floor(y/289)*289,U=(y)=>K((y*34+1)*y),M=($+J+q)/3,_=Math.floor($+M),W=Math.floor(J+M),V=Math.floor(q+M),b=(_+W+V)/6,B=$-_+b,D=J-W+b,E=q-V+b,A=B>=D?1:0,R=D>=E?1:0,v=E>=B?1:0,F=Math.min(A,1-v),C=Math.min(R,1-A),j=Math.min(v,1-R),G=Math.max(A,1-v),H=Math.max(R,1-A),f=Math.max(v,1-R),I=[[B,D,E],[B-F+0.16666666666666666,D-C+0.16666666666666666,E-j+0.16666666666666666],[B-G+0.3333333333333333,D-H+0.3333333333333333,E-f+0.3333333333333333],[B-0.5,D-0.5,E-0.5]],k=K(_),w=K(W),g=K(V),l=[0,F,G,1],d=[0,C,H,1],o=[0,j,f,1],K2=0.142857142857,S=0.285714285714,c=-0.9285714285715,P=0.142857142857,s=0;for(let y=0;y<4;y++){let b2=U(U(U(g+o[y])+w+d[y])+k+l[y]),F2=b2-49*Math.floor(b2*0.142857142857*0.142857142857),G2=Math.floor(F2*0.142857142857)*0.285714285714+-0.9285714285715,X2=Math.floor(F2-7*Math.floor(F2*0.142857142857))*0.285714285714+-0.9285714285715,R2=1-Math.abs(G2)-Math.abs(X2),v2=R2<=0?-1:0,q2=G2+(Math.floor(G2)*2+1)*v2,J2=X2+(Math.floor(X2)*2+1)*v2,N2=R2,j2=1.79284291400159-0.85373472095314*(q2*q2+J2*J2+N2*N2);q2*=j2,J2*=j2,N2*=j2;let[O2,C2,U2]=I[y],I2=Math.max(0.6-(O2*O2+C2*C2+U2*U2),0);I2*=I2,s+=I2*I2*(q2*O2+J2*C2+N2*U2)}return 42*s}function O($){$=$||{};let J=$.count||4500,q=$.innerR||600,K=$.outerR||1000,U={uTime:{value:0}},M=new N.BufferGeometry,_=new Float32Array(J*3),W=new Float32Array(J*3),V=new Float32Array(J),b=new Float32Array(J);for(let D=0;D<J;D++){let E=q+Math.random()*(K-q),A=Math.random()*Math.PI*2,R=Math.acos(2*Math.random()-1);_[D*3]=E*Math.sin(R)*Math.cos(A),_[D*3+1]=E*Math.sin(R)*Math.sin(A),_[D*3+2]=E*Math.cos(R);let v=Math.random(),F=v<0.7?[1,1,1]:v<0.85?[1,0.92,0.78]:[0.78,0.86,1];W[D*3]=F[0],W[D*3+1]=F[1],W[D*3+2]=F[2],V[D]=Math.random()<0.05?5.5:1.5+Math.random()*2,b[D]=Math.random()*Math.PI*2}M.setAttribute("position",new N.BufferAttribute(_,3)),M.setAttribute("color",new N.BufferAttribute(W,3)),M.setAttribute("size",new N.BufferAttribute(V,1)),M.setAttribute("phase",new N.BufferAttribute(b,1));let B=new N.ShaderMaterial({uniforms:U,vertexColors:!0,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,vertexShader:`
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
        }`});return{points:new N.Points(M,B),uniforms:U}}function Y($,J,q,K,U){return new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({transparent:!0,side:N.BackSide,blending:N.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new N.Color(J)},b:{value:q},e:{value:K},m:{value:U}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function L($){let J=new N.Group,q={uOutputScale:{value:1},uTime:{value:0}},K=new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({uniforms:q,vertexShader:`
          varying vec3 vPos; varying vec3 vN;
          void main() {
            vPos = position; vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,fragmentShader:Q+`
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
          }`})),U=Y($*1.08,16759376,0.7,2,1),M=Y($*1.45,16747056,0.55,3,0.6);return J.add(K,U,M),{group:J,core:K,inner:U,corona:M,uniforms:q}}function T($){let J={uIntensity:{value:1},uSunDir:{value:new N.Vector3(-1,0,0)}},q=80.65*Math.PI/180,K=72.68*Math.PI/180;J.uMagNorth={value:new N.Vector3(Math.cos(q)*Math.cos(K),Math.sin(q),Math.cos(q)*Math.sin(K)).normalize()};let U=0.4,M=0.072,_=0.028,W=1.2,V=0.21,b=0.59,B=512,D=96,E=J.uMagNorth.value,A=new N.Vector3().crossVectors(E,new N.Vector3(0,0,1)).normalize(),R=new N.Vector3().crossVectors(E,A).normalize(),v=(H,f,I)=>{let k=0,w=0.5;for(let g=0;g<3;g++)k+=w*X(H,f,I),H*=2.02,f*=2.02,I*=2.02,w*=0.5;return k},F=new Uint8Array(B*D),C=new N.Vector3;for(let H=0;H<D;H++){let f=V+(H+0.5)/D*(b-V);for(let I=0;I<B;I++){let k=(I+0.5)/B*Math.PI*2-Math.PI;C.copy(E).multiplyScalar(Math.cos(f)).addScaledVector(A,Math.sin(f)*Math.cos(k)).addScaledVector(R,Math.sin(f)*Math.sin(k));let w=_*X(C.x*3.2,C.y*3.2,C.z*3.2),g=Math.exp(-(((f-U-w)/M)**2)),l=0.5+0.5*Math.sin(k*16+v(C.x*4.6,C.y*4.6,C.z*4.6)*3);l=Math.max(l,0)**1.8;let d=0.62+0.38*v(C.x*6.2,C.y*6.2,C.z*6.2),o=g*(0.32+0.68*l)*d;F[H*B+I]=Math.round(Math.sqrt(Math.min(Math.max(o/W,0),1))*255)}}let j=new N.DataTexture(F,B,D,N.RedFormat);j.wrapS=N.RepeatWrapping,j.wrapT=N.ClampToEdgeWrapping,j.magFilter=N.LinearFilter,j.minFilter=N.LinearFilter,j.needsUpdate=!0,J.uPattern={value:j};let G=new N.Mesh(new N.SphereGeometry($,64,48),new N.ShaderMaterial({uniforms:J,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,side:N.FrontSide,vertexShader:`
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
          }`}));return G.renderOrder=1,{mesh:G,uniforms:J}}function z($,J,q){q=q||{};let K={target:q.target?q.target.clone():new N.Vector3(0,0,0),azimuth:q.azimuth!=null?q.azimuth:0.3,elevation:q.elevation!=null?q.elevation:0.2,distance:q.distance!=null?q.distance:11,interacting:!1};K.azimuthTarget=K.azimuth,K.elevationTarget=K.elevation,K.distanceTarget=K.distance;let U=q.minDistance!=null?q.minDistance:3,M=typeof q.maxDistance==="function"?q.maxDistance:()=>q.maxDistance!=null?q.maxDistance:55,_=q.zoomSpeed!=null?q.zoomSpeed:0.012,W=q.zoomDistanceScale!=null?q.zoomDistanceScale:0,V=q.damping!=null?q.damping:0.12,b=q.distanceDamping!=null?q.distanceDamping:V,B=q.onPick,D=q.pickThreshold!=null?q.pickThreshold:6,E=Math.PI/2-0.05;function A(){$.position.set(K.target.x+K.distance*Math.cos(K.elevation)*Math.sin(K.azimuth),K.target.y+K.distance*Math.sin(K.elevation),K.target.z+K.distance*Math.cos(K.elevation)*Math.cos(K.azimuth)),$.lookAt(K.target)}A();let R=!1,v=0,F=0,C=0;J.addEventListener("mousedown",(I)=>{R=!0,K.interacting=!0,v=0,F=I.clientX,C=I.clientY}),window.addEventListener("mousemove",(I)=>{if(!R)return;let k=I.clientX-F,w=I.clientY-C;v+=Math.abs(k)+Math.abs(w),K.azimuthTarget-=k*0.005,K.elevationTarget+=w*0.005,K.elevationTarget=m(K.elevationTarget,-E,E),F=I.clientX,C=I.clientY}),window.addEventListener("mouseup",(I)=>{if(R&&B&&v<D)B(I.clientX,I.clientY);R=!1,K.interacting=!1}),window.addEventListener("mouseleave",()=>{R=!1,K.interacting=!1}),J.addEventListener("wheel",(I)=>{K.distanceTarget+=I.deltaY*_*(1+K.distance*W),K.distanceTarget=m(K.distanceTarget,U,M()),I.preventDefault()},{passive:!1});let j=null,G=null,H=null,f=0;return J.addEventListener("touchstart",(I)=>{if(K.interacting=I.touches.length>0,I.touches.length===1)j={x:I.touches[0].clientX,y:I.touches[0].clientY},H={x:I.touches[0].clientX,y:I.touches[0].clientY},f=0;else if(I.touches.length===2){let k=I.touches[0].clientX-I.touches[1].clientX,w=I.touches[0].clientY-I.touches[1].clientY;G=Math.hypot(k,w),H=null}},{passive:!0}),J.addEventListener("touchmove",(I)=>{if(I.touches.length===1&&j){let k=I.touches[0].clientX-j.x,w=I.touches[0].clientY-j.y;f+=Math.abs(k)+Math.abs(w),K.azimuthTarget-=k*0.005,K.elevationTarget+=w*0.005,K.elevationTarget=m(K.elevationTarget,-E,E),j={x:I.touches[0].clientX,y:I.touches[0].clientY},I.preventDefault()}else if(I.touches.length===2&&G){let k=I.touches[0].clientX-I.touches[1].clientX,w=I.touches[0].clientY-I.touches[1].clientY,g=Math.hypot(k,w);K.distanceTarget*=G/g,K.distanceTarget=m(K.distanceTarget,U,M()),G=g,I.preventDefault()}},{passive:!1}),J.addEventListener("touchend",(I)=>{if(I.touches.length===0&&B&&H&&f<10)B(H.x,H.y);j=I.touches.length===1?{x:I.touches[0].clientX,y:I.touches[0].clientY}:null,G=null,H=null,K.interacting=I.touches.length>0}),J.addEventListener("touchcancel",()=>{j=null,G=null,H=null,f=0,K.interacting=!1}),K.maxDistance=M,K.update=function(){K.azimuth+=(K.azimuthTarget-K.azimuth)*V,K.elevation+=(K.elevationTarget-K.elevation)*V,K.distanceTarget=m(K.distanceTarget,U,M()),K.distance+=(K.distanceTarget-K.distance)*b,A()},K}function $2($){let J=$.renderer,q=$.composer||null,K=$.bloomPass||null,U=$.fxaaPass||null,M=Boolean(globalThis.taQa),_=$.shadowLight||null,W=Math.min(window.devicePixelRatio||1,2),V=[W,Math.min(W,1.5),Math.min(W,1.25),Math.min(W,1)],b=[2048,2048,1024,512],B=1,D=18,E=24,A=1500,R=0.75,v=performance.now()+A,F=0,C=16,j=0,G=0,H=0,f=6,I=-1/0,k=12000,w=600,g=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},l=W,d=g.width,o=g.height;function K2(){let S=V[F],{width:c,height:P}=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},s=S!==l,y=c!==d||P!==o;if(s){if(J.setPixelRatio(S),q)q.setPixelRatio(S)}if(y){if(J.setSize(c,P),q)q.setSize(c,P)}if((s||y)&&U&&typeof U.setSize==="function"&&!q)U.setSize(c*S,P*S);if(l=S,d=c,o=P,K)K.enabled=F<2;if(_&&_.shadow&&_.shadow.mapSize.x!==b[F]){if(_.shadow.mapSize.set(b[F],b[F]),_.shadow.map)_.shadow.map.dispose(),_.shadow.map=null}}return{frame(S,c=!1){if(M)return;if(!(S>0)||S>B)return;let P=performance.now();if(c||P<v){C=16,H=0,G=0;return}if(C=C*0.95+S*1000*0.05,P<j)return;if(C>E&&F<3){if(H+=S,G=0,H>R){if(P-I<k)f=Math.min(f*4,w);F++,K2(),j=P+4000,H=0}return}if(H=0,C<D&&F>0){if(G+=S,G>f)F--,K2(),I=P,j=P+4000,G=0}else G=0},setShadowLight(S){_=S||null,K2()},get tier(){return F}}}function h($,J){J=J||{};let q=J.rotateStep!=null?J.rotateStep:0.08,K=J.elevateStep!=null?J.elevateStep:0.06,U=J.minDistance!=null?J.minDistance:1.5,M=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:100,_=Math.PI/2-0.05;window.addEventListener("keydown",(W)=>{if(W.altKey||W.ctrlKey||W.metaKey)return;let V=W.target;if(V&&V.closest&&V.closest("input, select, textarea, [contenteditable]"))return;let b=!0;switch(W.key){case"ArrowLeft":$.azimuthTarget+=q;break;case"ArrowRight":$.azimuthTarget-=q;break;case"ArrowUp":$.elevationTarget=m($.elevationTarget+K,-_,_);break;case"ArrowDown":$.elevationTarget=m($.elevationTarget-K,-_,_);break;case"+":case"=":$.distanceTarget=m($.distanceTarget*0.9,U,M());break;case"-":case"_":$.distanceTarget=m($.distanceTarget*1.12,U,M());break;default:b=!1}if(b)W.preventDefault()})}let x;function a($,J,q,K,U){if(!x)x=new N.Vector3;if($.getWorldPosition(x),x.project(q),!U||x.z<-1||x.z>1||Math.abs(x.x)>1.1||Math.abs(x.y)>1.1){J.style.opacity=0,J.style.display="none";return}J.style.display="",J.style.transform="translate(-50%, -50%) translate("+(x.x*0.5+0.5)*window.innerWidth+"px, "+((x.y*-0.5+0.5)*window.innerHeight+K)+"px)",J.style.opacity=1}function _2($){let J=document.getElementById("loader");if(J){J.classList.remove("hidden");let q=J.querySelector(".loader-text");if(q)q.textContent="This device cannot run the 3D view. Try another browser, or turn on hardware acceleration.",q.style.animation="none";J.setAttribute("role","alert")}if($)console.error($)}function L2($){let J=null;try{J=new N.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...$||{}})}catch(q){return _2(q),null}if(!J.getContext())return _2(Error("WebGL context unavailable")),null;return J}function x2($){$=$||{};let J=document.getElementById($.containerId||"canvas-container"),q=()=>({width:$.sizeToContainer?Math.max(1,J.clientWidth):window.innerWidth,height:$.sizeToContainer?Math.max(1,J.clientHeight):window.innerHeight}),K=q(),U=new N.Scene;U.background=new N.Color($.background!=null?$.background:329744);let M=new N.PerspectiveCamera($.fov!=null?$.fov:45,K.width/K.height,$.near!=null?$.near:0.1,$.far!=null?$.far:2000),_=L2({alpha:!1,antialias:!1});if(!_)return null;if(_.setSize(K.width,K.height),_.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),$.shadowMap)_.shadowMap.enabled=!0,_.shadowMap.type=$.shadowMapType??N.PCFShadowMap;if(_.outputColorSpace=N.SRGBColorSpace,_.toneMapping=N.ACESFilmicToneMapping,_.toneMappingExposure=1.1,$.canvasLabel){let G=document.getElementById($.canvasDescriptionId);if(!G)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");_.domElement.setAttribute("tabindex","0"),_.domElement.setAttribute("role","img"),_.domElement.setAttribute("aria-label",$.canvasLabel),_.domElement.setAttribute("aria-describedby",G.id)}else _.domElement.setAttribute("aria-hidden","true");J.appendChild(_.domElement);let W=E0(),V=null,b=null,B=null;if($.composer!==!1)try{V=new E2(_),V.addPass(new W2(U,M));let G=$.bloom||{};b=new n(new N.Vector2(window.innerWidth,window.innerHeight),G.strength!=null?G.strength:0.55,G.radius!=null?G.radius:0.4,G.threshold!=null?G.threshold:1.35*Math.PI),V.addPass(b),V.addPass(new M2),B=new H2,V.addPass(B)}catch(G){console.warn("Post-processing unavailable, falling back to direct render.",G),V=null}let D=$2({getSize:q,bloomPass:b,composer:V,fxaaPass:B,renderer:_,shadowLight:$.shadowLight||null}),E=K.width,A=K.height;function R(){let{width:G,height:H}=q();if(G===E&&($.sizeToContainer?H===A:Math.abs(H-A)<120))return;if(E=G,A=H,M.aspect=G/H,M.updateProjectionMatrix(),_.setSize(G,H),V)V.setSize(G,H)}let v=!1,F=()=>{v=!0};if(window.addEventListener("resize",F),$.sizeToContainer)new ResizeObserver(F).observe(J);function C(){if(v){if(v=!1,R(),$.onResize)$.onResize()}if(V)V.render();else _.render(U,M)}let j={accessibility:W,bloomPass:b,camera:M,composer:V,fxaaPass:B,quality:D,render:C,renderer:_,resize:R,scene:U};if(/[?&]diag=1\b/.test(window.location.search))P2(j);return j}function P2($){let J=$.renderer,q=J.domElement,K=[],U=performance.now(),M=()=>+((performance.now()-U)/1000).toFixed(2),_=document.createElement("div");_.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(_);let W=0,V=0,b=$.quality.tier,B=q.width,D=q.height;function E(F,C){K.push({t:M(),kind:F,...C}),_.textContent="RENDER DIAG · "+K.length+` events · D dumps JSON · C clears
`+K.slice(-14).reverse().map((j)=>j.t.toFixed(2)+"s  "+j.kind+"  "+Object.entries(j).filter(([G])=>G!=="t"&&G!=="kind").map(([G,H])=>G+"="+H).join(" ")).join(`
`)}let A=J.setSize.bind(J);J.setSize=function(F,C,j){return E("renderer.setSize",{w:F,h:C,pr:+J.getPixelRatio().toFixed(2)}),A(F,C,j)};let R=J.setPixelRatio.bind(J);if(J.setPixelRatio=function(F){return E("setPixelRatio",{pr:+F.toFixed(2)}),R(F)},$.composer){let F=$.composer.setSize.bind($.composer);$.composer.setSize=function(C,j){return E("composer.setSize",{w:C,h:j}),F(C,j)}}E("start",{dpr:window.devicePixelRatio||1,canvas:q.width+"x"+q.height,bloom:$.bloomPass?$.bloomPass.enabled:"none"});let v=performance.now();(function F(){requestAnimationFrame(F);let C=performance.now(),j=C-v;if(v=C,V++,j>45&&j<1000)E("long frame",{ms:+j.toFixed(1),tier:$.quality.tier});if(j>W&&j<1000)W=j;if($.quality.tier!==b)E("QUALITY TIER",{from:b,to:$.quality.tier,bloom:$.bloomPass?$.bloomPass.enabled:"none"}),b=$.quality.tier;if(q.width!==B||q.height!==D)E("CANVAS RESIZED",{from:B+"x"+D,to:q.width+"x"+q.height}),B=q.width,D=q.height})(),window.addEventListener("keydown",(F)=>{if(F.key==="d"||F.key==="D"){let C=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:q.width+"x"+q.height,frames:V,worstFrameMs:+W.toFixed(1),tier:$.quality.tier,events:K},null,1);if(console.log(C),navigator.clipboard)navigator.clipboard.writeText(C);E("dumped",{events:K.length,toClipboard:!!navigator.clipboard})}if(F.key==="c"||F.key==="C")K.length=0,W=0,E("cleared",{})}),window.__diag={events:K,setup:$}}let g2='<path d="M2 1 L10 6 L2 11 Z"/>',u2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function h2($,J,q){function K(){J.innerHTML=q.playing?u2:g2,$.setAttribute("aria-label",q.playing?"Pause simulation":"Play simulation")}return $.addEventListener("click",()=>{q.playing=!q.playing,K()}),K(),K}function m2($,J){let q=!1;function K(){if(q)return;q=!0;let U=document.getElementById("loader");if(U)U.classList.add("hidden"),U.setAttribute("aria-hidden","true")}if($)$.onLoad=K;return window.setTimeout(K,J!=null?J:5000),K}return{bindCameraKeys:h,createFrameLoop:O0,buildNav:C0,clamp:m,createAurora:T,createLoader:m2,createOrbitControls:z,createQualityGovernor:$2,createRenderer:L2,createScene:x2,createStarfield:O,createSun:L,failWebGL:_2,GLSL_NOISE:Q,glowShell:Y,initMobileHints:U0,initMobileInfoPanels:V0,prefersReducedMotion:H0,projectToScreen:a,revealRailButton:M0,seededRandom:Z,setText:W0,wirePlayPause:h2}}();window.SPACE=D0;window.THREE=N;export{N as THREE,D0 as SPACE};
