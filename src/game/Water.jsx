import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAKE } from './layout.js'
import { world } from './time.js'

// Göl: gökyüzünü yansıtan (Fresnel), dalgalı, güneş parıltılı ve kıyı köpüklü su
const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uNight;
  uniform vec2 uCenter;
  uniform float uIce;
  uniform float uRadius;
  varying vec3 vWorld;

  // Üst üste binen dört dalgadan analitik yüzey normali
  vec3 waveNormal(vec2 p, float t) {
    vec2 dirs[4];
    dirs[0] = vec2(0.8, 0.6);
    dirs[1] = vec2(-0.5, 0.86);
    dirs[2] = vec2(0.3, -0.95);
    dirs[3] = vec2(-0.9, -0.3);
    float dx = 0.0;
    float dz = 0.0;
    for (int i = 0; i < 4; i++) {
      float f = 0.9 + float(i) * 0.75;
      float ph = dot(dirs[i], p) * f + t * (1.0 + float(i) * 0.35);
      float c = cos(ph) * (0.06 / (1.0 + float(i))) * f;
      dx += dirs[i].x * c;
      dz += dirs[i].y * c;
    }
    return normalize(vec3(-dx, 1.0, -dz));
  }

  void main() {
    float d = clamp(distance(vWorld.xz, uCenter) / uRadius, 0.0, 1.0);
    vec3 n = waveNormal(vWorld.xz, uTime);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    // Yatay bakışta gökyüzü, dikey bakışta derinlik
    float fresnel = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 3.0);
    vec3 water = mix(uDeep, uShallow, smoothstep(0.25, 1.0, d));
    vec3 col = mix(water, uSky, clamp(fresnel * 0.85 + 0.12, 0.0, 1.0));
    // Güneş parıltısı
    vec3 r = reflect(-viewDir, n);
    float glint = pow(max(dot(r, normalize(uSunDir)), 0.0), 160.0) * (1.0 - uNight);
    col += vec3(1.0, 0.92, 0.75) * glint * 2.2;
    // Dalgalı kıyı köpüğü
    float ang = atan(vWorld.z - uCenter.y, vWorld.x - uCenter.x);
    float edge = smoothstep(0.84, 0.97, d + sin(ang * 9.0 + uTime * 1.5) * 0.015);
    col = mix(col, vec3(0.93, 0.96, 0.98), edge * 0.6);
    // Kış: kıyıdan içeri doğru dalgalı kenarlı buz tabakası
    float ice = smoothstep(0.0, 0.08, d + sin(ang * 5.0 + 1.3) * 0.05 - (1.0 - uIce * 0.75));
    vec3 iceCol = mix(vec3(0.78, 0.88, 0.95), vec3(0.95, 0.98, 1.0), fresnel) + glint * 0.6;
    col = mix(col, iceCol, ice * uIce);
    col *= mix(1.0, 0.32, uNight);
    gl_FragColor = vec4(col, mix(0.86, 0.96, 1.0 - d));
    #include <colorspace_fragment>
  }
`

export default function Water() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#174d73') },
      uShallow: { value: new THREE.Color('#4fa8c8') },
      uSky: { value: new THREE.Color('#9fd3ec') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uCenter: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
      uRadius: { value: LAKE.radius + 4 },
      uIce: { value: 0 },
    }),
    [],
  )
  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    uniforms.uNight.value = world.night
    uniforms.uIce.value = world.uniforms.uSeason.value.w
    uniforms.uSky.value.copy(world.skyHorizon)
    uniforms.uSunDir.value.copy(world.sunDir)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAKE.x, LAKE.waterLevel, LAKE.z]} receiveShadow>
      <circleGeometry args={[LAKE.radius + 4, 96]} />
      <shaderMaterial transparent uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  )
}
