import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { MODEL_URLS, useScatter } from './scatter.js'
import Halo from './Halo.jsx'
import { world } from './time.js'
import { bakedGeometry } from './geometry.js'

// Akçaağaç yaprakları kendi ışık saçan dokusuyla beyazımsı parlar; kapatıp doğal yeşile çekiyoruz
const MAPLE_FIX = { sugar_maple_leaf: { emissiveIntensity: 0, color: '#8fb565' } }

// Lamba modelinin tabanı saf siyah gelir; koyu antrasite çeviriyoruz
const LAMP_FIX = { 'Material.001': { color: '#3b404c', roughness: 0.6, metalness: 0.4 }, 'Material.005': { color: '#2c313b', metalness: 0.6, roughness: 0.45 } }

// GLB içindeki her parça için bir InstancedMesh; dünya ızgara hücrelerine bölünür ki kamera ve gölge
// ışığı görmediği hücreleri hiç çizmesin (frustum culling). Ölçüldü: 60 m çağrıyı yalnızca %2 azaltıp
// çizilen üçgeni %50 artırıyor; 30 m daha dengeli.
const CELL = 30
function Instances({ url, items, castShadow = true, receiveShadow = true, wind = 0, overrides }) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => {
    const list = []
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if (!o.isMesh) return
      const geometry = bakedGeometry(o)
      let material = o.material
      const fix = overrides?.[o.material.name]
      if (fix) {
        material = o.material.clone()
        Object.entries(fix).forEach(([k, val]) => (k === 'color' ? material.color.set(val) : (material[k] = val)))
      }
      material = material.clone()
      // Adı yaprak/çalı/çimen olan malzemeler doğrudan mevsimle renk değiştirir
      const foliage = /leaf|bush|grass/i.test(material.name)
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = world.uniforms.uTime
        shader.uniforms.uCar = world.uniforms.uCar
        shader.uniforms.uSeason = world.uniforms.uSeason
        shader.uniforms.uSnow = world.uniforms.uSnow
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vSeeWorld;\nvarying vec3 vSeasonN;\nvarying float vSeasonSeed;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec3 wpos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
            #else
              vec3 wpos = transformed;
            #endif
            ${
              wind > 0
                ? `float bend = max(transformed.y, 0.0);
            float gust = sin(uTime * 1.3 + wpos.x * 0.21 + wpos.z * 0.17) * 0.6 + sin(uTime * 2.7 + wpos.x * 0.6) * 0.25;
            transformed.x += gust * ${wind.toFixed(4)} * bend * bend;
            transformed.z += gust * ${(wind * 0.6).toFixed(4)} * bend * bend;`
                : ''
            }
            #ifdef USE_INSTANCING
              vSeeWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
              vSeasonN = mat3(modelMatrix * instanceMatrix) * objectNormal;
              vSeasonSeed = fract(sin(instanceMatrix[3].x * 12.9898 + instanceMatrix[3].z * 78.233) * 43758.5453);
            #else
              vSeeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
              vSeasonN = mat3(modelMatrix) * objectNormal;
              vSeasonSeed = 0.5;
            #endif`,
          )
        // Kamera ile araç arasındaki görüş hattına giren yüzeyler desenli şekilde şeffaflaşır (gölgeler etkilenmez)
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uCar;\nuniform vec4 uSeason;\nuniform float uSnow;\nvarying vec3 vSeeWorld;\nvarying vec3 vSeasonN;\nvarying float vSeasonSeed;')
          .replace('#include <color_fragment>', `#include <color_fragment>
          {
            // Yeşil yüzeyler (yaprak, çimen) mevsime göre renk değiştirir; gövde, kaya, çit etkilenmez
            vec3 c = diffuseColor.rgb;
            float lum = dot(c, vec3(0.299, 0.587, 0.114));
            // Tek dokulu ağaçlarda: sarımsı yeşiller dahil yeşil tonlar; kahverengi gövde, gri kaya dışarıda
            float green = ${foliage ? '1.0' : 'smoothstep(0.02, 0.1, c.g - c.b) * smoothstep(-0.12, 0.0, c.g - c.r)'};
            // İlkbahar: taze yeşil ve pembe-beyaz çiçek benekleri
            float bloom = step(0.84, fract(sin(dot(floor(vSeeWorld * 2.4), vec3(12.9898, 78.233, 37.719))) * 43758.5453));
            vec3 spring = mix(c * vec3(0.95, 1.14, 0.9), mix(vec3(1.0, 0.74, 0.84), vec3(1.0), vSeasonSeed) * (0.55 + lum), bloom * 0.8);
            // Sonbahar: ağaç başına kızıl–turuncu–sarı ton
            vec3 autumn = mix(vec3(0.82, 0.3, 0.07), vec3(0.96, 0.7, 0.16), vSeasonSeed) * (0.5 + lum * 1.7);
            // Kış: soluk, gri-mavi
            vec3 winter = mix(vec3(lum), c, 0.3) * vec3(0.88, 0.93, 1.0);
            vec3 seasonal = spring * uSeason.x + c * uSeason.y + autumn * uSeason.z + winter * uSeason.w;
            c = mix(c, seasonal, green);
            c = mix(c, vec3(lum), uSeason.w * 0.25 * (1.0 - green));
            // Kar: yukarı bakan yüzeylerde birikir
            float up = smoothstep(0.3, 0.85, normalize(vSeasonN).y);
            c = mix(c, vec3(0.93, 0.96, 1.0), up * uSnow * 0.9);
            diffuseColor.rgb = c;
          }`)
          .replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
            {
              vec3 toCar = uCar - cameraPosition;
              float len = length(toCar);
              vec3 dir = toCar / max(len, 0.0001);
              float t = dot(vSeeWorld - cameraPosition, dir);
              if (t > 0.0 && t < len - 1.6) {
                float d = length(vSeeWorld - (cameraPosition + dir * t));
                float keep = smoothstep(1.6, 3.8, d) + smoothstep(len - 4.0, len - 1.6, t);
                // 4×4 Bayer düzenli deseni: gürültüsüz, yumuşak geçiş
                ivec2 bp = ivec2(mod(gl_FragCoord.xy, 4.0));
                const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
                float threshold = (bayer[bp.x + bp.y * 4] + 0.5) / 16.0;
                if (threshold > keep) discard;
              }
            }`,
          )
      }
      material.customProgramCacheKey = () => `veg-${wind}-season-${foliage}`
      list.push({ geometry, material })
    })
    return list
  }, [scene, wind, overrides])

  const chunks = useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const key = `${Math.floor(it.x / CELL)}:${Math.floor(it.z / CELL)}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    return [...map.values()]
  }, [items])

  return chunks.map((chunk, ci) =>
    parts.map((p, pi) => <InstancedChunk key={`${ci}-${pi}`} part={p} items={chunk} castShadow={castShadow} receiveShadow={receiveShadow} />),
  )
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

