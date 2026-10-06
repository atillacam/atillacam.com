import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AREAS, LAKE } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'

// Dünyaya hayat veren küçük canlılar: kuş sürüleri, kelebekler, süzülen yapraklar.
function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// Kanat çırpan basit kuş / kelebek: iki üçgen kanat, gövde ortada
function wingGeometry(span, depth) {
  const g = new THREE.BufferGeometry()
  // Sol ve sağ kanat; kanat çırpma shader'da y ekseninde yapılır
  const v = new Float32Array([0, 0, -depth / 2, 0, 0, depth / 2, -span, 0, 0, 0, 0, -depth / 2, span, 0, 0, 0, 0, depth / 2])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  g.setAttribute('aTip', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 0]), 1))
  g.computeVertexNormals()
  return g
}

function flapMaterial(color, speed, amount) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aTip;
      varying float vTip;
      void main() {
        vec3 p = position;
        float phase = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21;
        p.y += aTip * sin(uTime * ${speed.toFixed(1)} + phase) * ${amount.toFixed(2)};
        vTip = aTip;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uFade;
      varying float vTip;
      void main() {
        if (uFade < 0.02) discard;
        gl_FragColor = vec4(uColor * (0.75 + vTip * 0.35), uFade);
        #include <colorspace_fragment>
      }
    `,
  })
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
const _up = new THREE.Vector3(0, 1, 0)

function Birds() {
  const flocks = useMemo(() => {
    const rand = seeded(21)
    return Array.from({ length: 3 }, (_, f) => ({
      cx: (rand() - 0.5) * 140,
      cz: (rand() - 0.5) * 140,
      r: 35 + rand() * 30,
      y: 32 + rand() * 14,
      speed: (0.12 + rand() * 0.06) * (f % 2 ? 1 : -1),
      phase: rand() * Math.PI * 2,
      members: Array.from({ length: 7 }, (_, i) => ({ dx: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.6, dz: -Math.ceil(i / 2) * 1.8, bob: rand() * 6 })),
    }))
  }, [])
  const count = flocks.reduce((a, f) => a + f.members.length, 0)
  const geometry = useMemo(() => wingGeometry(0.7, 0.35), [])
  const material = useMemo(() => flapMaterial('#2a2d35', 9, 0.35), [])
  const mesh = useRef()

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta
    const sw = world.uniforms.uSeason.value
    material.uniforms.uFade.value = (1 - world.night * 0.85 - world.wet * 0.6) * (1 - sw.w * 0.75)
    const t = state.clock.elapsedTime
    let i = 0
    for (const f of flocks) {
      const a = f.phase + t * f.speed
      const dir = Math.sign(f.speed)
      const hx = -Math.sin(a) * dir
      const hz = Math.cos(a) * dir
      const yaw = Math.atan2(hx, hz)
      _q.setFromAxisAngle(_up, yaw)
      for (const m of f.members) {
        // V düzeni: lider önde, diğerleri çapraz arkada
        const cx = f.cx + Math.cos(a) * f.r
        const cz = f.cz + Math.sin(a) * f.r
        _p.set(cx + hz * m.dx + hx * m.dz, f.y + Math.sin(t * 1.3 + m.bob) * 0.4, cz - hx * m.dx + hz * m.dz)
        _m.compose(_p, _q, _s)
        mesh.current.setMatrixAt(i++, _m)
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}

function Butterflies() {
  const COUNT = 26
  const flies = useMemo(() => {
    const rand = seeded(33)
    const spots = AREAS.filter((a) => !a.outer && a.id !== 'race')
    return Array.from({ length: COUNT }, (_, i) => {
      const a = spots[i % spots.length]
      const ang = rand() * Math.PI * 2
      const r = a.radius + 1 + rand() * 3
      return { x: a.center[0] + Math.cos(ang) * r, z: a.center[2] + Math.sin(ang) * r, seed: rand() * 100 }
    })
  }, [])
  const geometry = useMemo(() => wingGeometry(0.16, 0.18), [])
  const materials = useMemo(() => ['#ffb547', '#ffffff', '#9b7bff'].map((c) => flapMaterial(c, 22, 0.14)), [])
  const meshes = useRef([])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const sw = world.uniforms.uSeason.value
    // Kelebekler ilkbahar ve yazın; sonbaharda az, kışın hiç
    const fade = Math.max(1 - world.night * 1.2 - world.wet, 0) * (sw.x + sw.y + sw.z * 0.25)
    materials.forEach((m) => {
      m.uniforms.uTime.value += delta
      m.uniforms.uFade.value = fade
    })
    const counters = [0, 0, 0]
    flies.forEach((f, i) => {
      const k = i % 3
      const mesh = meshes.current[k]
      if (!mesh) return
      // Rastgele görünen, yumuşak bir dolaşma yolu
      const x = f.x + Math.sin(t * 0.4 + f.seed) * 2.2 + Math.sin(t * 1.1 + f.seed * 2) * 0.6
      const z = f.z + Math.cos(t * 0.33 + f.seed) * 2.2
      const y = heightAt(f.x, f.z) + 0.7 + Math.sin(t * 1.7 + f.seed) * 0.35
      const dx = Math.cos(t * 0.4 + f.seed)
      const dz = -Math.sin(t * 0.33 + f.seed)
      _q.setFromAxisAngle(_up, Math.atan2(dx, dz))
      _p.set(x, y, z)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(counters[k]++, _m)
    })
    meshes.current.forEach((m) => m && (m.instanceMatrix.needsUpdate = true))
  })
  return materials.map((m, k) => (
    <instancedMesh key={k} ref={(el) => (meshes.current[k] = el)} args={[geometry, m, Math.ceil(COUNT / 3)]} frustumCulled={false} />
  ))
}

// Kameranın çevresinde süzülen yapraklar (sadece gündüz ve rüzgârlı havada belirgin)
function Leaves() {
  const COUNT = 160
  const data = useMemo(() => {
    const rand = seeded(44)
    const pos = new Float32Array(COUNT * 3)
    const col = new Float32Array(COUNT * 3)
    const palette = ['#6f9a3a', '#a7b43d', '#d79a32', '#b8622b'].map((c) => new THREE.Color(c))
    for (let i = 0; i < COUNT; i++) {
      pos.set([(rand() - 0.5) * 60, rand() * 14, (rand() - 0.5) * 60], i * 3)
      const c = palette[i % palette.length]
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  const points = useRef()
  useFrame(({ camera, clock }, delta) => {
    const p = points.current
    if (!p) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const pos = data.attributes.position.array
    for (let i = 0; i < COUNT; i++) {
      const o = i * 3
      pos[o] += (Math.sin(t * 0.9 + i) * 0.6 + 0.5) * dt
      pos[o + 1] -= (0.7 + (i % 5) * 0.12) * dt
      pos[o + 2] += Math.cos(t * 0.7 + i * 1.3) * 0.5 * dt
      if (pos[o + 1] < -1) pos[o + 1] += 15
    }
    data.attributes.position.needsUpdate = true
    p.position.set(camera.position.x, Math.max(vehicleGroundY(camera), 0), camera.position.z)
    const sw = world.uniforms.uSeason.value
    // Süzülen yapraklar en çok sonbaharda; kışın yok
    p.material.opacity = Math.max(0.85 - world.night * 0.7 - world.snowy, 0) * (0.3 + sw.z * 0.7) * (1 - sw.w)
  })
  return (
    <points ref={points} geometry={data} frustumCulled={false}>
      <pointsMaterial size={0.14} vertexColors transparent opacity={0.85} depthWrite={false} sizeAttenuation />
    </points>
  )
}

// Martılar: Kız Kulesi'nin çevresinde alçaktan, tek tek süzülerek döner
function Gulls() {
  const gulls = useMemo(() => {
    const rand = seeded(57)
    return Array.from({ length: 7 }, () => ({
      r: 5 + rand() * 9,
      y: 5.5 + rand() * 6,
      speed: (0.32 + rand() * 0.25) * (rand() > 0.3 ? 1 : -1),
      phase: rand() * Math.PI * 2,
      wobble: rand() * 6,
    }))
  }, [])
  const geometry = useMemo(() => wingGeometry(0.62, 0.3), [])
  const material = useMemo(() => flapMaterial('#f4f3ee', 6, 0.28), [])
  const mesh = useRef()

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta
    material.uniforms.uFade.value = 1 - world.night * 0.8 - world.wet * 0.5
    const t = state.clock.elapsedTime
    gulls.forEach((g, i) => {
      // Yarıçap hafifçe nefes alır: düz bir daire yerine süzülen bir yörünge
      const a = g.phase + t * g.speed
      const r = g.r + Math.sin(t * 0.4 + g.wobble) * 1.5
      const dir = Math.sign(g.speed)
      _q.setFromAxisAngle(_up, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir))
      _p.set(LAKE.x + Math.cos(a) * r, LAKE.waterLevel + g.y + Math.sin(t * 0.9 + g.wobble) * 0.6, LAKE.z + Math.sin(a) * r)
      _m.compose(_p, _q, _s)
      mesh.current.setMatrixAt(i, _m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, gulls.length]} frustumCulled={false} />
}

function vehicleGroundY(camera) {
  return heightAt(camera.position.x, camera.position.z)
}

export default function Life() {
  return (
    <>
      <Birds />
      <Gulls />
      <Butterflies />
      <Leaves />
    </>
  )
}
