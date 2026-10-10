import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { ASIA_BUILDINGS, ASIA_MOSQUE, ASIA_STREETS, ROUNDABOUTS, TEA_GARDEN } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { fontBlack } from './fonts.js'
import { Flag } from './Istanbul.jsx'
import StaticMerge from './StaticMerge.jsx'
import Halo from './Halo.jsx'

// Asya Yakası: sokaklı bir mahalle. Binalar zemin katta dükkân ve tente, katlarda balkon, kiremit ya da
// korkuluklu düz çatı; gece pencerelerin bir kısmı ve dükkânlar yanar. Meydanda dilek çeşmesi, sahilde
// çay bahçesi, sokaklarda lamba. Tekrarlanan her parça toplu çizilir (instanced): çizim maliyeti düşük.

const TINTS = ['#ead8b8', '#e0a98a', '#ecd07a', '#a9c6d6', '#c5d6b2', '#f2e9df', '#d9a8a8', '#d7b98e'].map((c) => new THREE.Color(c))
const AWNINGS = ['#c8302c', '#2f7f5f', '#2f5fa8', '#d9822b', '#7a3b8f'].map((c) => new THREE.Color(c))
const FLOOR = 3 // m

// Cephe dokusu: bir hücre = bir pencere aralığı (beyaz duvar bina rengiyle çarpılır), çerçeve, cam, panjur
function facadeTextures() {
  const size = 128
  const make = (lit) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const g = canvas.getContext('2d')
    g.fillStyle = lit ? '#000' : '#fff'
    g.fillRect(0, 0, size, size)
    if (lit) {
      const glow = g.createLinearGradient(0, 30, 0, 96)
      glow.addColorStop(0, '#ffd890')
      glow.addColorStop(1, '#ffb45a')
      g.fillStyle = glow
      g.fillRect(42, 30, 44, 64)
    } else {
      // Kat silmesi (ince yatay bant)
      g.fillStyle = '#e8e2d6'
      g.fillRect(0, 120, size, 8)
      // Panjurlar
      g.fillStyle = '#5f7a5a'
      g.fillRect(26, 28, 14, 68)
      g.fillRect(88, 28, 14, 68)
      // Çerçeve ve cam
      g.fillStyle = '#f7f4ee'
      g.fillRect(38, 26, 52, 72)
      const glass = g.createLinearGradient(0, 30, 0, 94)
      glass.addColorStop(0, '#556a82')
      glass.addColorStop(1, '#2c3644')
      g.fillStyle = glass
      g.fillRect(42, 30, 44, 64)
      g.fillStyle = '#f7f4ee'
      g.fillRect(62, 30, 4, 64) // dikey kayıt
      g.fillRect(42, 54, 44, 4) // yatay kayıt
      g.fillStyle = '#cfc8ba'
      g.fillRect(34, 98, 60, 6) // denizlik
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }
  return { map: make(false), lit: make(true) }
}

// Beşik çatı: z boyunca mahya; taban y=0, mahya y=1, x ve z ±0,5
function gableGeometry() {
  const p = [
    // Eğimli yüzler
    [-0.5, 0, -0.5], [0, 1, -0.5], [0, 1, 0.5], [-0.5, 0, -0.5], [0, 1, 0.5], [-0.5, 0, 0.5],
    [0.5, 0, -0.5], [0.5, 0, 0.5], [0, 1, 0.5], [0.5, 0, -0.5], [0, 1, 0.5], [0, 1, -0.5],
    // Alınlıklar
    [-0.5, 0, 0.5], [0, 1, 0.5], [0.5, 0, 0.5],
    [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, -0.5],
  ].flat()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.computeVertexNormals()
  return g
}

