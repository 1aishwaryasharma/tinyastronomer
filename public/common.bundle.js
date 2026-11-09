import{createFrameLoop as C0,buildNav as U0,clamp as g,initMobileHints as E0,initMobileInfoPanels as V0,initSceneAccessibility as H0,prefersReducedMotion as W0,revealRailButton as M0,setText as D0}from"./chrome.js?v=20261008-1";import*as N from"three";import{HalfFloatType as a2,NoBlending as s2,Timer as t2,Vector2 as z2,WebGLRenderTarget as r2}from"three";var a={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};import{ShaderMaterial as f2,UniformsUtils as o2}from"three";import{BufferGeometry as l2,Float32BufferAttribute as k2,OrthographicCamera as p2,Mesh as i2}from"three";class h{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var d2=new p2(-1,1,1,-1,0,1);class b2 extends l2{constructor(){super();this.setAttribute("position",new k2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new k2([0,2,0,0,2,0],2))}}var n2=new b2;class i{constructor(Z){this._mesh=new i2(n2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,d2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class r extends h{constructor(Z,_="tDiffuse"){super();if(this.textureID=_,this.uniforms=null,this.material=null,Z instanceof f2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=o2.clone(Z.uniforms),this.material=new f2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new i(this.material)}render(Z,_,O){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=O.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(_),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class I2 extends h{constructor(Z,_){super();this.scene=Z,this.camera=_,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,_,O){let V=Z.getContext(),Q=Z.state;Q.buffers.color.setMask(!1),Q.buffers.depth.setMask(!1),Q.buffers.color.setLocked(!0),Q.buffers.depth.setLocked(!0);let A,w;if(this.inverse)A=0,w=1;else A=1,w=0;if(Q.buffers.stencil.setTest(!0),Q.buffers.stencil.setOp(V.REPLACE,V.REPLACE,V.REPLACE),Q.buffers.stencil.setFunc(V.ALWAYS,A,4294967295),Q.buffers.stencil.setClear(w),Q.buffers.stencil.setLocked(!0),Z.setRenderTarget(O),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(_),this.clear)Z.clear();Z.render(this.scene,this.camera),Q.buffers.color.setLocked(!1),Q.buffers.depth.setLocked(!1),Q.buffers.color.setMask(!0),Q.buffers.depth.setMask(!0),Q.buffers.stencil.setLocked(!1),Q.buffers.stencil.setFunc(V.EQUAL,1,4294967295),Q.buffers.stencil.setOp(V.KEEP,V.KEEP,V.KEEP),Q.buffers.stencil.setLocked(!0)}}class E2 extends h{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class V2{constructor(Z,_){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),_===void 0){let O=Z.getSize(new z2);this._width=O.width,this._height=O.height,_=new r2(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:a2}),_.texture.name="EffectComposer.rt1"}else this._width=_.width,this._height=_.height;this.renderTarget1=_,this.renderTarget2=_.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new r(a),this.copyPass.material.blending=s2,this.timer=new t2}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,_){this.passes.splice(_,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let _=this.passes.indexOf(Z);if(_!==-1)this.passes.splice(_,1)}isLastEnabledPass(Z){for(let _=Z+1;_<this.passes.length;_++)if(this.passes[_].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let _=this.renderer.getRenderTarget(),O=!1;for(let V=0,Q=this.passes.length;V<Q;V++){let A=this.passes[V];if(A.enabled===!1)continue;if(A.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(V),A.render(this.renderer,this.writeBuffer,this.readBuffer,Z,O),A.needsSwap){if(O){let w=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(w.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(w.EQUAL,1,4294967295)}this.swapBuffers()}if(I2!==void 0){if(A instanceof I2)O=!0;else if(A instanceof E2)O=!1}}this.renderer.setRenderTarget(_)}reset(Z){if(Z===void 0){let _=this.renderer.getSize(new z2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=_.width,this._height=_.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,_){this._width=Z,this._height=_;let O=this._width*this._pixelRatio,V=this._height*this._pixelRatio;this.renderTarget1.setSize(O,V),this.renderTarget2.setSize(O,V);for(let Q=0;Q<this.passes.length;Q++)this.passes[Q].setSize(O,V)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as e2}from"three";var T2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new e2(0.0009765625,0.001953125)}},vertexShader:`

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

		}`};class H2 extends r{constructor(){super(T2)}setSize(Z,_){this.material.uniforms.resolution.value.set(1/Z,1/_)}}import{ColorManagement as Z0,RawShaderMaterial as $0,UniformsUtils as K0,LinearToneMapping as q0,ReinhardToneMapping as J0,CineonToneMapping as N0,AgXToneMapping as Y0,ACESFilmicToneMapping as I0,NeutralToneMapping as Q0,CustomToneMapping as _0,SRGBTransfer as G0}from"three";var e={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class W2 extends h{constructor(){super();this.isOutputPass=!0,this.uniforms=K0.clone(e.uniforms),this.material=new $0({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this._fsQuad=new i(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,_,O){if(this.uniforms.tDiffuse.value=O.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},Z0.getTransfer(this._outputColorSpace)===G0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===q0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===J0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===N0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===I0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===Y0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===Q0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===_0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(_),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as F0}from"three";class M2 extends h{constructor(Z,_,O=null,V=null,Q=null){super();this.scene=Z,this.camera=_,this.overrideMaterial=O,this.clearColor=V,this.clearAlpha=Q,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new F0}render(Z,_,O){let V=Z.autoClear;Z.autoClear=!1;let Q,A;if(this.overrideMaterial!==null)A=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)Q=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:O),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(Q);if(this.overrideMaterial!==null)this.scene.overrideMaterial=A;Z.autoClear=V}}import{AdditiveBlending as j0,Color as S2,HalfFloatType as D2,MeshBasicMaterial as O0,ShaderMaterial as Q2,UniformsUtils as y2,Vector2 as p,Vector3 as Z2,WebGLRenderTarget as B2}from"three";import{Color as X0}from"three";var w2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new X0(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class d extends h{constructor(Z,_=1,O,V){super();this.strength=_,this.radius=O,this.threshold=V,this.resolution=Z!==void 0?new p(Z.x,Z.y):new p(256,256),this.clearColor=new S2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let Q=Math.round(this.resolution.x/2),A=Math.round(this.resolution.y/2);this.renderTargetBright=new B2(Q,A,{type:D2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let m=0;m<this.nMips;m++){let x=new B2(Q,A,{type:D2});x.texture.name="UnrealBloomPass.h"+m,x.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(x);let s=new B2(Q,A,{type:D2});s.texture.name="UnrealBloomPass.v"+m,s.texture.generateMipmaps=!1,this.renderTargetsVertical.push(s),Q=Math.round(Q/2),A=Math.round(A/2)}let w=w2;this.highPassUniforms=y2.clone(w.uniforms),this.highPassUniforms.luminosityThreshold.value=V,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new Q2({uniforms:this.highPassUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];Q=Math.round(this.resolution.x/2),A=Math.round(this.resolution.y/2);for(let m=0;m<this.nMips;m++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[m])),this.separableBlurMaterials[m].uniforms.invSize.value=new p(1/Q,1/A),Q=Math.round(Q/2),A=Math.round(A/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=_,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let $2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=$2,this.bloomTintColors=[new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=y2.clone(a.uniforms),this.blendMaterial=new Q2({uniforms:this.copyUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader,premultipliedAlpha:!0,blending:j0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new S2,this._oldClearAlpha=1,this._basic=new O0,this._fsQuad=new i(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,_){let O=Math.round(Z/2),V=Math.round(_/2);this.renderTargetBright.setSize(O,V);for(let Q=0;Q<this.nMips;Q++)this.renderTargetsHorizontal[Q].setSize(O,V),this.renderTargetsVertical[Q].setSize(O,V),this.separableBlurMaterials[Q].uniforms.invSize.value=new p(1/O,1/V),O=Math.round(O/2),V=Math.round(V/2)}render(Z,_,O,V,Q){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let A=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),Q)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=O.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=O.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let w=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=w.texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),w=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,Q)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(O),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=A}_getSeparableBlurMaterial(Z){let _=[],O=Z/3;for(let V=0;V<Z;V++)_.push(0.39894*Math.exp(-0.5*V*V/(O*O))/O);return new Q2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new p(0.5,0.5)},direction:{value:new p(0.5,0.5)},gaussianCoefficients:{value:_}},vertexShader:`

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

				}`})}}d.BlurDirectionX=new p(1,0);d.BlurDirectionY=new p(0,1);var B0=function(){function Z($){let q=$>>>0;return()=>{return q=q*1664525+1013904223>>>0,q/4294967296}}let _=`
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
`;function O($,q,J){let K=(y)=>y-Math.floor(y/289)*289,C=(y)=>K((y*34+1)*y),W=($+q+J)/3,Y=Math.floor($+W),X=Math.floor(q+W),G=Math.floor(J+W),B=(Y+X+G)/6,U=$-Y+B,M=q-X+B,D=J-G+B,R=U>=M?1:0,v=M>=D?1:0,k=D>=U?1:0,F=Math.min(R,1-k),H=Math.min(v,1-R),E=Math.min(k,1-v),j=Math.max(R,1-k),L=Math.max(v,1-R),f=Math.max(k,1-v),I=[[U,M,D],[U-F+0.16666666666666666,M-H+0.16666666666666666,D-E+0.16666666666666666],[U-j+0.3333333333333333,M-L+0.3333333333333333,D-f+0.3333333333333333],[U-0.5,M-0.5,D-0.5]],b=K(Y),T=K(X),u=K(G),c=[0,F,j,1],n=[0,H,L,1],o=[0,E,f,1],K2=0.142857142857,S=0.285714285714,l=-0.9285714285715,P=0.142857142857,t=0;for(let y=0;y<4;y++){let R2=C(C(C(u+o[y])+T+n[y])+b+c[y]),G2=R2-49*Math.floor(R2*0.142857142857*0.142857142857),F2=Math.floor(G2*0.142857142857)*0.285714285714+-0.9285714285715,X2=Math.floor(G2-7*Math.floor(G2*0.142857142857))*0.285714285714+-0.9285714285715,A2=1-Math.abs(F2)-Math.abs(X2),v2=A2<=0?-1:0,q2=F2+(Math.floor(F2)*2+1)*v2,J2=X2+(Math.floor(X2)*2+1)*v2,N2=A2,j2=1.79284291400159-0.85373472095314*(q2*q2+J2*J2+N2*N2);q2*=j2,J2*=j2,N2*=j2;let[O2,C2,U2]=I[y],Y2=Math.max(0.6-(O2*O2+C2*C2+U2*U2),0);Y2*=Y2,t+=Y2*Y2*(q2*O2+J2*C2+N2*U2)}return 42*t}function V($){$=$||{};let q=$.count||4500,J=$.innerR||600,K=$.outerR||1000,C={uTime:{value:0}},W=new N.BufferGeometry,Y=new Float32Array(q*3),X=new Float32Array(q*3),G=new Float32Array(q),B=new Float32Array(q);for(let M=0;M<q;M++){let D=J+Math.random()*(K-J),R=Math.random()*Math.PI*2,v=Math.acos(2*Math.random()-1);Y[M*3]=D*Math.sin(v)*Math.cos(R),Y[M*3+1]=D*Math.sin(v)*Math.sin(R),Y[M*3+2]=D*Math.cos(v);let k=Math.random(),F=k<0.7?[1,1,1]:k<0.85?[1,0.92,0.78]:[0.78,0.86,1];X[M*3]=F[0],X[M*3+1]=F[1],X[M*3+2]=F[2],G[M]=Math.random()<0.05?5.5:1.5+Math.random()*2,B[M]=Math.random()*Math.PI*2}W.setAttribute("position",new N.BufferAttribute(Y,3)),W.setAttribute("color",new N.BufferAttribute(X,3)),W.setAttribute("size",new N.BufferAttribute(G,1)),W.setAttribute("phase",new N.BufferAttribute(B,1));let U=new N.ShaderMaterial({uniforms:C,vertexColors:!0,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,vertexShader:`
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
        }`});return{points:new N.Points(W,U),uniforms:C}}function Q($,q,J,K,C){return new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({transparent:!0,side:N.BackSide,blending:N.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new N.Color(q)},b:{value:J},e:{value:K},m:{value:C}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function A($){let q=new N.Group,J={uOutputScale:{value:1},uTime:{value:0}},K=new N.Mesh(new N.SphereGeometry($,64,64),new N.ShaderMaterial({uniforms:J,vertexShader:`
          varying vec3 vPos; varying vec3 vN;
          void main() {
            vPos = position; vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,fragmentShader:_+`
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
          }`})),C=Q($*1.08,16759376,0.7,2,1),W=Q($*1.45,16747056,0.55,3,0.6);return q.add(K,C,W),{group:q,core:K,inner:C,corona:W,uniforms:J}}function w($){let q={uIntensity:{value:1},uSunDir:{value:new N.Vector3(-1,0,0)}},J=80.65*Math.PI/180,K=72.68*Math.PI/180;q.uMagNorth={value:new N.Vector3(Math.cos(J)*Math.cos(K),Math.sin(J),Math.cos(J)*Math.sin(K)).normalize()};let C=0.4,W=0.072,Y=0.028,X=1.2,G=0.21,B=0.59,U=512,M=96,D=q.uMagNorth.value,R=new N.Vector3().crossVectors(D,new N.Vector3(0,0,1)).normalize(),v=new N.Vector3().crossVectors(D,R).normalize(),k=(L,f,I)=>{let b=0,T=0.5;for(let u=0;u<3;u++)b+=T*O(L,f,I),L*=2.02,f*=2.02,I*=2.02,T*=0.5;return b},F=new Uint8Array(U*M),H=new N.Vector3;for(let L=0;L<M;L++){let f=G+(L+0.5)/M*(B-G);for(let I=0;I<U;I++){let b=(I+0.5)/U*Math.PI*2-Math.PI;H.copy(D).multiplyScalar(Math.cos(f)).addScaledVector(R,Math.sin(f)*Math.cos(b)).addScaledVector(v,Math.sin(f)*Math.sin(b));let T=Y*O(H.x*3.2,H.y*3.2,H.z*3.2),u=Math.exp(-(((f-C-T)/W)**2)),c=0.5+0.5*Math.sin(b*16+k(H.x*4.6,H.y*4.6,H.z*4.6)*3);c=Math.max(c,0)**1.8;let n=0.62+0.38*k(H.x*6.2,H.y*6.2,H.z*6.2),o=u*(0.32+0.68*c)*n;F[L*U+I]=Math.round(Math.sqrt(Math.min(Math.max(o/X,0),1))*255)}}let E=new N.DataTexture(F,U,M,N.RedFormat);E.wrapS=N.RepeatWrapping,E.wrapT=N.ClampToEdgeWrapping,E.magFilter=N.LinearFilter,E.minFilter=N.LinearFilter,E.needsUpdate=!0,q.uPattern={value:E};let j=new N.Mesh(new N.SphereGeometry($,64,48),new N.ShaderMaterial({uniforms:q,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,side:N.FrontSide,vertexShader:`
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
          }`}));return j.renderOrder=1,{mesh:j,uniforms:q}}function z($,q,J){J=J||{};let K={target:J.target?J.target.clone():new N.Vector3(0,0,0),azimuth:J.azimuth!=null?J.azimuth:0.3,elevation:J.elevation!=null?J.elevation:0.2,distance:J.distance!=null?J.distance:11,interacting:!1};K.azimuthTarget=K.azimuth,K.elevationTarget=K.elevation,K.distanceTarget=K.distance;let C=J.minDistance!=null?J.minDistance:3,W=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:55,Y=J.zoomSpeed!=null?J.zoomSpeed:0.012,X=J.zoomDistanceScale!=null?J.zoomDistanceScale:0,G=J.damping!=null?J.damping:0.12,B=J.distanceDamping!=null?J.distanceDamping:G,U=J.onPick,M=J.pickThreshold!=null?J.pickThreshold:6,D=Math.PI/2-0.05;function R(){$.position.set(K.target.x+K.distance*Math.cos(K.elevation)*Math.sin(K.azimuth),K.target.y+K.distance*Math.sin(K.elevation),K.target.z+K.distance*Math.cos(K.elevation)*Math.cos(K.azimuth)),$.lookAt(K.target)}R();let v=!1,k=0,F=0,H=0;q.addEventListener("mousedown",(I)=>{v=!0,K.interacting=!0,k=0,F=I.clientX,H=I.clientY}),window.addEventListener("mousemove",(I)=>{if(!v)return;let b=I.clientX-F,T=I.clientY-H;k+=Math.abs(b)+Math.abs(T),K.azimuthTarget-=b*0.005,K.elevationTarget+=T*0.005,K.elevationTarget=g(K.elevationTarget,-D,D),F=I.clientX,H=I.clientY}),window.addEventListener("mouseup",(I)=>{if(v&&U&&k<M)U(I.clientX,I.clientY);v=!1,K.interacting=!1}),window.addEventListener("mouseleave",()=>{v=!1,K.interacting=!1}),q.addEventListener("wheel",(I)=>{K.distanceTarget+=I.deltaY*Y*(1+K.distance*X),K.distanceTarget=g(K.distanceTarget,C,W()),I.preventDefault()},{passive:!1});let E=null,j=null,L=null,f=0;return q.addEventListener("touchstart",(I)=>{if(K.interacting=I.touches.length>0,I.touches.length===1)E={x:I.touches[0].clientX,y:I.touches[0].clientY},L={x:I.touches[0].clientX,y:I.touches[0].clientY},f=0;else if(I.touches.length===2){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY;j=Math.hypot(b,T),L=null}},{passive:!0}),q.addEventListener("touchmove",(I)=>{if(I.touches.length===1&&E){let b=I.touches[0].clientX-E.x,T=I.touches[0].clientY-E.y;f+=Math.abs(b)+Math.abs(T),K.azimuthTarget-=b*0.005,K.elevationTarget+=T*0.005,K.elevationTarget=g(K.elevationTarget,-D,D),E={x:I.touches[0].clientX,y:I.touches[0].clientY},I.preventDefault()}else if(I.touches.length===2&&j){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY,u=Math.hypot(b,T);K.distanceTarget*=j/u,K.distanceTarget=g(K.distanceTarget,C,W()),j=u,I.preventDefault()}},{passive:!1}),q.addEventListener("touchend",(I)=>{if(I.touches.length===0&&U&&L&&f<10)U(L.x,L.y);E=I.touches.length===1?{x:I.touches[0].clientX,y:I.touches[0].clientY}:null,j=null,L=null,K.interacting=I.touches.length>0}),q.addEventListener("touchcancel",()=>{E=null,j=null,L=null,f=0,K.interacting=!1}),K.maxDistance=W,K.update=function(){K.azimuth+=(K.azimuthTarget-K.azimuth)*G,K.elevation+=(K.elevationTarget-K.elevation)*G,K.distanceTarget=g(K.distanceTarget,C,W()),K.distance+=(K.distanceTarget-K.distance)*B,R()},K}function $2($){let q=$.renderer,J=$.composer||null,K=$.bloomPass||null,C=$.fxaaPass||null,W=Boolean(globalThis.taQa),Y=$.shadowLight||null,X=Math.min(window.devicePixelRatio||1,2),G=[X,Math.min(X,1.5),Math.min(X,1.25),Math.min(X,1)],B=[2048,2048,1024,512],U=1,M=18,D=24,R=1500,v=0.75,k=performance.now()+R,F=0,H=16,E=0,j=0,L=0,f=6,I=-1/0,b=12000,T=600,u=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},c=X,n=u.width,o=u.height;function K2(){let S=G[F],{width:l,height:P}=$.getSize?$.getSize():{width:window.innerWidth,height:window.innerHeight},t=S!==c,y=l!==n||P!==o;if(t){if(q.setPixelRatio(S),J)J.setPixelRatio(S)}if(y){if(q.setSize(l,P),J)J.setSize(l,P)}if((t||y)&&C&&typeof C.setSize==="function"&&!J)C.setSize(l*S,P*S);if(c=S,n=l,o=P,K)K.enabled=F<2;if(Y&&Y.shadow&&Y.shadow.mapSize.x!==B[F]){if(Y.shadow.mapSize.set(B[F],B[F]),Y.shadow.map)Y.shadow.map.dispose(),Y.shadow.map=null}}return{frame(S,l=!1){if(W)return;if(!(S>0)||S>U)return;let P=performance.now();if(l||P<k){H=16,L=0,j=0;return}if(H=H*0.95+S*1000*0.05,P<E)return;if(H>D&&F<3){if(L+=S,j=0,L>v){if(P-I<b)f=Math.min(f*4,T);F++,K2(),E=P+4000,L=0}return}if(L=0,H<M&&F>0){if(j+=S,j>f)F--,K2(),I=P,E=P+4000,j=0}else j=0},setShadowLight(S){Y=S||null,K2()},get tier(){return F}}}function m($,q){q=q||{};let J=q.rotateStep!=null?q.rotateStep:0.08,K=q.elevateStep!=null?q.elevateStep:0.06,C=q.minDistance!=null?q.minDistance:1.5,W=typeof q.maxDistance==="function"?q.maxDistance:()=>q.maxDistance!=null?q.maxDistance:100,Y=Math.PI/2-0.05;window.addEventListener("keydown",(X)=>{if(X.altKey||X.ctrlKey||X.metaKey)return;let G=X.target;if(G&&G.closest&&G.closest("input, select, textarea, [contenteditable]"))return;let B=!0;switch(X.key){case"ArrowLeft":$.azimuthTarget+=J;break;case"ArrowRight":$.azimuthTarget-=J;break;case"ArrowUp":$.elevationTarget=g($.elevationTarget+K,-Y,Y);break;case"ArrowDown":$.elevationTarget=g($.elevationTarget-K,-Y,Y);break;case"+":case"=":$.distanceTarget=g($.distanceTarget*0.9,C,W());break;case"-":case"_":$.distanceTarget=g($.distanceTarget*1.12,C,W());break;default:B=!1}if(B)X.preventDefault()})}let x;function s($,q,J,K,C){if(!x)x=new N.Vector3;if($.getWorldPosition(x),x.project(J),!C||x.z<-1||x.z>1||Math.abs(x.x)>1.1||Math.abs(x.y)>1.1){q.style.opacity=0,q.style.display="none";return}q.style.display="",q.style.transform="translate(-50%, -50%) translate("+(x.x*0.5+0.5)*window.innerWidth+"px, "+((x.y*-0.5+0.5)*window.innerHeight+K)+"px)",q.style.opacity=1}function _2($){let q=document.getElementById("loader");if(q){q.classList.remove("hidden");let J=q.querySelector(".loader-text");if(J)J.textContent="This device cannot run the 3D view. Try another browser, or turn on hardware acceleration.",J.style.animation="none";q.setAttribute("role","alert")}if($)console.error($)}function L2($){let q=null;try{q=new N.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...$||{}})}catch(J){return _2(J),null}if(!q.getContext())return _2(Error("WebGL context unavailable")),null;return q}function x2($){$=$||{};let q=document.getElementById($.containerId||"canvas-container"),J=()=>({width:$.sizeToContainer?Math.max(1,q.clientWidth):window.innerWidth,height:$.sizeToContainer?Math.max(1,q.clientHeight):window.innerHeight}),K=J(),C=new N.Scene;C.background=new N.Color($.background!=null?$.background:329744);let W=new N.PerspectiveCamera($.fov!=null?$.fov:45,K.width/K.height,$.near!=null?$.near:0.1,$.far!=null?$.far:2000),Y=L2({alpha:!1,antialias:!1});if(!Y)return null;if(Y.setSize(K.width,K.height),Y.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),$.shadowMap)Y.shadowMap.enabled=!0,Y.shadowMap.type=$.shadowMapType??N.PCFShadowMap;if(Y.outputColorSpace=N.SRGBColorSpace,Y.toneMapping=N.ACESFilmicToneMapping,Y.toneMappingExposure=1.1,$.canvasLabel){let j=document.getElementById($.canvasDescriptionId);if(!j)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");Y.domElement.setAttribute("tabindex","0"),Y.domElement.setAttribute("role","img"),Y.domElement.setAttribute("aria-label",$.canvasLabel),Y.domElement.setAttribute("aria-describedby",j.id)}else Y.domElement.setAttribute("aria-hidden","true");q.appendChild(Y.domElement);let X=H0(),G=null,B=null,U=null;if($.composer!==!1)try{G=new V2(Y),G.addPass(new M2(C,W));let j=$.bloom||{};B=new d(new N.Vector2(window.innerWidth,window.innerHeight),j.strength!=null?j.strength:0.55,j.radius!=null?j.radius:0.4,j.threshold!=null?j.threshold:1.35*Math.PI),G.addPass(B),G.addPass(new W2),U=new H2,G.addPass(U)}catch(j){console.warn("Post-processing unavailable, falling back to direct render.",j),G=null}let M=$2({getSize:J,bloomPass:B,composer:G,fxaaPass:U,renderer:Y,shadowLight:$.shadowLight||null}),D=K.width,R=K.height;function v(){let{width:j,height:L}=J();if(j===D&&($.sizeToContainer?L===R:Math.abs(L-R)<120))return;if(D=j,R=L,W.aspect=j/L,W.updateProjectionMatrix(),Y.setSize(j,L),G)G.setSize(j,L)}let k=!1,F=()=>{k=!0};if(window.addEventListener("resize",F),$.sizeToContainer)new ResizeObserver(F).observe(q);function H(){if(k){if(k=!1,v(),$.onResize)$.onResize()}if(G)G.render();else Y.render(C,W)}let E={accessibility:X,bloomPass:B,camera:W,composer:G,fxaaPass:U,quality:M,render:H,renderer:Y,resize:v,scene:C};if(/[?&]diag=1\b/.test(window.location.search))P2(E);return E}function P2($){let q=$.renderer,J=q.domElement,K=[],C=performance.now(),W=()=>+((performance.now()-C)/1000).toFixed(2),Y=document.createElement("div");Y.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(Y);let X=0,G=0,B=$.quality.tier,U=J.width,M=J.height;function D(F,H){K.push({t:W(),kind:F,...H}),Y.textContent="RENDER DIAG · "+K.length+` events · D dumps JSON · C clears
`+K.slice(-14).reverse().map((E)=>E.t.toFixed(2)+"s  "+E.kind+"  "+Object.entries(E).filter(([j])=>j!=="t"&&j!=="kind").map(([j,L])=>j+"="+L).join(" ")).join(`
`)}let R=q.setSize.bind(q);q.setSize=function(F,H,E){return D("renderer.setSize",{w:F,h:H,pr:+q.getPixelRatio().toFixed(2)}),R(F,H,E)};let v=q.setPixelRatio.bind(q);if(q.setPixelRatio=function(F){return D("setPixelRatio",{pr:+F.toFixed(2)}),v(F)},$.composer){let F=$.composer.setSize.bind($.composer);$.composer.setSize=function(H,E){return D("composer.setSize",{w:H,h:E}),F(H,E)}}D("start",{dpr:window.devicePixelRatio||1,canvas:J.width+"x"+J.height,bloom:$.bloomPass?$.bloomPass.enabled:"none"});let k=performance.now();(function F(){requestAnimationFrame(F);let H=performance.now(),E=H-k;if(k=H,G++,E>45&&E<1000)D("long frame",{ms:+E.toFixed(1),tier:$.quality.tier});if(E>X&&E<1000)X=E;if($.quality.tier!==B)D("QUALITY TIER",{from:B,to:$.quality.tier,bloom:$.bloomPass?$.bloomPass.enabled:"none"}),B=$.quality.tier;if(J.width!==U||J.height!==M)D("CANVAS RESIZED",{from:U+"x"+M,to:J.width+"x"+J.height}),U=J.width,M=J.height})(),window.addEventListener("keydown",(F)=>{if(F.key==="d"||F.key==="D"){let H=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:J.width+"x"+J.height,frames:G,worstFrameMs:+X.toFixed(1),tier:$.quality.tier,events:K},null,1);if(console.log(H),navigator.clipboard)navigator.clipboard.writeText(H);D("dumped",{events:K.length,toClipboard:!!navigator.clipboard})}if(F.key==="c"||F.key==="C")K.length=0,X=0,D("cleared",{})}),window.__diag={events:K,setup:$}}let g2='<path d="M2 1 L10 6 L2 11 Z"/>',u2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function h2($,q,J){function K(){q.innerHTML=J.playing?u2:g2,$.setAttribute("aria-label",J.playing?"Pause simulation":"Play simulation")}return $.addEventListener("click",()=>{J.playing=!J.playing,K()}),K(),K}function m2($,q){let J=!1,K=document.getElementById("loader"),C=K?K.querySelector(".loader-bar"):null,W=C?C.querySelector(".loader-bar-fill"):null,Y=0;function X(B,U){if(!C||!(U>0))return;if(Y=Math.max(Y,g(B/U,0,1)),C.setAttribute("aria-valuenow",String(Math.round(Y*100))),W)W.style.transform="scaleX("+Y.toFixed(3)+")"}function G(){if(J)return;if(J=!0,X(1,1),K)K.classList.add("hidden"),K.setAttribute("aria-hidden","true")}if($)$.onLoad=G,$.onProgress=(B,U,M)=>X(U,M);return window.setTimeout(G,q!=null?q:5000),G.progress=X,G}function c2($,q){q=q||{};let J=q.turnStep!=null?q.turnStep:0.35,K=q.zoomFactor!=null?q.zoomFactor:0.8,C=q.minDistance!=null?q.minDistance:1.5,W=typeof q.maxDistance==="function"?q.maxDistance:()=>q.maxDistance!=null?q.maxDistance:100,Y=document.createElement("div");Y.className="view-pad",Y.setAttribute("role","group"),Y.setAttribute("aria-label",q.label||"View controls");function X(B,U,M,D){let R=document.createElement("button");return R.type="button",R.className="view-pad-btn "+B,R.setAttribute("aria-label",M),R.innerHTML='<span aria-hidden="true">'+U+"</span>",R.addEventListener("click",D),Y.appendChild(R),R}X("view-pad-left","‹","Turn left",()=>{$.azimuthTarget+=J}),X("view-pad-right","›","Turn right",()=>{$.azimuthTarget-=J}),X("view-pad-in","+","Zoom in",()=>{$.distanceTarget=g($.distanceTarget*K,C,W())}),X("view-pad-out","−","Zoom out",()=>{$.distanceTarget=g($.distanceTarget/K,C,W())});let G=null;if(q.onRecenter)G=X("view-pad-recenter","⌖","Recenter the view",q.onRecenter),G.hidden=!0;return(q.parent||document.body).appendChild(Y),{element:Y,setRecenter(B,U){if(!G)return;if(B)G.setAttribute("aria-label",B);G.hidden=!U,Y.classList.toggle("has-recenter",!!U)}}}return{bindCameraKeys:m,createFrameLoop:C0,buildNav:U0,clamp:g,createAurora:w,createLoader:m2,createOrbitControls:z,createQualityGovernor:$2,createRenderer:L2,createScene:x2,createStarfield:V,createSun:A,createViewPad:c2,failWebGL:_2,GLSL_NOISE:_,glowShell:Q,initMobileHints:E0,initMobileInfoPanels:V0,prefersReducedMotion:W0,projectToScreen:s,revealRailButton:M0,seededRandom:Z,setText:D0,wirePlayPause:h2}}();window.SPACE=B0;window.THREE=N;export{N as THREE,B0 as SPACE};