function InstancedChunk({ part, items, castShadow, receiveShadow }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    items.forEach((it, i) => {
      _q.setFromAxisAngle(_up, it.rot)
      _p.set(it.x, it.y, it.z)
      // Ölçeği verilmeyen yerleşimler 1 kabul edilir (yoksa matris NaN olur ve model görünmez)
      _s.setScalar(it.scale ?? 1)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[part.geometry, part.material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />
}

// Gece yanan lamba başlıkları
function LampBulbs({ lamps }) {
  const ref = useRef()
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffbe6b', emissiveIntensity: 0 }), [])
  useLayoutEffect(() => {
    lamps.forEach((l, i) => {
      _m.makeTranslation(l.bulb.x, l.bulb.y, l.bulb.z)
      ref.current.setMatrixAt(i, _m)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [lamps])
  useFrame(() => {
    material.emissiveIntensity = 0.15 + world.night * 6
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, material, lamps.length]}>
        <sphereGeometry args={[0.12, 12, 10]} />
      </instancedMesh>
      {lamps.map((l, i) => (
        <Halo key={i} position={l.bulb} />
      ))}
    </>
  )
}

export default function Vegetation({ quality = 'high' }) {
  const density = quality === 'high' ? 1 : 0.55
  const { trees, rocks, bushes, decor, walls, lamps } = useScatter(density)
  const byKind = (list, kind) => list.filter((t) => t.kind === kind)

  return (
    <>
      <Instances url={MODEL_URLS.tree} items={byKind(trees, 'tree')} wind={0.006} />
      <Instances url={MODEL_URLS.maple} items={byKind(trees, 'maple')} wind={0.005} overrides={MAPLE_FIX} />
      <Instances url={MODEL_URLS.oak} items={byKind(trees, 'oak')} wind={0.006} />
      <Instances url={MODEL_URLS.bush} items={bushes} wind={0.05} />
      <Instances url={MODEL_URLS.rock} items={rocks} />
      <Instances url={MODEL_URLS.grass} items={byKind(decor, 'grass')} castShadow={false} wind={0.35} />
      <Instances url={MODEL_URLS.flower} items={byKind(decor, 'flower')} castShadow={false} wind={0.6} />
      <Instances url={MODEL_URLS.wall} items={walls} />
      <Instances url={MODEL_URLS.lamp} items={lamps} overrides={LAMP_FIX} />
      <LampBulbs lamps={lamps} />

      {/* Çarpışmalar: tek sabit gövde, çok sayıda collider */}
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CylinderCollider key={`t${i}`} args={[1.6, 0.32 * t.scale]} position={[t.x, t.y + 1.6, t.z]} />
        ))}
        {rocks.map((r, i) => (
          <CuboidCollider key={`r${i}`} args={[1.2 * r.scale, 0.85 * r.scale, 1.15 * r.scale]} position={[r.x, r.y + 0.6 * r.scale, r.z]} rotation={[0, r.rot, 0]} />
        ))}
        {walls.map((w, i) => (
          <CuboidCollider key={`w${i}`} args={[1.6 * w.scale, 0.7 * w.scale, 0.55 * w.scale]} position={[w.x, w.y + 0.7 * w.scale, w.z]} rotation={[0, w.rot, 0]} />
        ))}
        {lamps.map((l, i) => (
          <CylinderCollider key={`l${i}`} args={[1.7, 0.14]} position={[l.x, l.y + 1.7, l.z]} />
        ))}
      </RigidBody>
    </>
  )
}

for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url)