function useInstances(ref, list, build) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    list.forEach((item, i) => {
      build(item, m)
      mesh.setMatrixAt(i, m)
      if (item.color) mesh.setColorAt(i, item.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [ref, list, build])
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

function Buildings() {
  const walls = useRef()
  const gables = useRef()
  const parapets = useRef()
  const tanks = useRef()
  const slabs = useRef()
  const rails = useRef()
  const awnings = useRef()

  const material = useMemo(() => {
    const { map, lit } = facadeTextures()
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: lit, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.85 })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aRepeat;\nattribute float aSeed;\nvarying float vSeed;\nvarying vec2 vCell;')
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv *= aRepeat;
            vCell = vMapUv;
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv *= aRepeat;
          #endif
          vSeed = aSeed;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSeed;\nvarying vec2 vCell;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            // Zemin katı: taş kaide tonu; zemine yakın hafif gölgelenme
            float ground = 1.0 - step(1.0, vCell.y);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.74, 0.7), ground);
            diffuseColor.rgb *= mix(0.78, 1.0, smoothstep(0.0, 1.2, vCell.y));
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            // Katlarda pencerelerin yaklaşık üçte biri yanar; zemin kattaki dükkânlar hep yanar
            float on = step(0.66, fract(sin(dot(floor(vCell) + vSeed, vec2(12.9898, 78.233))) * 43758.5453));
            on = max(on, 1.0 - step(1.0, vCell.y));
            totalEmissiveRadiance *= on;
          }`,
        )
    }
    m.customProgramCacheKey = () => 'asia-facade-v2'
    return m
  }, [])

  // Yerleşim: zemine oturt, kat sayısı ve kat yüksekliği, çatı tipi
  const placed = useMemo(
    () =>
      ASIA_BUILDINGS.map((b, i) => {
        const base = Math.min(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => heightAt(b.x + (sx * b.w) / 2, b.z + (sz * b.d) / 2)))) - 0.8
        const top = heightAt(b.x, b.z) + b.h
        const floors = Math.max(2, Math.round((top - base) / FLOOR))
        return { ...b, i, base, top, floors, floorH: (top - base) / floors, gable: i % 5 < 3 }
      }),
    [],
  )

  // Ayrıntı listeleri (balkon, tente, çatı)
  const parts = useMemo(() => {
    const gable = []
    const flat = []
    const slab = []
    const awning = []
    for (const b of placed) {
      if (b.gable) gable.push(b)
      else flat.push(b)
      for (const side of [-1, 1]) {
        // Zemin kat tentesi (doğu ve batı cephesi)
        awning.push({ x: b.x + side * (b.w / 2 + 0.55), y: b.base + b.floorH * 0.95, z: b.z, side, len: b.d * 0.7, color: AWNINGS[(b.i + (side > 0 ? 2 : 0)) % AWNINGS.length] })
        // Balkonlar: her iki binadan birinde, 1. kattan itibaren
        if (b.i % 2 === 0) for (let f = 1; f < b.floors; f++) slab.push({ x: b.x + side * (b.w / 2 + 0.45), y: b.base + f * b.floorH, z: b.z, side, len: b.d * 0.55 })
      }
    }
    return { gable, flat, slab, awning }
  }, [placed])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const repeat = new Float32Array(placed.length * 2)
    const seeds = new Float32Array(placed.length)
    placed.forEach((b, i) => {
      m.makeScale(b.w, b.top - b.base, b.d).setPosition(b.x, b.base, b.z)
      walls.current.setMatrixAt(i, m)
      walls.current.setColorAt(i, TINTS[b.tint % TINTS.length])
      repeat[i * 2] = Math.max(1, Math.round(Math.max(b.w, b.d) / FLOOR))
      repeat[i * 2 + 1] = b.floors
      seeds[i] = i * 7.31
    })
    walls.current.geometry.setAttribute('aRepeat', new THREE.InstancedBufferAttribute(repeat, 2))
    walls.current.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    walls.current.instanceMatrix.needsUpdate = true
    walls.current.instanceColor.needsUpdate = true
    walls.current.computeBoundingSphere()
  }, [placed])

  const boxUp = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const gableGeo = useMemo(() => gableGeometry(), [])
  // Duvarların kendi kopyası: ek öznitelikler (pencere tekrarı) yalnızca duvarlara eklenir; sabit kalmalı
  const wallGeo = useMemo(() => boxUp.clone(), [boxUp])

  useInstances(gables, parts.gable, (b, m) => m.makeScale(b.w + 0.7, Math.min(2.6, b.w * 0.38), b.d + 0.7).setPosition(b.x, b.top, b.z))
  useInstances(parapets, parts.flat, (b, m) => m.makeScale(b.w + 0.25, 0.7, b.d + 0.25).setPosition(b.x, b.top - 0.1, b.z))
  useInstances(tanks, parts.flat, (b, m) => m.makeScale(1.3, 1.1, 1.3).setPosition(b.x + b.w * 0.2, b.top + 0.6, b.z - b.d * 0.2))
  useInstances(slabs, parts.slab, (s, m) => m.makeScale(0.9, 0.12, s.len).setPosition(s.x, s.y, s.z))
  useInstances(rails, parts.slab, (s, m) => m.makeScale(0.06, 0.85, s.len).setPosition(s.x + s.side * 0.42, s.y + 0.48, s.z))
  useInstances(awnings, parts.awning, (a, m) => {
    _e.set(0, 0, a.side * -0.38)
    _q.setFromEuler(_e)
    m.compose(_p.set(a.x, a.y, a.z), _q, _s.set(1.2, 0.08, a.len))
  })

  useFrame(() => {
    material.emissiveIntensity = world.night * 1.4
  })

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {placed.map((b) => (
          <CuboidCollider key={b.i} args={[b.w / 2, (b.top - b.base) / 2, b.d / 2]} position={[b.x, (b.base + b.top) / 2, b.z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={walls} args={[wallGeo, material, placed.length]} castShadow receiveShadow />
      <instancedMesh ref={gables} args={[gableGeo, undefined, parts.gable.length]} castShadow>
        <meshStandardMaterial color="#b4553a" roughness={0.75} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={parapets} args={[boxUp, undefined, parts.flat.length]} castShadow>
        <meshStandardMaterial color="#e9e4da" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={tanks} args={[box, undefined, parts.flat.length]} castShadow>
        <meshStandardMaterial color="#7d8691" roughness={0.6} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={slabs} args={[box, undefined, parts.slab.length]} castShadow>
        <meshStandardMaterial color="#e6e1d6" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={rails} args={[box, undefined, parts.slab.length]}>
        <meshStandardMaterial color="#3a3f48" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={awnings} args={[box, undefined, parts.awning.length]} castShadow>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </>
  )
}

// Sokak lambaları: sokaklar boyunca 16 m arayla, sırayla iki yanda
function StreetLamps() {
  const posts = useRef()
  const bulbs = useRef()
  const lamps = useMemo(() => {
    const list = []
    ASIA_STREETS.forEach(([[ax, az], [bx, bz]], si) => {
      const len = Math.hypot(bx - ax, bz - az)
      const nx = -(bz - az) / len
      const nz = (bx - ax) / len
      for (let d = 8, k = si; d < len - 4; d += 16, k++) {
        const side = k % 2 ? 1 : -1
        const x = ax + ((bx - ax) * d) / len + nx * 4.3 * side
        const z = az + ((bz - az) * d) / len + nz * 4.3 * side
        list.push({ x, z, y: heightAt(x, z) })
      }
    })
    return list
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffcf86', emissiveIntensity: 0 }), [])
  const postGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6).translate(0, 2.1, 0), [])
  useInstances(posts, lamps, (l, m) => m.makeTranslation(l.x, l.y, l.z))
  useInstances(bulbs, lamps, (l, m) => m.makeTranslation(l.x, l.y + 4.3, l.z))
  useFrame(() => {
    material.emissiveIntensity = 0.1 + world.night * 5
  })
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {lamps.map((l, i) => (
          <CylinderCollider key={i} args={[2.1, 0.12]} position={[l.x, l.y + 2.1, l.z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={posts} args={[postGeo, undefined, lamps.length]} castShadow>
        <meshStandardMaterial color="#3a3f48" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, material, lamps.length]}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </instancedMesh>
      {lamps
        .filter((_, i) => i % 3 === 0)
        .map((l, i) => (
          <Halo key={i} position={[l.x, l.y + 4.3, l.z]} scale={2.6} />
        ))}
    </>
  )
}

// Meydanda dilek çeşmesi (göbek kavşağın ortası): taş havuz, iki kat çanak, fışkıran su
function Fountain() {
  const { x, z, island } = ROUNDABOUTS.asia
  const y = heightAt(x, z)
  const spray = useRef()
  const drops = useMemo(() => {
    const count = 160
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    // Sabit sözde rastgele (her çizimde aynı)
    const rnd = (n) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1
    const seeds = Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2 * 7, phase: rnd(i + 1), r: 0.6 + rnd(i + 101) * 0.9 }))
    return { g, seeds }
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pos = drops.g.attributes.position
    drops.seeds.forEach((d, i) => {
      // Tepedeki çanaktan dışarı doğru parabolik yay
      const k = (t * 0.9 + d.phase) % 1
      const rr = 0.3 + d.r * k * 1.8
      pos.setXYZ(i, Math.cos(d.a) * rr, 2.9 + k * 1.4 - k * k * 3.4, Math.sin(d.a) * rr)
    })
    pos.needsUpdate = true
    if (spray.current) spray.current.material.opacity = 0.75
  })
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, island]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* Kavşak asfaltı (çeşmenin çevresinde dönen şerit) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[island + 1.2, ROUNDABOUTS.asia.lane + 2.4, 64]} />
        <meshStandardMaterial color="#4a4f5c" roughness={0.92} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <StaticMerge>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[island, island + 0.2, 0.6, 32]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.6, 2.2, 16]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.6, 0]} castShadow>
          <cylinderGeometry args={[1.8, 1.2, 0.35, 24]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.75, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.6, 0.3, 20]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.85} />
        </mesh>
      </StaticMerge>
      {/* Havuz suyu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.58, 0]}>
        <circleGeometry args={[island - 0.35, 40]} />
        <meshStandardMaterial color="#3f9bbd" roughness={0.1} metalness={0.2} emissive="#123a52" emissiveIntensity={0.4} />
      </mesh>
      <points ref={spray} geometry={drops.g} frustumCulled={false}>
        <pointsMaterial color="#cfeeff" size={0.16} transparent opacity={0.75} depthWrite={false} />
      </points>
      <Halo position={[0, 2.2, 0]} scale={5} color="#9fd8ff" dayOpacity={0} />
    </group>
  )
}

// Avrupa yakasındaki göbek kavşak: çimenli ada, çiçek saksıları ve bayrak
function EuropeRoundabout() {
  const { x, z, island, lane } = ROUNDABOUTS.europe
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.4, island]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
        <ringGeometry args={[island, lane + 2.6, 56]} />
        <meshStandardMaterial color="#4a4f5c" roughness={0.92} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <StaticMerge>
        <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[island, island, 0.4, 40]} />
          <meshStandardMaterial color="#e9e4da" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[island - 0.3, 40]} />
          <meshStandardMaterial color="#5f8f45" roughness={0.95} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * (island - 0.9), 0.65, Math.sin(a) * (island - 0.9)]} castShadow>
              <sphereGeometry args={[0.38, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#e8335d' : '#f2c230'} roughness={0.8} />
            </mesh>
          )
        })}
      </StaticMerge>
      <group position={[0, 0.4, 0]} scale={1.8}>
        <Flag position={[0, 0.3, 0]} />
      </group>
    </group>
  )
}

// Sahildeki çay bahçesi: büfe, şemsiyeli masalar
function TeaGarden() {
  const { x, z } = TEA_GARDEN
  const y = heightAt(x, z)
  const tables = [
    [-2.5, -4],
    [-2.5, 0],
    [-2.5, 4],
    [1, -2],
    [1, 2],
  ]
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.4, 1.3, 2]} position={[-5.4, 1.3, 0]} />
        {tables.map(([tx, tz]) => (
          <CylinderCollider key={`${tx}${tz}`} args={[0.4, 0.5]} position={[tx, 0.4, tz]} />
        ))}
      </RigidBody>
      <StaticMerge>
        {/* Büfe */}
        <mesh position={[-5.4, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 2.4, 4]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
        </mesh>
        <mesh position={[-5.4, 2.55, 0]} castShadow>
          <boxGeometry args={[3.3, 0.3, 4.5]} />
          <meshStandardMaterial color="#c8302c" roughness={0.7} />
        </mesh>
        <mesh position={[-3.98, 1.35, 0]}>
          <boxGeometry args={[0.05, 1, 2.6]} />
          <meshStandardMaterial color="#2c3644" roughness={0.2} metalness={0.3} />
        </mesh>
        {tables.map(([tx, tz], i) => (
          <group key={i} position={[tx, 0, tz]}>
            <mesh position={[0, 0.72, 0]} castShadow>
              <cylinderGeometry args={[0.55, 0.55, 0.06, 18]} />
              <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.36, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.72, 6]} />
              <meshStandardMaterial color="#3a3f48" metalness={0.5} roughness={0.5} />
            </mesh>
            {[0, 1, 2].map((c) => {
              const a = (c / 3) * Math.PI * 2 + i
              return (
                <mesh key={c} position={[Math.cos(a) * 0.95, 0.24, Math.sin(a) * 0.95]} castShadow>
                  <boxGeometry args={[0.42, 0.48, 0.42]} />
                  <meshStandardMaterial color={c % 2 ? '#8a5a3b' : '#a86a42'} roughness={0.8} />
                </mesh>
              )
            })}
            {/* Şemsiye */}
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
              <meshStandardMaterial color="#d9d9d9" roughness={0.5} />
            </mesh>
            <mesh position={[0, 2.15, 0]} castShadow>
              <coneGeometry args={[1.3, 0.55, 10, 1, true]} />
              <meshStandardMaterial color={i % 2 ? '#c8302c' : '#f4f1ea'} roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </StaticMerge>
      {[1, -1].map((side) => (
        <Text key={side} font={fontBlack} fontSize={0.55} color="#ffffff" position={[-5.4, 2.55, side * 2.27]} rotation={[0, side > 0 ? 0 : Math.PI, 0]} anchorX="center" anchorY="middle">
          ÇAY
        </Text>
      ))}
      <Text font={fontBlack} fontSize={0.55} color="#ffffff" position={[-3.73, 2.55, 0]} rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        ÇAY BAHÇESİ
      </Text>
    </group>
  )
}

// Tepedeki cami: kare gövde, ana kubbe, yarım kubbeler, iki ince minare
function Mosque() {
  const { x, z } = ASIA_MOSQUE
  const y = heightAt(x, z) - 0.5
  const stone = '#e8e2d4'
  const lead = '#7d8a96'
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[8, 6, 8]} position={[0, 6, 0]} />
        {[-1, 1].map((s) => (
          <CylinderCollider key={s} args={[14, 0.9]} position={[s * 11, 14, -11 * s]} />
        ))}
      </RigidBody>
      <StaticMerge>
        <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 9, 16]} />
          <meshStandardMaterial color={stone} roughness={0.85} />
        </mesh>
        <mesh position={[0, 9.6, 0]} castShadow>
          <cylinderGeometry args={[6.4, 7, 1.2, 24]} />
          <meshStandardMaterial color={stone} roughness={0.85} />
        </mesh>
        <mesh position={[0, 10.2, 0]} castShadow>
          <sphereGeometry args={[6.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={lead} roughness={0.5} metalness={0.3} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2
          return (
            <mesh key={i} position={[Math.cos(a) * 7.6, 9, Math.sin(a) * 7.6]} castShadow>
              <sphereGeometry args={[3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={lead} roughness={0.5} metalness={0.3} />
            </mesh>
          )
        })}
        <mesh position={[0, 16.9, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 1.4, 6]} />
          <meshStandardMaterial color="#d6a53a" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 11, 0, -11 * s]}>
            <mesh position={[0, 12, 0]} castShadow>
              <cylinderGeometry args={[0.75, 0.9, 24, 12]} />
              <meshStandardMaterial color={stone} roughness={0.85} />
            </mesh>
            {[15, 21].map((h) => (
              <mesh key={h} position={[0, h, 0]} castShadow>
                <cylinderGeometry args={[1.15, 1.15, 0.5, 12]} />
                <meshStandardMaterial color={stone} roughness={0.85} />
              </mesh>
            ))}
            <mesh position={[0, 26.3, 0]} castShadow>
              <coneGeometry args={[0.9, 4.6, 12]} />
              <meshStandardMaterial color={lead} roughness={0.5} metalness={0.3} />
            </mesh>
          </group>
        ))}
      </StaticMerge>
    </group>
  )
}

export default function AsiaShore() {
  return (
    <>
      <Buildings />
      <StreetLamps />
      <Fountain />
      <TeaGarden />
      <EuropeRoundabout />
      <Mosque />
    </>
  )
}
