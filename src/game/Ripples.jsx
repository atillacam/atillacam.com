import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicleState } from './input.js'
import { LAKE } from './layout.js'
import { world } from './time.js'

// Göl yüzeyinde genişleyip sönen dalga halkaları:
//  - Araba suya girince büyük bir halka, içinde ilerledikçe arkasında iz halkaları
//  - Yağmurda yüzeye rastgele düşen küçük damla halkaları
// Kışın göl buz tuttuğunda halka çıkmaz.
const COUNT = 96

export default function Ripples() {
  const mesh = useRef()
  const state = useMemo(() => ({ cursor: 0, time: 0, inWater: false, wakeTimer: 0, rainTimer: 0 }), [])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(new Float32Array(COUNT).fill(-1000), 1))
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(COUNT).fill(1), 1))
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aBirth;
          attribute float aSize;
          uniform float uTime;
          varying float vAge;
          varying vec2 vUv;
          void main() {
            vAge = (uTime - aBirth) / (0.9 + aSize * 0.5);
            vUv = uv;
            // Halka zamanla büyür
            float grow = 0.3 + clamp(vAge, 0.0, 1.0) * aSize;
            vec4 p = instanceMatrix * vec4(position * vec3(grow, 1.0, grow), 1.0);
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uNight;
          varying float vAge;
          varying vec2 vUv;
          void main() {
            if (vAge < 0.0 || vAge > 1.0) discard;
            float d = length(vUv - 0.5) * 2.0;
            // İnce parlak halka + içinde ikinci, daha sönük halka
            float ring = smoothstep(0.1, 0.0, abs(d - 0.85)) + 0.5 * smoothstep(0.08, 0.0, abs(d - 0.55));
            float a = ring * (1.0 - vAge) * (1.0 - vAge) * 0.6;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.92, 0.97, 1.0) * mix(1.0, 0.4, uNight), a);
          }
        `,
      }),
    [],
  )

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _s = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame((_, delta) => {
    const s = state
    const dt = Math.min(delta, 0.1)
    s.time += dt
    material.uniforms.uTime.value = s.time
    material.uniforms.uNight.value = world.night
    const im = mesh.current
    if (!im) return
    const frozen = world.uniforms.uSeason.value.w > 0.6
    const y = LAKE.waterLevel + 0.02
    let dirty = false
    const spawn = (x, z, size) => {
      const i = s.cursor
      s.cursor = (s.cursor + 1) % COUNT
      _p.set(x, y, z)
      _m.compose(_p, _q, _s.set(1, 1, 1))
      im.setMatrixAt(i, _m)
      geometry.attributes.aBirth.setX(i, s.time)
      geometry.attributes.aSize.setX(i, size)
      dirty = true
    }

    // Araba gölde mi?
    const c = vehicleState.position
    const inWater = !frozen && Math.hypot(c.x - LAKE.x, c.z - LAKE.z) < LAKE.radius + 2 && c.y < LAKE.waterLevel + 1.1
    if (inWater && !s.inWater) {
      spawn(c.x, c.z, 7)
      spawn(c.x, c.z, 4)
    }
    s.inWater = inWater
    if (inWater) {
      // Hıza göre sıklaşan iz halkaları
      s.wakeTimer -= dt * (0.4 + Math.min(Math.abs(vehicleState.speed), 15) / 6)
      if (s.wakeTimer <= 0) {
        s.wakeTimer = 0.35
        spawn(c.x + (Math.random() - 0.5), c.z + (Math.random() - 0.5), 2.5 + Math.random() * 1.5)
      }
    }

    // Yağmur damlaları
    if (!frozen && world.wet > 0.3) {
      s.rainTimer -= dt * world.wet * 14
      while (s.rainTimer <= 0) {
        s.rainTimer += 1
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * (LAKE.radius + 2)
        spawn(LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r, 0.5 + Math.random() * 0.5)
      }
    }

    if (dirty) {
      im.instanceMatrix.needsUpdate = true
      geometry.attributes.aBirth.needsUpdate = true
      geometry.attributes.aSize.needsUpdate = true
    }
  })

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={2} />
}
