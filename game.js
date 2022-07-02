function main() {
    const canvas = document.getElementById("canvas");
    const engine = new BABYLON.Engine(canvas);

    function run() {
        const scene = new BABYLON.Scene(engine);

        const camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5,-10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(canvas, false);

        scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        scene.fogStart = 0.1;
        scene.fogEnd = 1000.0;
        scene.fogColor = new BABYLON.Color3(0.74, 0.77, 0.91);

        const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("gdhm", "heightmap.jpg", {
            width: 3072, height: 3072, subdivisions: 250, maxHeight: 180
        });
/*
        function createGrass(numBlades, radius) {
            const BLADE_SEGS = 4;
            const BLADE_VERTS = (BLADE_SEGS + 1) * 2;
            const BLADE_INDICES = BLADE_SEGS * 12;
            const BLADE_WIDTH = 0.15;
            const BLADE_HEIGHT_MIN = 2.25;
            const BLADE_HEIGHT_MAX = 3.0;
	        const buffers = {
		        vindex: new Float32Array(BLADE_VERTS * 2 * 1),
		        shape: new Float32Array(4 * numBlades),
		        offset: new Float32Array(4 * numBlades),
		        index: new Uint16Array(BLADE_INDICES)
	        }

            function initBladeIndices(id, vc1, vc2, i) {
                let seg;
                // blade front side
                for (seg = 0; seg < BLADE_SEGS; ++seg) {
                    id[i++] = vc1 + 0 // tri 1
                    id[i++] = vc1 + 1
                    id[i++] = vc1 + 2
                    id[i++] = vc1 + 2 // tri 2
                    id[i++] = vc1 + 1
                    id[i++] = vc1 + 3
                    vc1 += 2
                }
                // blade back side
                for (seg = 0; seg < BLADE_SEGS; ++seg) {
                    id[i++] = vc2 + 2 // tri 1
                    id[i++] = vc2 + 1
                    id[i++] = vc2 + 0
                    id[i++] = vc2 + 3 // tri 2
                    id[i++] = vc2 + 1
                    id[i++] = vc2 + 2
                    vc2 += 2
                }
            }
            function initBladeOffsetVerts(offset, numBlades, patchRadius) {
                for (let i = 0; i < numBlades; ++i) {
                    offset[i * 4 + 0] = nrand() * patchRadius // x
                    offset[i * 4 + 1] = nrand() * patchRadius // y
                    offset[i * 4 + 2] = 0.0 // z
                    offset[i * 4 + 3] = Math.PI * 2.0 * Math.random() // rot
                }
            }
            function initBladeShapeVerts(shape, numBlades, offset) {
                let noise = 0
                for (let i = 0; i < numBlades; ++i) {
                    noise = Math.abs(simplex(offset[i * 4 + 0] * 0.03, offset[i * 4 + 1] * 0.03))
                    noise = noise * noise * noise
                    noise *= 5.0
                    shape[i * 4 + 0] = BLADE_WIDTH + Math.random() * BLADE_WIDTH * 0.5 // width
                    shape[i * 4 + 1] = BLADE_HEIGHT_MIN + Math.pow(Math.random(), 4.0) * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN) + // height
                        noise
                    shape[i * 4 + 2] = 0.0 + Math.random() * 0.3 // lean
                    shape[i * 4 + 3] = 0.05 + Math.random() * 0.3 // curve
                }
            }
            function initBladeIndexVerts(vindex) {
                for (let i = 0; i < vindex.length; ++i) {
                    vindex[i] = i
                }
            }
        	initBladeIndices(buffers.index, 0, BLADE_VERTS, 0)
            initBladeOffsetVerts(buffers.offset, numBlades, radius)
            initBladeShapeVerts(buffers.shape, numBlades, buffers.offset)
            initBladeIndexVerts(buffers.vindex)

            BABYLON.Effect.ShadersStore['grassVertexShader'] = `
// LICENSE: MIT
// Copyright (c) 2017 by Mike Linkovich

precision highp float;

#define PI 3.141592654

// These define values should be replaced by app before compiled
#define PATCH_SIZE (100.0)
#define BLADE_SEGS (4.0) // # of blade segments
#define BLADE_HEIGHT_TALL (4.5) // height of a tall blade

#define BLADE_DIVS (BLADE_SEGS + 1.0)  // # of divisions
#define BLADE_VERTS (BLADE_DIVS * 2.0) // # of vertices (per side, so 1/2 total)

#define TRANSITION_LOW   (0.31)  // elevation of beach-grass transition (start)
#define TRANSITION_HIGH  (0.36) // (end)
#define TRANSITION_NOISE 0.06                  // transition noise scale

const vec3 LIGHT_COLOR = vec3(1.0, 1.0, 0.99);
const vec3 SPECULAR_COLOR = vec3(1.0, 1.0, 0.0);

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 lightDir;
uniform vec3 camDir; // direction cam is looking at
uniform vec2 drawPos; // centre of where we want to draw
uniform float time;  // used to animate blades
uniform sampler2D heightMap;
uniform vec3 heightMapScale;
uniform vec3 grassColor;
uniform float windIntensity;

attribute float vindex; // Which vertex are we drawing - the main thing we need to know
attribute vec4 offset; // {x:x, y:y, z:z, w:rot} (blade's position & rotation)
attribute vec4 shape; // {x:width, y:height, z:lean, w:curve} (blade's shape properties)

varying vec2 vSamplePos;
varying vec4 vColor;
varying vec2 vUv;

// Rotate by an angle
vec2 rotate (float x, float y, float r) {
	float c = cos(r);
	float s = sin(r);
	return vec2(x * c - y * s, x * s + y * c);
}

// Rotate by a vector
vec2 rotate (float x, float y, vec2 r) {
	return vec2(x * r.x - y * r.y, x * r.y + y * r.x);
}

void main() {
	float vi = mod(vindex, BLADE_VERTS); // vertex index for this side of the blade
	float di = floor(vi / 2.0);  // div index (0 .. BLADE_DIVS)
	float hpct = di / BLADE_SEGS;  // percent of height of blade this vertex is at
	float bside = floor(vindex / BLADE_VERTS);  // front/back side of blade
	float bedge = mod(vi, 2.0);  // left/right edge (x=0 or x=1)
	// Vertex position - start with 2D shape, no bend applied
	vec3 vpos = vec3(
		shape.x * (bedge - 0.5) * (1.0 - pow(hpct, 3.0)), // taper blade edges as approach tip
		0.0, // flat y, unbent
		shape.y * di / BLADE_SEGS // height of vtx, unbent
	);

	// Start computing a normal for this vertex
	vec3 normal = vec3(rotate(0.0, bside * 2.0 - 1.0, offset.w), 0.0);

	// Apply blade's natural curve amount
	float curve = shape.w;
	// Then add animated curve amount by time using this blade's
	// unique properties to randomize its oscillation
	curve += shape.w + 0.125 * (sin(time * 4.0 + offset.w * 0.2 * shape.y + offset.x + offset.y));
	// put lean and curve together
	float rot = shape.z + curve * hpct;
	vec2 rotv = vec2(cos(rot), sin(rot));
	vpos.yz = rotate(vpos.y, vpos.z, rotv);
	normal.yz = rotate(normal.y, normal.z, rotv);

	// rotation of this blade as a vector
	rotv = vec2(cos(offset.w), sin(offset.w));
	vpos.xy = rotate(vpos.x, vpos.y, rotv);

	// Based on centre of view cone position, what grid tile should
	// this piece of grass be drawn at?
	vec2 gridOffset = vec2(
		floor((drawPos.x - offset.x) / PATCH_SIZE) * PATCH_SIZE + PATCH_SIZE / 2.0,
		floor((drawPos.y - offset.y) / PATCH_SIZE) * PATCH_SIZE + PATCH_SIZE / 2.0
	);

	// Find the blade mesh world x,y position
	vec2 bladePos = vec2(offset.xy + gridOffset);

	// height/light map sample position
	vSamplePos = bladePos.xy * heightMapScale.xy + vec2(0.5, 0.5);

	// Compute wind effect
	// Using the lighting channel as noise seems make the best looking wind for some reason!
	float wind = texture2D(heightMap, vec2(vSamplePos.x - time / 2500.0, vSamplePos.y - time / 200.0) * 6.0).g;
	//float wind = texture2D(heightMap, vec2(vSamplePos.x - time / 2500.0, vSamplePos.y - time / 100.0) * 6.0).r;
	//float wind = texture2D(heightMap, vec2(vSamplePos.x - time / 2500.0, vSamplePos.y - time / 100.0) * 4.0).b;
	// Apply some exaggeration to wind
	//wind = (clamp(wind, 0.125, 0.875) - 0.125) * (1.0 / 0.75);
	wind = (clamp(wind, 0.25, 1.0) - 0.25) * (1.0 / 0.75);
	wind = wind * wind * windIntensity;
	wind *= hpct; // scale wind by height of blade
	wind = -wind;
	rotv = vec2(cos(wind), sin(wind));
	// Wind blows in axis-aligned direction to make things simpler
	vpos.yz = rotate(vpos.y, vpos.z, rotv);
	normal.yz = rotate(normal.y, normal.z, rotv);

	// Sample the heightfield data texture to get altitude for this blade position
	vec4 hdata = texture2D(heightMap, vSamplePos);
	float altitude = hdata.r;

	// Determine if we want the grass to appear or not
	// Use the noise channel to perturb the altitude grass starts growing at.
	float noisyAltitude = altitude + hdata.b * TRANSITION_NOISE - (TRANSITION_NOISE / 2.0);
	float degenerate = (clamp(noisyAltitude, TRANSITION_LOW, TRANSITION_HIGH) - TRANSITION_LOW)
		* (1.0 / (TRANSITION_HIGH - TRANSITION_LOW));

	// Transition geometry toward degenerate as we approach beach altitude
	vpos *= degenerate;

	// Vertex color must be brighter because it is multiplied with blade texture
	vec3 color = min(vec3(grassColor.r * 1.25, grassColor.g * 1.25, grassColor.b * 0.95), 1.0);
	altitude *= heightMapScale.z;

	// Compute directional (sun) light for this vertex
	float diffuse = abs(dot(normal, lightDir)); // max(-dot(normal, lightDir), 0.0);
	float specMag = max(-dot(normal, lightDir), 0.0) * max(-dot(normal, camDir), 0.0);
	specMag = pow(specMag, 1.5); // * specMag * specMag;
	vec3 specular = specMag * SPECULAR_COLOR * 0.4;
	// Directional plus ambient
	float light = 0.35 * diffuse + 0.65;
	// Ambient occlusion shading - the lower vertex, the darker
	float heightLight = 1.0 - hpct;
	heightLight = heightLight * heightLight;
	light = max(light - heightLight * 0.5, 0.0);
	vColor = vec4(
		// Each blade is randomly colourized a bit by its position
		light * 0.75 + cos(offset.x * 80.0) * 0.1,
		light * 0.95 + sin(offset.y * 140.0) * 0.05,
		light * 0.95 + sin(offset.x * 99.0) * 0.05,
		1.0
	);
	vColor.rgb = vColor.rgb * LIGHT_COLOR * color;
	vColor.rgb = min(vColor.rgb + specular, 1.0);

	// grass texture coordinate for this vertex
	vUv = vec2(bedge, di * 2.0);

	// Translate to world coordinates
	vpos.x += bladePos.x;
	vpos.y += bladePos.y;
	vpos.z += altitude;

	gl_Position = projectionMatrix * modelViewMatrix * vec4(vpos, 1.0);
}
`
            BABYLON.Effect.ShadersStore['grassFragmentShader'] = `
// LICENSE: MIT
// Copyright (c) 2017 by Mike Linkovich

precision highp float;

uniform sampler2D map;
uniform sampler2D heightMap;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float grassFogFar;

varying vec2 vSamplePos;
varying vec4 vColor;
varying vec2 vUv;

void main() {
	vec4 color = vec4(vColor) * texture2D(map, vUv);
	vec4 hdata = texture2D(heightMap, vSamplePos);

	float depth = gl_FragCoord.z / gl_FragCoord.w;

	// make grass transparent as it approachs outer view distance perimeter
	color.a = 1.0 - smoothstep(grassFogFar * 0.55, grassFogFar * 0.8, depth);

	// apply terrain lightmap
	float light = hdata.g;
	color.r *= light;
	color.g *= light;
	color.b *= light;

	// then apply atmosphere fog
	float fogFactor = smoothstep(fogNear, fogFar, depth);
	color.rgb = mix(color.rgb, fogColor, fogFactor);
	// output
	gl_FragColor = color;
}
`
            const grassMaterial = new BABYLON.ShaderMaterial(
                "grass",
                scene,
               {
                  vertex: "grass",
                  fragment: "grass",
                },
                {
                  attributes: ["position", "normal", "uv"],
                  uniforms: ["world", "worldView", "worldViewProjection", "view", "projection"],
                },
            );
        }

        createGrass()*/
    }
    run();
}

main();

