import{createFrameLoop as U0,buildNav as E0,clamp as g,initMobileHints as V0,initMobileInfoPanels as H0,initSceneAccessibility as W0,prefersReducedMotion as D0,revealRailButton as M0,setText as B0}from"./chrome.js?v=20261008-1";import*as N from"three";import{HalfFloatType as a2,NoBlending as t2,Timer as r2,Vector2 as z2,WebGLRenderTarget as e2}from"three";var s={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};import{ShaderMaterial as f2,UniformsUtils as s2}from"three";import{BufferGeometry as p2,Float32BufferAttribute as v2,OrthographicCamera as i2,Mesh as d2}from"three";class h{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var n2=new i2(-1,1,1,-1,0,1);class b2 extends p2{constructor(){super();this.setAttribute("position",new v2([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new v2([0,2,0,0,2,0],2))}}var o2=new b2;class i{constructor(Z){this._mesh=new d2(o2,Z)}dispose(){this._mesh.geometry.dispose()}render(Z){Z.render(this._mesh,n2)}get material(){return this._mesh.material}set material(Z){this._mesh.material=Z}}class r extends h{constructor(Z,_="tDiffuse"){super();if(this.textureID=_,this.uniforms=null,this.material=null,Z instanceof f2)this.uniforms=Z.uniforms,this.material=Z;else if(Z)this.uniforms=s2.clone(Z.uniforms),this.material=new f2({name:Z.name!==void 0?Z.name:"unspecified",defines:Object.assign({},Z.defines),uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader});this._fsQuad=new i(this.material)}render(Z,_,U){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=U.texture;if(this._fsQuad.material=this.material,this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(_),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class I2 extends h{constructor(Z,_){super();this.scene=Z,this.camera=_,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(Z,_,U){let H=Z.getContext(),Q=Z.state;Q.buffers.color.setMask(!1),Q.buffers.depth.setMask(!1),Q.buffers.color.setLocked(!0),Q.buffers.depth.setLocked(!0);let A,S;if(this.inverse)A=0,S=1;else A=1,S=0;if(Q.buffers.stencil.setTest(!0),Q.buffers.stencil.setOp(H.REPLACE,H.REPLACE,H.REPLACE),Q.buffers.stencil.setFunc(H.ALWAYS,A,4294967295),Q.buffers.stencil.setClear(S),Q.buffers.stencil.setLocked(!0),Z.setRenderTarget(U),this.clear)Z.clear();if(Z.render(this.scene,this.camera),Z.setRenderTarget(_),this.clear)Z.clear();Z.render(this.scene,this.camera),Q.buffers.color.setLocked(!1),Q.buffers.depth.setLocked(!1),Q.buffers.color.setMask(!0),Q.buffers.depth.setMask(!0),Q.buffers.stencil.setLocked(!1),Q.buffers.stencil.setFunc(H.EQUAL,1,4294967295),Q.buffers.stencil.setOp(H.KEEP,H.KEEP,H.KEEP),Q.buffers.stencil.setLocked(!0)}}class E2 extends h{constructor(){super();this.needsSwap=!1}render(Z){Z.state.buffers.stencil.setLocked(!1),Z.state.buffers.stencil.setTest(!1)}}class V2{constructor(Z,_){if(this.renderer=Z,this._pixelRatio=Z.getPixelRatio(),_===void 0){let U=Z.getSize(new z2);this._width=U.width,this._height=U.height,_=new e2(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:a2}),_.texture.name="EffectComposer.rt1"}else this._width=_.width,this._height=_.height;this.renderTarget1=_,this.renderTarget2=_.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new r(s),this.copyPass.material.blending=t2,this.timer=new r2}swapBuffers(){let Z=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=Z}addPass(Z){this.passes.push(Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(Z,_){this.passes.splice(_,0,Z),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(Z){let _=this.passes.indexOf(Z);if(_!==-1)this.passes.splice(_,1)}isLastEnabledPass(Z){for(let _=Z+1;_<this.passes.length;_++)if(this.passes[_].enabled)return!1;return!0}render(Z){if(this.timer.update(),Z===void 0)Z=this.timer.getDelta();let _=this.renderer.getRenderTarget(),U=!1;for(let H=0,Q=this.passes.length;H<Q;H++){let A=this.passes[H];if(A.enabled===!1)continue;if(A.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(H),A.render(this.renderer,this.writeBuffer,this.readBuffer,Z,U),A.needsSwap){if(U){let S=this.renderer.getContext(),z=this.renderer.state.buffers.stencil;z.setFunc(S.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,Z),z.setFunc(S.EQUAL,1,4294967295)}this.swapBuffers()}if(I2!==void 0){if(A instanceof I2)U=!0;else if(A instanceof E2)U=!1}}this.renderer.setRenderTarget(_)}reset(Z){if(Z===void 0){let _=this.renderer.getSize(new z2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=_.width,this._height=_.height,Z=this.renderTarget1.clone(),Z.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=Z,this.renderTarget2=Z.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(Z,_){this._width=Z,this._height=_;let U=this._width*this._pixelRatio,H=this._height*this._pixelRatio;this.renderTarget1.setSize(U,H),this.renderTarget2.setSize(U,H);for(let Q=0;Q<this.passes.length;Q++)this.passes[Q].setSize(U,H)}setPixelRatio(Z){this._pixelRatio=Z,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}import{Vector2 as Z0}from"three";var T2={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new Z0(0.0009765625,0.001953125)}},vertexShader:`

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

		}`};class H2 extends r{constructor(){super(T2)}setSize(Z,_){this.material.uniforms.resolution.value.set(1/Z,1/_)}}import{ColorManagement as $0,RawShaderMaterial as K0,UniformsUtils as q0,LinearToneMapping as J0,ReinhardToneMapping as N0,CineonToneMapping as Y0,AgXToneMapping as I0,ACESFilmicToneMapping as Q0,NeutralToneMapping as _0,CustomToneMapping as G0,SRGBTransfer as F0}from"three";var e={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class W2 extends h{constructor(){super();this.isOutputPass=!0,this.uniforms=q0.clone(e.uniforms),this.material=new K0({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this._fsQuad=new i(this.material),this._outputColorSpace=null,this._toneMapping=null}render(Z,_,U){if(this.uniforms.tDiffuse.value=U.texture,this.uniforms.toneMappingExposure.value=Z.toneMappingExposure,this._outputColorSpace!==Z.outputColorSpace||this._toneMapping!==Z.toneMapping){if(this._outputColorSpace=Z.outputColorSpace,this._toneMapping=Z.toneMapping,this.material.defines={},$0.getTransfer(this._outputColorSpace)===F0)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===J0)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===N0)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===Y0)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===Q0)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===I0)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===_0)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===G0)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)Z.setRenderTarget(null),this._fsQuad.render(Z);else{if(Z.setRenderTarget(_),this.clear)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);this._fsQuad.render(Z)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}import{Color as X0}from"three";class D2 extends h{constructor(Z,_,U=null,H=null,Q=null){super();this.scene=Z,this.camera=_,this.overrideMaterial=U,this.clearColor=H,this.clearAlpha=Q,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new X0}render(Z,_,U){let H=Z.autoClear;Z.autoClear=!1;let Q,A;if(this.overrideMaterial!==null)A=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)Z.getClearColor(this._oldClearColor),Z.setClearColor(this.clearColor,Z.getClearAlpha());if(this.clearAlpha!==null)Q=Z.getClearAlpha(),Z.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)Z.clearDepth();if(Z.setRenderTarget(this.renderToScreen?null:U),this.clear===!0)Z.clear(Z.autoClearColor,Z.autoClearDepth,Z.autoClearStencil);if(Z.render(this.scene,this.camera),this.clearColor!==null)Z.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)Z.setClearAlpha(Q);if(this.overrideMaterial!==null)this.scene.overrideMaterial=A;Z.autoClear=H}}import{AdditiveBlending as O0,Color as w2,HalfFloatType as M2,MeshBasicMaterial as C0,ShaderMaterial as Q2,UniformsUtils as y2,Vector2 as p,Vector3 as Z2,WebGLRenderTarget as B2}from"three";import{Color as j0}from"three";var S2={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new j0(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class d extends h{constructor(Z,_=1,U,H){super();this.strength=_,this.radius=U,this.threshold=H,this.resolution=Z!==void 0?new p(Z.x,Z.y):new p(256,256),this.clearColor=new w2(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let Q=Math.round(this.resolution.x/2),A=Math.round(this.resolution.y/2);this.renderTargetBright=new B2(Q,A,{type:M2}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let m=0;m<this.nMips;m++){let P=new B2(Q,A,{type:M2});P.texture.name="UnrealBloomPass.h"+m,P.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(P);let a=new B2(Q,A,{type:M2});a.texture.name="UnrealBloomPass.v"+m,a.texture.generateMipmaps=!1,this.renderTargetsVertical.push(a),Q=Math.round(Q/2),A=Math.round(A/2)}let S=S2;this.highPassUniforms=y2.clone(S.uniforms),this.highPassUniforms.luminosityThreshold.value=H,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new Q2({uniforms:this.highPassUniforms,vertexShader:S.vertexShader,fragmentShader:S.fragmentShader}),this.separableBlurMaterials=[];let z=[6,10,14,18,22];Q=Math.round(this.resolution.x/2),A=Math.round(this.resolution.y/2);for(let m=0;m<this.nMips;m++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(z[m])),this.separableBlurMaterials[m].uniforms.invSize.value=new p(1/Q,1/A),Q=Math.round(Q/2),A=Math.round(A/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=_,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let $2=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=$2,this.bloomTintColors=[new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1),new Z2(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=y2.clone(s.uniforms),this.blendMaterial=new Q2({uniforms:this.copyUniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,premultipliedAlpha:!0,blending:O0,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new w2,this._oldClearAlpha=1,this._basic=new C0,this._fsQuad=new i(null)}dispose(){for(let Z=0;Z<this.renderTargetsHorizontal.length;Z++)this.renderTargetsHorizontal[Z].dispose();for(let Z=0;Z<this.renderTargetsVertical.length;Z++)this.renderTargetsVertical[Z].dispose();this.renderTargetBright.dispose();for(let Z=0;Z<this.separableBlurMaterials.length;Z++)this.separableBlurMaterials[Z].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(Z,_){let U=Math.round(Z/2),H=Math.round(_/2);this.renderTargetBright.setSize(U,H);for(let Q=0;Q<this.nMips;Q++)this.renderTargetsHorizontal[Q].setSize(U,H),this.renderTargetsVertical[Q].setSize(U,H),this.separableBlurMaterials[Q].uniforms.invSize.value=new p(1/U,1/H),U=Math.round(U/2),H=Math.round(H/2)}render(Z,_,U,H,Q){Z.getClearColor(this._oldClearColor),this._oldClearAlpha=Z.getClearAlpha();let A=Z.autoClear;if(Z.autoClear=!1,Z.setClearColor(this.clearColor,0),Q)Z.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=U.texture,Z.setRenderTarget(null),Z.clear(),this._fsQuad.render(Z);this.highPassUniforms.tDiffuse.value=U.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,Z.setRenderTarget(this.renderTargetBright),Z.clear(),this._fsQuad.render(Z);let S=this.renderTargetBright;for(let z=0;z<this.nMips;z++)this._fsQuad.material=this.separableBlurMaterials[z],this.separableBlurMaterials[z].uniforms.colorTexture.value=S.texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionX,Z.setRenderTarget(this.renderTargetsHorizontal[z]),Z.clear(),this._fsQuad.render(Z),this.separableBlurMaterials[z].uniforms.colorTexture.value=this.renderTargetsHorizontal[z].texture,this.separableBlurMaterials[z].uniforms.direction.value=d.BlurDirectionY,Z.setRenderTarget(this.renderTargetsVertical[z]),Z.clear(),this._fsQuad.render(Z),S=this.renderTargetsVertical[z];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,Z.setRenderTarget(this.renderTargetsHorizontal[0]),Z.clear(),this._fsQuad.render(Z),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,Q)Z.state.buffers.stencil.setTest(!0);if(this.renderToScreen)Z.setRenderTarget(null),this._fsQuad.render(Z);else Z.setRenderTarget(U),this._fsQuad.render(Z);Z.setClearColor(this._oldClearColor,this._oldClearAlpha),Z.autoClear=A}_getSeparableBlurMaterial(Z){let _=[],U=Z/3;for(let H=0;H<Z;H++)_.push(0.39894*Math.exp(-0.5*H*H/(U*U))/U);return new Q2({defines:{KERNEL_RADIUS:Z},uniforms:{colorTexture:{value:null},invSize:{value:new p(0.5,0.5)},direction:{value:new p(0.5,0.5)},gaussianCoefficients:{value:_}},vertexShader:`

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

				}`})}}d.BlurDirectionX=new p(1,0);d.BlurDirectionY=new p(0,1);var L0=function(){function Z(K){let q=K>>>0;return()=>{return q=q*1664525+1013904223>>>0,q/4294967296}}let _=`
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
`;function U(K,q,J){let $=(y)=>y-Math.floor(y/289)*289,F=(y)=>$((y*34+1)*y),j=(K+q+J)/3,Y=Math.floor(K+j),O=Math.floor(q+j),G=Math.floor(J+j),B=(Y+O+G)/6,E=K-Y+B,D=q-O+B,M=J-G+B,R=E>=D?1:0,k=D>=M?1:0,v=M>=E?1:0,X=Math.min(R,1-v),W=Math.min(k,1-R),V=Math.min(v,1-k),C=Math.max(R,1-v),L=Math.max(k,1-R),f=Math.max(v,1-k),I=[[E,D,M],[E-X+0.16666666666666666,D-W+0.16666666666666666,M-V+0.16666666666666666],[E-C+0.3333333333333333,D-L+0.3333333333333333,M-f+0.3333333333333333],[E-0.5,D-0.5,M-0.5]],b=$(Y),T=$(O),u=$(G),c=[0,X,C,1],n=[0,W,L,1],o=[0,V,f,1],K2=0.142857142857,w=0.285714285714,l=-0.9285714285715,x=0.142857142857,t=0;for(let y=0;y<4;y++){let R2=F(F(F(u+o[y])+T+n[y])+b+c[y]),G2=R2-49*Math.floor(R2*0.142857142857*0.142857142857),F2=Math.floor(G2*0.142857142857)*0.285714285714+-0.9285714285715,X2=Math.floor(G2-7*Math.floor(G2*0.142857142857))*0.285714285714+-0.9285714285715,A2=1-Math.abs(F2)-Math.abs(X2),k2=A2<=0?-1:0,q2=F2+(Math.floor(F2)*2+1)*k2,J2=X2+(Math.floor(X2)*2+1)*k2,N2=A2,j2=1.79284291400159-0.85373472095314*(q2*q2+J2*J2+N2*N2);q2*=j2,J2*=j2,N2*=j2;let[O2,C2,U2]=I[y],Y2=Math.max(0.6-(O2*O2+C2*C2+U2*U2),0);Y2*=Y2,t+=Y2*Y2*(q2*O2+J2*C2+N2*U2)}return 42*t}function H(K){K=K||{};let q=K.count||4500,J=K.innerR||600,$=K.outerR||1000,F={uTime:{value:0}},j=new N.BufferGeometry,Y=new Float32Array(q*3),O=new Float32Array(q*3),G=new Float32Array(q),B=new Float32Array(q);for(let D=0;D<q;D++){let M=J+Math.random()*($-J),R=Math.random()*Math.PI*2,k=Math.acos(2*Math.random()-1);Y[D*3]=M*Math.sin(k)*Math.cos(R),Y[D*3+1]=M*Math.sin(k)*Math.sin(R),Y[D*3+2]=M*Math.cos(k);let v=Math.random(),X=v<0.7?[1,1,1]:v<0.85?[1,0.92,0.78]:[0.78,0.86,1];O[D*3]=X[0],O[D*3+1]=X[1],O[D*3+2]=X[2],G[D]=Math.random()<0.05?5.5:1.5+Math.random()*2,B[D]=Math.random()*Math.PI*2}j.setAttribute("position",new N.BufferAttribute(Y,3)),j.setAttribute("color",new N.BufferAttribute(O,3)),j.setAttribute("size",new N.BufferAttribute(G,1)),j.setAttribute("phase",new N.BufferAttribute(B,1));let E=new N.ShaderMaterial({uniforms:F,vertexColors:!0,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,vertexShader:`
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
        }`});return{points:new N.Points(j,E),uniforms:F}}function Q(K,q,J,$,F){return new N.Mesh(new N.SphereGeometry(K,64,64),new N.ShaderMaterial({transparent:!0,side:N.BackSide,blending:N.AdditiveBlending,depthWrite:!1,uniforms:{c:{value:new N.Color(q)},b:{value:J},e:{value:$},m:{value:F}},vertexShader:`
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec3 vN; uniform vec3 c; uniform float b; uniform float e; uniform float m;
          void main() {
            float intensity = pow(max(b - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), e);
            gl_FragColor = vec4(c, 1.0) * intensity * m;
          }`}))}function A(K){let q=new N.Group,J={uOutputScale:{value:1},uTime:{value:0}},$=new N.Mesh(new N.SphereGeometry(K,64,64),new N.ShaderMaterial({uniforms:J,vertexShader:`
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
          }`})),F=Q(K*1.08,16759376,0.7,2,1),j=Q(K*1.45,16747056,0.55,3,0.6);return q.add($,F,j),{group:q,core:$,inner:F,corona:j,uniforms:J}}function S(K){let q={uIntensity:{value:1},uSunDir:{value:new N.Vector3(-1,0,0)}},J=80.65*Math.PI/180,$=72.68*Math.PI/180;q.uMagNorth={value:new N.Vector3(Math.cos(J)*Math.cos($),Math.sin(J),Math.cos(J)*Math.sin($)).normalize()};let F=0.4,j=0.072,Y=0.028,O=1.2,G=0.21,B=0.59,E=512,D=96,M=q.uMagNorth.value,R=new N.Vector3().crossVectors(M,new N.Vector3(0,0,1)).normalize(),k=new N.Vector3().crossVectors(M,R).normalize(),v=(L,f,I)=>{let b=0,T=0.5;for(let u=0;u<3;u++)b+=T*U(L,f,I),L*=2.02,f*=2.02,I*=2.02,T*=0.5;return b},X=new Uint8Array(E*D),W=new N.Vector3;for(let L=0;L<D;L++){let f=G+(L+0.5)/D*(B-G);for(let I=0;I<E;I++){let b=(I+0.5)/E*Math.PI*2-Math.PI;W.copy(M).multiplyScalar(Math.cos(f)).addScaledVector(R,Math.sin(f)*Math.cos(b)).addScaledVector(k,Math.sin(f)*Math.sin(b));let T=Y*U(W.x*3.2,W.y*3.2,W.z*3.2),u=Math.exp(-(((f-F-T)/j)**2)),c=0.5+0.5*Math.sin(b*16+v(W.x*4.6,W.y*4.6,W.z*4.6)*3);c=Math.max(c,0)**1.8;let n=0.62+0.38*v(W.x*6.2,W.y*6.2,W.z*6.2),o=u*(0.32+0.68*c)*n;X[L*E+I]=Math.round(Math.sqrt(Math.min(Math.max(o/O,0),1))*255)}}let V=new N.DataTexture(X,E,D,N.RedFormat);V.wrapS=N.RepeatWrapping,V.wrapT=N.ClampToEdgeWrapping,V.magFilter=N.LinearFilter,V.minFilter=N.LinearFilter,V.needsUpdate=!0,q.uPattern={value:V};let C=new N.Mesh(new N.SphereGeometry(K,64,48),new N.ShaderMaterial({uniforms:q,transparent:!0,depthWrite:!1,blending:N.AdditiveBlending,side:N.FrontSide,vertexShader:`
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
          }`}));return C.renderOrder=1,{mesh:C,uniforms:q}}function z(K,q,J){J=J||{};let $={target:J.target?J.target.clone():new N.Vector3(0,0,0),azimuth:J.azimuth!=null?J.azimuth:0.3,elevation:J.elevation!=null?J.elevation:0.2,distance:J.distance!=null?J.distance:11,interacting:!1};$.azimuthTarget=$.azimuth,$.elevationTarget=$.elevation,$.distanceTarget=$.distance;let F=J.minDistance!=null?J.minDistance:3,j=typeof J.maxDistance==="function"?J.maxDistance:()=>J.maxDistance!=null?J.maxDistance:55,Y=J.zoomSpeed!=null?J.zoomSpeed:0.012,O=J.zoomDistanceScale!=null?J.zoomDistanceScale:0,G=J.damping!=null?J.damping:0.12,B=J.distanceDamping!=null?J.distanceDamping:G,E=J.onPick,D=J.pickThreshold!=null?J.pickThreshold:6,M=Math.PI/2-0.05;function R(){K.position.set($.target.x+$.distance*Math.cos($.elevation)*Math.sin($.azimuth),$.target.y+$.distance*Math.sin($.elevation),$.target.z+$.distance*Math.cos($.elevation)*Math.cos($.azimuth)),K.lookAt($.target)}R();let k=!1,v=0,X=0,W=0;q.addEventListener("mousedown",(I)=>{k=!0,$.interacting=!0,v=0,X=I.clientX,W=I.clientY}),window.addEventListener("mousemove",(I)=>{if(!k)return;let b=I.clientX-X,T=I.clientY-W;v+=Math.abs(b)+Math.abs(T),$.azimuthTarget-=b*0.005,$.elevationTarget+=T*0.005,$.elevationTarget=g($.elevationTarget,-M,M),X=I.clientX,W=I.clientY}),window.addEventListener("mouseup",(I)=>{if(k&&E&&v<D)E(I.clientX,I.clientY);k=!1,$.interacting=!1}),window.addEventListener("mouseleave",()=>{k=!1,$.interacting=!1}),q.addEventListener("wheel",(I)=>{$.distanceTarget+=I.deltaY*Y*(1+$.distance*O),$.distanceTarget=g($.distanceTarget,F,j()),I.preventDefault()},{passive:!1});let V=null,C=null,L=null,f=0;return q.addEventListener("touchstart",(I)=>{if($.interacting=I.touches.length>0,I.touches.length===1)V={x:I.touches[0].clientX,y:I.touches[0].clientY},L={x:I.touches[0].clientX,y:I.touches[0].clientY},f=0;else if(I.touches.length===2){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY;C=Math.hypot(b,T),L=null}},{passive:!0}),q.addEventListener("touchmove",(I)=>{if(I.touches.length===1&&V){let b=I.touches[0].clientX-V.x,T=I.touches[0].clientY-V.y;f+=Math.abs(b)+Math.abs(T),$.azimuthTarget-=b*0.005,$.elevationTarget+=T*0.005,$.elevationTarget=g($.elevationTarget,-M,M),V={x:I.touches[0].clientX,y:I.touches[0].clientY},I.preventDefault()}else if(I.touches.length===2&&C){let b=I.touches[0].clientX-I.touches[1].clientX,T=I.touches[0].clientY-I.touches[1].clientY,u=Math.hypot(b,T);$.distanceTarget*=C/u,$.distanceTarget=g($.distanceTarget,F,j()),C=u,I.preventDefault()}},{passive:!1}),q.addEventListener("touchend",(I)=>{if(I.touches.length===0&&E&&L&&f<10)E(L.x,L.y);V=I.touches.length===1?{x:I.touches[0].clientX,y:I.touches[0].clientY}:null,C=null,L=null,$.interacting=I.touches.length>0}),q.addEventListener("touchcancel",()=>{V=null,C=null,L=null,f=0,$.interacting=!1}),$.maxDistance=j,$.update=function(){$.azimuth+=($.azimuthTarget-$.azimuth)*G,$.elevation+=($.elevationTarget-$.elevation)*G,$.distanceTarget=g($.distanceTarget,F,j()),$.distance+=($.distanceTarget-$.distance)*B,R()},$}function $2(K){let q=K.renderer,J=K.composer||null,$=K.bloomPass||null,F=K.fxaaPass||null,j=Boolean(globalThis.taQa),Y=K.shadowLight||null,O=Math.min(window.devicePixelRatio||1,2),G=[O,Math.min(O,1.5),Math.min(O,1.25),Math.min(O,1)],B=[2048,2048,1024,512],E=1,D=18,M=24,R=1500,k=0.75,v=performance.now()+R,X=0,W=16,V=0,C=0,L=0,f=6,I=-1/0,b=12000,T=600,u=K.getSize?K.getSize():{width:window.innerWidth,height:window.innerHeight},c=O,n=u.width,o=u.height;function K2(){let w=G[X],{width:l,height:x}=K.getSize?K.getSize():{width:window.innerWidth,height:window.innerHeight},t=w!==c,y=l!==n||x!==o;if(t){if(q.setPixelRatio(w),J)J.setPixelRatio(w)}if(y){if(q.setSize(l,x),J)J.setSize(l,x)}if((t||y)&&F&&typeof F.setSize==="function"&&!J)F.setSize(l*w,x*w);if(c=w,n=l,o=x,$)$.enabled=X<2;if(Y&&Y.shadow&&Y.shadow.mapSize.x!==B[X]){if(Y.shadow.mapSize.set(B[X],B[X]),Y.shadow.map)Y.shadow.map.dispose(),Y.shadow.map=null}}return{frame(w,l=!1){if(j)return;if(!(w>0)||w>E)return;let x=performance.now();if(l||x<v){W=16,L=0,C=0;return}if(W=W*0.95+w*1000*0.05,x<V)return;if(W>M&&X<3){if(L+=w,C=0,L>k){if(x-I<b)f=Math.min(f*4,T);X++,K2(),V=x+4000,L=0}return}if(L=0,W<D&&X>0){if(C+=w,C>f)X--,K2(),I=x,V=x+4000,C=0}else C=0},setShadowLight(w){Y=w||null,K2()},get tier(){return X}}}function m(K,q){q=q||{};let J=q.rotateStep!=null?q.rotateStep:0.08,$=q.elevateStep!=null?q.elevateStep:0.06,F=q.minDistance!=null?q.minDistance:1.5,j=typeof q.maxDistance==="function"?q.maxDistance:()=>q.maxDistance!=null?q.maxDistance:100,Y=Math.PI/2-0.05;window.addEventListener("keydown",(O)=>{if(O.altKey||O.ctrlKey||O.metaKey)return;let G=O.target;if(G&&G.closest&&G.closest("input, select, textarea, [contenteditable]"))return;let B=!0;switch(O.key){case"ArrowLeft":K.azimuthTarget+=J;break;case"ArrowRight":K.azimuthTarget-=J;break;case"ArrowUp":K.elevationTarget=g(K.elevationTarget+$,-Y,Y);break;case"ArrowDown":K.elevationTarget=g(K.elevationTarget-$,-Y,Y);break;case"+":case"=":K.distanceTarget=g(K.distanceTarget*0.9,F,j());break;case"-":case"_":K.distanceTarget=g(K.distanceTarget*1.12,F,j());break;default:B=!1}if(B)O.preventDefault()})}let P;function a(K,q,J,$,F){if(!P)P=new N.Vector3;if(K.getWorldPosition(P),P.project(J),!F||P.z<-1||P.z>1||Math.abs(P.x)>1.1||Math.abs(P.y)>1.1){q.style.opacity=0,q.style.display="none";return}q.style.display="",q.style.transform="translate(-50%, -50%) translate("+(P.x*0.5+0.5)*window.innerWidth+"px, "+((P.y*-0.5+0.5)*window.innerHeight+$)+"px)",q.style.opacity=1}function _2(K){let q=document.getElementById("loader");if(q){q.classList.remove("hidden");let J=q.querySelector(".loader-text");if(J)J.textContent="This device cannot run the 3D view. Try another browser, or turn on hardware acceleration.",J.style.animation="none";q.setAttribute("role","alert")}if(K)console.error(K)}function P2(K,q){let J=null,$=null;K.addEventListener("webglcontextlost",()=>{clearTimeout(J),J=setTimeout(()=>{$=document.createElement("div"),$.className="loader",$.setAttribute("role","alert");let F=document.createElement("div");F.className="loader-inner";let j=document.createElement("div");j.className="loader-text",j.style.animation="none",j.textContent="The 3D view stopped. Reload the page to start it again.";let Y=document.createElement("button");Y.type="button",Y.className="scene-nav-btn",Y.textContent="Reload",Y.addEventListener("click",()=>location.reload()),F.append(j,Y),$.appendChild(F),document.body.appendChild($)},q!=null?q:3000)}),K.addEventListener("webglcontextrestored",()=>{if(clearTimeout(J),$)$.remove();$=null})}function L2(K){let q=null;try{q=new N.WebGLRenderer({failIfMajorPerformanceCaveat:!1,powerPreference:"high-performance",preserveDrawingBuffer:Boolean(globalThis.taQa),...K||{}})}catch(J){return _2(J),null}if(!q.getContext())return _2(Error("WebGL context unavailable")),null;return P2(q.domElement),q}function x2(K){K=K||{};let q=document.getElementById(K.containerId||"canvas-container"),J=()=>({width:K.sizeToContainer?Math.max(1,q.clientWidth):window.innerWidth,height:K.sizeToContainer?Math.max(1,q.clientHeight):window.innerHeight}),$=J(),F=new N.Scene;F.background=new N.Color(K.background!=null?K.background:329744);let j=new N.PerspectiveCamera(K.fov!=null?K.fov:45,$.width/$.height,K.near!=null?K.near:0.1,K.far!=null?K.far:2000),Y=L2({alpha:!1,antialias:!1});if(!Y)return null;if(Y.setSize($.width,$.height),Y.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),K.shadowMap)Y.shadowMap.enabled=!0,Y.shadowMap.type=K.shadowMapType??N.PCFShadowMap;if(Y.outputColorSpace=N.SRGBColorSpace,Y.toneMapping=N.ACESFilmicToneMapping,Y.toneMappingExposure=1.1,K.canvasLabel){let C=document.getElementById(K.canvasDescriptionId);if(!C)throw Error("createScene requires canvasDescriptionId to reference a text equivalent");Y.domElement.setAttribute("tabindex","0"),Y.domElement.setAttribute("role","img"),Y.domElement.setAttribute("aria-label",K.canvasLabel),Y.domElement.setAttribute("aria-describedby",C.id)}else Y.domElement.setAttribute("aria-hidden","true");q.appendChild(Y.domElement);let O=W0(),G=null,B=null,E=null;if(K.composer!==!1)try{G=new V2(Y),G.addPass(new D2(F,j));let C=K.bloom||{};B=new d(new N.Vector2(window.innerWidth,window.innerHeight),C.strength!=null?C.strength:0.55,C.radius!=null?C.radius:0.4,C.threshold!=null?C.threshold:1.35*Math.PI),G.addPass(B),G.addPass(new W2),E=new H2,G.addPass(E)}catch(C){console.warn("Post-processing unavailable, falling back to direct render.",C),G=null}let D=$2({getSize:J,bloomPass:B,composer:G,fxaaPass:E,renderer:Y,shadowLight:K.shadowLight||null}),M=$.width,R=$.height;function k(){let{width:C,height:L}=J();if(C===M&&(K.sizeToContainer?L===R:Math.abs(L-R)<120))return;if(M=C,R=L,j.aspect=C/L,j.updateProjectionMatrix(),Y.setSize(C,L),G)G.setSize(C,L)}let v=!1,X=()=>{v=!0};if(window.addEventListener("resize",X),K.sizeToContainer)new ResizeObserver(X).observe(q);function W(){if(v){if(v=!1,k(),K.onResize)K.onResize()}if(G)G.render();else Y.render(F,j)}let V={accessibility:O,bloomPass:B,camera:j,composer:G,fxaaPass:E,quality:D,render:W,renderer:Y,resize:k,scene:F};if(/[?&]diag=1\b/.test(window.location.search))g2(V);return V}function g2(K){let q=K.renderer,J=q.domElement,$=[],F=performance.now(),j=()=>+((performance.now()-F)/1000).toFixed(2),Y=document.createElement("div");Y.style.cssText="position:fixed;z-index:9999;left:8px;bottom:8px;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;padding:8px 10px;background:rgba(3,6,12,0.92);border:1px solid rgba(120,220,255,0.35);color:#cfe9ff;font:10px/1.45 'Fragment Mono',monospace;white-space:pre;pointer-events:auto",document.body.appendChild(Y);let O=0,G=0,B=K.quality.tier,E=J.width,D=J.height;function M(X,W){$.push({t:j(),kind:X,...W}),Y.textContent="RENDER DIAG · "+$.length+` events · D dumps JSON · C clears
`+$.slice(-14).reverse().map((V)=>V.t.toFixed(2)+"s  "+V.kind+"  "+Object.entries(V).filter(([C])=>C!=="t"&&C!=="kind").map(([C,L])=>C+"="+L).join(" ")).join(`
`)}let R=q.setSize.bind(q);q.setSize=function(X,W,V){return M("renderer.setSize",{w:X,h:W,pr:+q.getPixelRatio().toFixed(2)}),R(X,W,V)};let k=q.setPixelRatio.bind(q);if(q.setPixelRatio=function(X){return M("setPixelRatio",{pr:+X.toFixed(2)}),k(X)},K.composer){let X=K.composer.setSize.bind(K.composer);K.composer.setSize=function(W,V){return M("composer.setSize",{w:W,h:V}),X(W,V)}}M("start",{dpr:window.devicePixelRatio||1,canvas:J.width+"x"+J.height,bloom:K.bloomPass?K.bloomPass.enabled:"none"});let v=performance.now();(function X(){requestAnimationFrame(X);let W=performance.now(),V=W-v;if(v=W,G++,V>45&&V<1000)M("long frame",{ms:+V.toFixed(1),tier:K.quality.tier});if(V>O&&V<1000)O=V;if(K.quality.tier!==B)M("QUALITY TIER",{from:B,to:K.quality.tier,bloom:K.bloomPass?K.bloomPass.enabled:"none"}),B=K.quality.tier;if(J.width!==E||J.height!==D)M("CANVAS RESIZED",{from:E+"x"+D,to:J.width+"x"+J.height}),E=J.width,D=J.height})(),window.addEventListener("keydown",(X)=>{if(X.key==="d"||X.key==="D"){let W=JSON.stringify({userAgent:navigator.userAgent,dpr:window.devicePixelRatio,viewport:window.innerWidth+"x"+window.innerHeight,canvas:J.width+"x"+J.height,frames:G,worstFrameMs:+O.toFixed(1),tier:K.quality.tier,events:$},null,1);if(console.log(W),navigator.clipboard)navigator.clipboard.writeText(W);M("dumped",{events:$.length,toClipboard:!!navigator.clipboard})}if(X.key==="c"||X.key==="C")$.length=0,O=0,M("cleared",{})}),window.__diag={events:$,setup:K}}let u2='<path d="M2 1 L10 6 L2 11 Z"/>',h2='<path d="M2 1 L4.5 1 L4.5 11 L2 11 Z M7.5 1 L10 1 L10 11 L7.5 11 Z"/>';function m2(K,q,J){function $(){q.innerHTML=J.playing?h2:u2,K.setAttribute("aria-label",J.playing?"Pause simulation":"Play simulation")}return K.addEventListener("click",()=>{J.playing=!J.playing,$()}),$(),$}function c2(K,q){let J=!1,$=document.getElementById("loader"),F=$?$.querySelector(".loader-bar"):null,j=F?F.querySelector(".loader-bar-fill"):null,Y=0;function O(B,E){if(!F||!(E>0))return;if(Y=Math.max(Y,g(B/E,0,1)),F.setAttribute("aria-valuenow",String(Math.round(Y*100))),j)j.style.transform="scaleX("+Y.toFixed(3)+")"}function G(){if(J)return;if(J=!0,O(1,1),$)$.classList.add("hidden"),$.setAttribute("aria-hidden","true")}if(K)K.onLoad=G,K.onProgress=(B,E,D)=>O(E,D);return window.setTimeout(G,q!=null?q:5000),G.progress=O,G}function l2(K,q){q=q||{};let J=q.turnStep!=null?q.turnStep:0.35,$=q.zoomFactor!=null?q.zoomFactor:0.8,F=q.minDistance!=null?q.minDistance:1.5,j=typeof q.maxDistance==="function"?q.maxDistance:()=>q.maxDistance!=null?q.maxDistance:100,Y=document.createElement("div");Y.className="view-pad",Y.setAttribute("role","group"),Y.setAttribute("aria-label",q.label||"View controls");function O(B,E,D,M){let R=document.createElement("button");return R.type="button",R.className="view-pad-btn "+B,R.setAttribute("aria-label",D),R.innerHTML='<span aria-hidden="true">'+E+"</span>",R.addEventListener("click",M),Y.appendChild(R),R}O("view-pad-left","‹","Turn left",()=>{K.azimuthTarget+=J}),O("view-pad-right","›","Turn right",()=>{K.azimuthTarget-=J}),O("view-pad-in","+","Zoom in",()=>{K.distanceTarget=g(K.distanceTarget*$,F,j())}),O("view-pad-out","−","Zoom out",()=>{K.distanceTarget=g(K.distanceTarget/$,F,j())});let G=null;if(q.onRecenter)G=O("view-pad-recenter","⌖","Recenter the view",q.onRecenter),G.hidden=!0;return(q.parent||document.body).appendChild(Y),{element:Y,setRecenter(B,E){if(!G)return;if(B)G.setAttribute("aria-label",B);G.hidden=!E,Y.classList.toggle("has-recenter",!!E)}}}return{bindCameraKeys:m,createFrameLoop:U0,buildNav:E0,clamp:g,createAurora:S,createLoader:c2,createOrbitControls:z,createQualityGovernor:$2,createRenderer:L2,createScene:x2,createStarfield:H,createSun:A,createViewPad:l2,failWebGL:_2,GLSL_NOISE:_,glowShell:Q,initMobileHints:V0,initMobileInfoPanels:H0,prefersReducedMotion:D0,projectToScreen:a,revealRailButton:M0,seededRandom:Z,setText:B0,wirePlayPause:m2}}();window.SPACE=L0;window.THREE=N;export{N as THREE,L0 as SPACE};
