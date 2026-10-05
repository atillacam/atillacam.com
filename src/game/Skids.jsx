import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicleState } from './input.js'
import { AREAS } from './layout.js'
import { flatMask, shoreFactor } from './terrain.js'
import { world } from './time.js'

// Arka tekerleklerin bıraktığı izler. İki tür:
//  - Kayma izi: drift ya da sert frende, her zeminde koyu lastik izi
//  - Zemin izi: yumuşak zeminde (kar, kum, toprak, ıslak çimen) her zaman, zemin rengine uygun
// Sabit boyutlu halka tampon: en eski iz yerine yenisi yazılır, izler ömrüne göre solar.
const COUNT = 1400
const SKID_WIDTH = 0.17
const TRACK_WIDTH = 0.24
const OFFROAD = AREAS.find((a) => a.id === 'offroad')

// [r, g, b, opaklık, ömür (sn)]
const SURFACES = {
  skid: [0.08, 0.08, 0.09, 0.38, 8],
  snow: [0.42, 0.5, 0.62, 0.8, 35],
  sand: [0.5, 0.4, 0.26, 0.5, 22],
  dirt: [0.24, 0.17, 0.1, 0.55, 28],
  wet: [0.17, 0.22, 0.12, 0.32, 14],
}

// Tekerleğin altındaki zemin türü; iz bırakmayan sert zeminde null
function surfaceAt(x, z) {
  const paved = flatMask(x, z) < 0.12
  if (paved) return null
  if (Math.hypot(x - OFFROAD.center[0], z - OFFROAD.center[2]) < OFFROAD.radius + 1) return world.snowCover > 0.3 ? 'snow' : 'dirt'
  if (world.snowCover > 0.3) return 'snow'
  if (shoreFactor(x, z) < 0.5) return 'sand'
  if (world.wet > 0.4) return 'wet'
  return null
}

export default function Skids() {
  const mesh = useRef()
  const state = useMemo(() => ({ cursor: 0, last: [null, null], kind: [null, null], time: 0 }), [])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(new Float32Array(COUNT).fill(-1000), 1))
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(COUNT).fill(1), 1))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4))
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aBirth;
          attribute float aLife;
          attribute vec4 aTint;
          uniform float uTime;
          varying float vAlpha;
          varying vec4 vTint;
          varying vec2 vUv;
          void main() {
            float age = (uTime - aBirth) / aLife;
            vAlpha = clamp(1.0 - age, 0.0, 1.0);
            vTint = aTint;
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uNight;
          varying float vAlpha;
          varying vec4 vTint;
          varying vec2 vUv;
          void main() {
            if (vAlpha <= 0.0) discard;
            // Kenarlara doğru yumuşayan iz, ortada hafif sırt (lastik deseni hissi)
            float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
            float tread = 0.85 + 0.15 * step(0.5, fract(vUv.y * 6.0));
            gl_FragColor = vec4(vTint.rgb * tread * mix(1.0, 0.35, uNight), vTint.a * vAlpha * edge);
          }
        `,
      }),
    [],
  )

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  const _s = useMemo(() => new THREE.Vector3(), [])
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, delta) => {
    const s = state
    s.time += Math.min(delta, 0.1)
    material.uniforms.uTime.value = s.time
    material.uniforms.uNight.value = world.night
    const im = mesh.current
    if (!im) return
    const speed = Math.abs(vehicleState.speed)
    const sliding = vehicleState.slip > 1.5 || (vehicleState.braking && speed > 6)
    let dirty = false

    for (let w = 0; w < 2; w++) {
      const p = vehicleState.rearWheels[w]
      const contact = vehicleState.rearContact[w]
      const ground = contact && speed > 1 ? surfaceAt(p.x, p.z) : null
      const kind = sliding && contact && speed > 3 ? 'skid' : ground
      if (!kind) {
        s.last[w] = null
        continue
      }
      const prev = s.last[w]
      // İz türü değişince yeni şerit başlat (ör. çimenden kara geçiş)
      if (!prev || s.kind[w] !== kind) {
        s.last[w] = { x: p.x, y: p.y, z: p.z }
        s.kind[w] = kind
        continue
      }
      const dx = p.x - prev.x
      const dz = p.z - prev.z
      const len = Math.hypot(dx, dz)
      if (len < 0.25) continue
      if (len > 3) {
        // ışınlanma ya da sıçrama: izi kopar
        s.last[w] = { x: p.x, y: p.y, z: p.z }
        continue
      }
      const [r, g, b, a, life] = SURFACES[kind]
      const i = s.cursor
      s.cursor = (s.cursor + 1) % COUNT
      _p.set((p.x + prev.x) / 2, (p.y + prev.y) / 2 + 0.03, (p.z + prev.z) / 2)
      _q.setFromAxisAngle(_up, Math.atan2(dx, dz))
      _s.set(kind === 'skid' ? SKID_WIDTH : TRACK_WIDTH, 1, len + 0.04)
      _m.compose(_p, _q, _s)
      im.setMatrixAt(i, _m)
      geometry.attributes.aBirth.setX(i, s.time)
      geometry.attributes.aLife.setX(i, life)
      geometry.attributes.aTint.setXYZW(i, r, g, b, a)
      s.last[w] = { x: p.x, y: p.y, z: p.z }
      dirty = true
    }
    if (dirty) {
      im.instanceMatrix.needsUpdate = true
      geometry.attributes.aBirth.needsUpdate = true
      geometry.attributes.aLife.needsUpdate = true
      geometry.attributes.aTint.needsUpdate = true
    }
  })

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={1} />
}
