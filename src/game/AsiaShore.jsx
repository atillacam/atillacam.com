import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { ASIA_BUILDINGS, ASIA_MOSQUE, ASIA_STREETS, MOSQUE_YARD, DONDURMA, ROUNDABOUTS, TEA_GARDEN, TRAM_LINE } from './layout.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { playHonk } from '../audio.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { fontBlack } from './fonts.js'
import { Flag } from './Istanbul.jsx'
import StaticMerge from './StaticMerge.jsx'
import Halo from './Halo.jsx'
import { FerrisWheel } from './Lunapark.jsx'

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
const _up = new THREE.Vector3(0, 1, 0)

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
        return { ...b, i, base, top, floors, floorH: (top - base) / floors, gable: b.floors <= 3 || i % 3 === 1 }
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
      // Sokağa bakan cephe: zemin katta dükkân tentesi, katlarda balkon sırası
      const side = b.face
      awning.push({ x: b.x + side * (b.w / 2 + 0.55), y: b.base + b.floorH * 0.95, z: b.z, side, len: b.d * 0.75, color: AWNINGS[b.i % AWNINGS.length] })
      if (b.floors >= 4 || b.i % 2 === 0) for (let f = 1; f < b.floors; f++) slab.push({ x: b.x + side * (b.w / 2 + 0.45), y: b.base + f * b.floorH, z: b.z, side, len: b.d * 0.6 })
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
// Cami avlusu: taş döşeme, sokaklara açılan kapılı alçak duvar, şadırvan ve servi ağaçları
const YARD_GATE = 8 // batı (sahil yolu) ve doğu (cadde) kapılarının genişliği
function MosqueYard() {
  const { x, z, w, d } = MOSQUE_YARD
  const y = heightAt(x, z)
  // Duvar parçaları: [merkez x, merkez z, uzunluk x, uzunluk z] (avlu merkezine göre)
  const walls = useMemo(() => {
    const t = 0.45
    const side = (d - YARD_GATE) / 2
    return [
      [0, -d / 2, w, t],
      [0, d / 2, w, t],
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [(sx * w) / 2, sz * (YARD_GATE / 2 + side / 2), t, side])),
    ]
  }, [w, d])
  const cypress = [
    [-w / 2 + 2.2, -d / 2 + 2.2],
    [w / 2 - 2.2, d / 2 - 2.2],
    [-w / 2 + 2.2, d / 2 - 2.2],
    [w / 2 - 2.2, -d / 2 + 2.2],
  ]
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        {walls.map(([wx, wz, lx, lz], i) => (
          <CuboidCollider key={i} args={[lx / 2, 0.35, lz / 2]} position={[wx, 0.35, wz]} />
        ))}
        <CylinderCollider args={[0.7, 1.9]} position={[0, 0.7, 12.5]} />
        {cypress.map(([cx, cz]) => (
          <CylinderCollider key={cx + ',' + cz} args={[2, 0.35]} position={[cx, 2, cz]} />
        ))}
      </RigidBody>
      <StaticMerge>
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[w, 0.08, d]} />
          <meshStandardMaterial color="#d9d2c3" roughness={0.95} />
        </mesh>
        {/* Döşeme çizgileri: kapıdan kapıya uzanan koyu taş yol */}
        <mesh position={[0, 0.09, 0]} receiveShadow>
          <boxGeometry args={[w, 0.02, 3.2]} />
          <meshStandardMaterial color="#b9ae99" roughness={0.95} />
        </mesh>
        {walls.map(([wx, wz, lx, lz], i) => (
          <mesh key={i} position={[wx, 0.35, wz]} castShadow receiveShadow>
            <boxGeometry args={[lx, 0.7, lz]} />
            <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
          </mesh>
        ))}
        {/* Kapı direkleri */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={sx + ',' + sz} position={[(sx * w) / 2, 0.8, (sz * YARD_GATE) / 2]} castShadow>
              <boxGeometry args={[0.8, 1.6, 0.8]} />
              <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
            </mesh>
          )),
        )}
        {/* Şadırvan: sekizgen havuz, ince sütunlar, kurşun kubbe */}
        <group position={[0, 0, 12.5]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.9, 2, 0.7, 8]} />
            <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[1.6, 1.6, 0.04, 8]} />
            <meshStandardMaterial color="#5fa8c9" roughness={0.15} metalness={0.2} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8
            return (
              <mesh key={i} position={[Math.cos(a) * 1.75, 1.75, Math.sin(a) * 1.75]} castShadow>
                <cylinderGeometry args={[0.09, 0.09, 2.1, 6]} />
                <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
              </mesh>
            )
          })}
          <mesh position={[0, 2.85, 0]} castShadow>
            <cylinderGeometry args={[2.2, 2.2, 0.2, 8]} />
            <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.95, 0]} castShadow>
            <sphereGeometry args={[1.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#7d8a96" roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
        {/* Servi ağaçları */}
        {cypress.map(([cx, cz]) => (
          <group key={cx + ',' + cz} position={[cx, 0, cz]}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 1.2, 6]} />
              <meshStandardMaterial color="#5b4636" roughness={0.9} />
            </mesh>
            <mesh position={[0, 4.6, 0]} castShadow>
              <coneGeometry args={[1.05, 7.6, 10]} />
              <meshStandardMaterial color="#2f5a3a" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </StaticMerge>
    </group>
  )
}

// Cami: klasik Osmanlı planı. Kare harim, sekizgen kasnak üstünde ana kubbe, dört yanda yarım kubbe,
// köşelerde ağırlık kuleleri, önde (güneyde, şadırvana bakan) beş kubbeli son cemaat revakı ve iki şerefeli
// iki minare. Kemerli pencereler gece içeriden yanar. Avlu MosqueYard'da.
const MOSQUE = { size: 16, wall: 8, z: -6 } // z: avlu merkezine göre harimin merkezi (arkaya yaslı)
const STONE = '#ece6d8'
const LEAD = '#7f8c99'
const GOLD = '#d6a53a'

// Kemerli pencere: dikdörtgen + yarım daire (x-y düzleminde, +z'ye bakar)
function archGeometry(w, h) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h - w / 2)
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false)
  s.lineTo(-w / 2, 0)
  return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 8 })
}

function Mosque() {
  const { x, z } = ASIA_MOSQUE
  const y = heightAt(x, z)
  const half = MOSQUE.size / 2
  const windows = useRef()
  const windowGeo = useMemo(() => archGeometry(1, 2), [])
  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3442', emissive: '#ffcf86', emissiveIntensity: 0, roughness: 0.4 }), [])

  // Pencereler: harimin dört yüzünde iki sıra, kasnakta bir halka
  const panes = useMemo(() => {
    const list = []
    for (let f = 0; f < 4; f++) {
      const yaw = (f * Math.PI) / 2
      const nx = Math.sin(yaw)
      const nz = Math.cos(yaw)
      for (const row of [1.4, 4.6]) {
        for (let i = -2; i <= 2; i++) {
          if (f === 0 && row < 2 && i === 0) continue // giriş kapısı
          const t = i * 2.8
          list.push({ x: nx * (half + 0.01) + nz * t, y: row, z: nz * (half + 0.01) - nx * t, yaw, s: row < 2 ? 1 : 0.85 })
        }
      }
    }
    for (let i = 0; i < 16; i++) {
      const yaw = (i / 16) * Math.PI * 2
      list.push({ x: Math.sin(yaw) * 5.62, y: MOSQUE.wall + 0.85, z: Math.cos(yaw) * 5.62, yaw, s: 0.45 })
    }
    return list
  }, [half])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    panes.forEach((p, i) => {
      q.setFromAxisAngle(_up, p.yaw)
      windows.current.setMatrixAt(i, m.compose(_p.set(p.x, p.y, p.z), q, _s.set(p.s, p.s, 1)))
    })
    windows.current.instanceMatrix.needsUpdate = true
    windows.current.computeBoundingSphere()
  }, [panes])
  useFrame(() => {
    windowMat.emissiveIntensity = world.night * 2.2
  })

  const minarets = [-1, 1].map((s) => [s * (half + 1.6), half - 1])
  const turrets = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (half - 0.9), sz * (half - 0.9)]))
  const semis = [0, 1, 2, 3].map((f) => (f * Math.PI) / 2)
  const porch = { z: half + 2.3, depth: 4.6, h: 4.2 }

  return (
    <group position={[x, y, z + MOSQUE.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half, MOSQUE.wall / 2 + 2, half]} position={[0, MOSQUE.wall / 2 + 2, 0]} />
        <CuboidCollider args={[half, porch.h / 2, porch.depth / 2]} position={[0, porch.h / 2, porch.z]} />
        {minarets.map(([mx, mz]) => (
          <CylinderCollider key={mx} args={[13, 1.1]} position={[mx, 13, mz]} />
        ))}
      </RigidBody>
      <StaticMerge>
        {/* Kaide ve harim */}
        <mesh position={[0, 0.25, 1.5]} receiveShadow>
          <boxGeometry args={[MOSQUE.size + 1.2, 0.5, MOSQUE.size + porch.depth + 2]} />
          <meshStandardMaterial color="#d8d0bf" roughness={0.9} />
        </mesh>
        <mesh position={[0, MOSQUE.wall / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[MOSQUE.size, MOSQUE.wall, MOSQUE.size]} />
          <meshStandardMaterial color={STONE} roughness={0.85} />
        </mesh>
        {/* Saçak ve kat silmesi */}
        {[3.2, MOSQUE.wall].map((h) => (
          <mesh key={h} position={[0, h, 0]} castShadow>
            <boxGeometry args={[MOSQUE.size + 0.5, 0.3, MOSQUE.size + 0.5]} />
            <meshStandardMaterial color="#d9d0bd" roughness={0.85} />
          </mesh>
        ))}
        {/* Giriş kapısı: derin kemerli niş */}
        <mesh position={[0, 1.6, half + 0.02]}>
          <boxGeometry args={[2.2, 3.2, 0.1]} />
          <meshStandardMaterial color="#5b3b26" roughness={0.7} />
        </mesh>
        {/* Sekizgen kasnak, ana kubbe, kubbe kasnağı silmesi */}
        <mesh position={[0, MOSQUE.wall + 0.9, 0]} castShadow>
          <cylinderGeometry args={[5.6, 5.9, 1.8, 16]} />
          <meshStandardMaterial color={STONE} roughness={0.85} />
        </mesh>
        <mesh position={[0, MOSQUE.wall + 1.8, 0]} castShadow>
          <sphereGeometry args={[5.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={LEAD} roughness={0.45} metalness={0.35} />
        </mesh>
        {/* Yarım kubbeler: kasnağa yaslanır */}
        {semis.map((a) => (
          <mesh key={a} position={[Math.sin(a) * 4.2, MOSQUE.wall + 0.2, Math.cos(a) * 4.2]} rotation={[0, a, 0]} castShadow>
            <sphereGeometry args={[3, 20, 10, 0, Math.PI, 0, Math.PI / 2]} />
            <meshStandardMaterial color={LEAD} roughness={0.45} metalness={0.35} />
          </mesh>
        ))}
        {/* Köşe ağırlık kuleleri */}
        {turrets.map(([tx, tz]) => (
          <group key={tx + ',' + tz} position={[tx, MOSQUE.wall, tz]}>
            <mesh position={[0, 1, 0]} castShadow>
              <cylinderGeometry args={[0.75, 0.85, 2, 8]} />
              <meshStandardMaterial color={STONE} roughness={0.85} />
            </mesh>
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={LEAD} roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[0, 3.05, 0]}>
              <coneGeometry args={[0.12, 0.6, 6]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {/* Ana kubbe alemi */}
        <mesh position={[0, MOSQUE.wall + 7.6, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.2, 6]} />
          <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, MOSQUE.wall + 8.1, 0]}>
          <sphereGeometry args={[0.28, 12, 8]} />
          <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, MOSQUE.wall + 8.75, 0]}>
          <torusGeometry args={[0.32, 0.07, 6, 16, Math.PI * 1.4]} />
          <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Son cemaat revakı: sütunlar, kemer kirişi, düz dam, beş küçük kubbe */}
        {[-7.4, -4.44, -1.48, 1.48, 4.44, 7.4].map((cx) => (
          <mesh key={cx} position={[cx, porch.h / 2, porch.z + porch.depth / 2 - 0.4]} castShadow>
            <cylinderGeometry args={[0.26, 0.3, porch.h, 10]} />
            <meshStandardMaterial color="#f6f2ea" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, porch.h + 0.25, porch.z]} castShadow>
          <boxGeometry args={[MOSQUE.size, 0.5, porch.depth]} />
          <meshStandardMaterial color={STONE} roughness={0.85} />
        </mesh>
        {[-6, -3, 0, 3, 6].map((cx) => (
          <mesh key={cx} position={[cx, porch.h + 0.5, porch.z]} castShadow>
            <sphereGeometry args={[1.35, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={LEAD} roughness={0.45} metalness={0.35} />
          </mesh>
        ))}
        {/* Minareler: kare kaide, ince gövde, iki şerefe, kurşun külah, alem */}
        {minarets.map(([mx, mz]) => (
          <group key={mx} position={[mx, 0, mz]}>
            <mesh position={[0, 2, 0]} castShadow>
              <boxGeometry args={[2.2, 4, 2.2]} />
              <meshStandardMaterial color={STONE} roughness={0.85} />
            </mesh>
            <mesh position={[0, 4.4, 0]} castShadow>
              <cylinderGeometry args={[0.9, 1.25, 0.8, 12]} />
              <meshStandardMaterial color={STONE} roughness={0.85} />
            </mesh>
            <mesh position={[0, 13.6, 0]} castShadow>
              <cylinderGeometry args={[0.72, 0.85, 17.6, 16]} />
              <meshStandardMaterial color={STONE} roughness={0.85} />
            </mesh>
            {[14.5, 20.2].map((h) => (
              <group key={h} position={[0, h, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[1.3, 0.8, 0.6, 16]} />
                  <meshStandardMaterial color={STONE} roughness={0.85} />
                </mesh>
                <mesh position={[0, 0.65, 0]}>
                  <torusGeometry args={[1.25, 0.05, 4, 24]} />
                  <meshStandardMaterial color="#d9d0bd" roughness={0.8} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 22.6, 0]} castShadow>
              <cylinderGeometry args={[0.62, 0.62, 1.6, 16]} />
              <meshStandardMaterial color={STONE} roughness={0.85} />
            </mesh>
            <mesh position={[0, 25.6, 0]} castShadow>
              <coneGeometry args={[0.75, 4.4, 16]} />
              <meshStandardMaterial color={LEAD} roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[0, 28.2, 0]}>
              <sphereGeometry args={[0.18, 10, 6]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </StaticMerge>
      <instancedMesh ref={windows} args={[windowGeo, windowMat, panes.length]} />
      {/* Gece: şerefeler ve giriş ışıkları */}
      {minarets.flatMap(([mx, mz]) => [14.5, 20.2].map((h) => <Halo key={mx + ':' + h} position={[mx, h + 0.4, mz]} scale={3.2} />))}
      <Halo position={[0, 3.6, half + 1]} scale={4} />
    </group>
  )
}

// Maraş dondurmacısı: çizgili tenteli araba, üstünde dev külah
function DondurmaCart() {
  const { x, z } = DONDURMA
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1, 0.9, 0.6]} position={[0, 0.9, 0]} />
      </RigidBody>
      <StaticMerge>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.9, 0.9, 1.1]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.6, 0.56]}>
          <boxGeometry args={[1.9, 0.18, 0.02]} />
          <meshStandardMaterial color="#c8302c" roughness={0.7} />
        </mesh>
        {[-0.7, 0.7].map((wx) => (
          <mesh key={wx} position={[wx, 0.28, 0.58]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.08, 14]} />
            <meshStandardMaterial color="#2a2c31" roughness={0.8} />
          </mesh>
        ))}
        {/* Tente direkleri ve çizgili tente */}
        {[-0.85, 0.85].map((px) => (
          <mesh key={px} position={[px, 1.75, -0.4]}>
            <cylinderGeometry args={[0.03, 0.03, 1.8, 6]} />
            <meshStandardMaterial color="#d9d9d9" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={'s' + i} position={[-0.8 + i * 0.4, 2.62, 0]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.4, 0.06, 1.5]} />
            <meshStandardMaterial color={i % 2 ? '#f4f1ea' : '#c8302c'} roughness={0.8} />
          </mesh>
        ))}
        {/* Dev külah tabela */}
        <mesh position={[0.65, 3.1, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.32, 0.9, 12]} />
          <meshStandardMaterial color="#d9a35b" roughness={0.8} />
        </mesh>
        <mesh position={[0.65, 3.62, 0]} castShadow>
          <sphereGeometry args={[0.36, 14, 10]} />
          <meshStandardMaterial color="#fff4e0" roughness={0.6} />
        </mesh>
        <mesh position={[0.65, 3.98, 0]} castShadow>
          <sphereGeometry args={[0.26, 14, 10]} />
          <meshStandardMaterial color="#e8a0b4" roughness={0.6} />
        </mesh>
      </StaticMerge>
      <Text font={fontBlack} fontSize={0.26} color="#c8302c" position={[0, 0.98, 0.56]} anchorX="center" anchorY="middle">
        MARAŞ DONDURMASI
      </Text>
    </group>
  )
}

// Nostaljik tramvay: sahil yolunda iki uç arasında gider gelir, uçlarda bekler; önüne çıkılırsa zil çalıp durur
const TRAM_SPEED = 6
const TRAM_DWELL = 5
function Tram() {
  const body = useRef()
  const state = useRef({ z: TRAM_LINE.from, dir: 1, speed: 0, wait: 2, bellAt: 0 })
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const s = state.current
    const dt = THREE.MathUtils.clamp(delta, 0, 0.05) // negatif süre (zaman geri akarsa) hızları bozmasın
    if (s.wait > 0) {
      s.wait -= dt
      s.speed = 0
    } else {
      // Önde oyuncu varsa yavaşla ve zil çal
      const p = vehicleState.position
      const along = (p.z - s.z) * s.dir
      let target = TRAM_SPEED
      if (along > 0 && along < 14 && Math.abs(p.x - TRAM_LINE.x) < 3) {
        target = Math.max(0, (along - 7) * 1.2)
        const now = performance.now()
        const { muted, started } = useStore.getState()
        if (now - s.bellAt > 4000 && !muted && started) {
          s.bellAt = now
          playHonk('horn-tram')
        }
      }
      // Durağa yaklaşınca yavaşla
      const end = s.dir > 0 ? TRAM_LINE.to : TRAM_LINE.from
      target = Math.min(target, Math.max(1.2, Math.abs(end - s.z) * 0.8))
      s.speed += THREE.MathUtils.clamp(target - s.speed, -6 * dt, 2 * dt)
      s.z += s.dir * s.speed * dt
      if ((s.dir > 0 && s.z >= TRAM_LINE.to) || (s.dir < 0 && s.z <= TRAM_LINE.from)) {
        s.z = s.dir > 0 ? TRAM_LINE.to : TRAM_LINE.from
        s.dir *= -1
        s.wait = TRAM_DWELL
      }
    }
    q.setFromAxisAngle(_up, 0)
    rb.setNextKinematicTranslation({ x: TRAM_LINE.x, y: heightAt(TRAM_LINE.x, s.z), z: s.z })
    rb.setNextKinematicRotation(q)
  })
  return (
    <RigidBody ref={body} name="npc" type="kinematicPosition" colliders={false} position={[TRAM_LINE.x, 0, TRAM_LINE.from]}>
      <CuboidCollider args={[1.25, 1.5, 4.6]} position={[0, 1.6, 0]} />
      <StaticMerge>
        {/* Kırmızı alt gövde, krem üst gövde, pencere şeridi, çatı */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[2.4, 1.1, 9]} />
          <meshStandardMaterial color="#b8282b" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow>
          <boxGeometry args={[2.4, 1.2, 9]} />
          <meshStandardMaterial color="#f1e6cc" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <boxGeometry args={[2.42, 0.7, 8.4]} />
          <meshStandardMaterial color="#2c3644" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0, 2.72, 0]} castShadow>
          <boxGeometry args={[2.2, 0.24, 8.6]} />
          <meshStandardMaterial color="#b8282b" roughness={0.6} />
        </mesh>
        {/* Pantograf */}
        <mesh position={[0, 3.25, 0]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 1.4]} />
          <meshStandardMaterial color="#2a2c31" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, 0.28, side * 3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 2.2, 12]} />
            <meshStandardMaterial color="#2a2c31" roughness={0.6} />
          </mesh>
        ))}
      </StaticMerge>
    </RigidBody>
  )
}

// Tramvay rayları: hat boyunca iki ince ray
function TramTracks() {
  const length = TRAM_LINE.to - TRAM_LINE.from + 8
  const z = (TRAM_LINE.from + TRAM_LINE.to) / 2
  return (
    <StaticMerge>
      {[-0.72, 0.72].map((dx) => (
        <mesh key={dx} position={[TRAM_LINE.x + dx, heightAt(TRAM_LINE.x, z) + 0.07, z]}>
          <boxGeometry args={[0.1, 0.05, length]} />
          <meshStandardMaterial color="#8d939c" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </StaticMerge>
  )
}

export default function AsiaShore() {
  return (
    <>
      <Buildings />
      <StreetLamps />
      <Fountain />
      <TeaGarden />
      <DondurmaCart />
      <TramTracks />
      <Tram />
      <EuropeRoundabout />
      <Mosque />
      <MosqueYard />
      <FerrisWheel />
    </>
  )
}
