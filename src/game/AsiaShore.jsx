import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { ASIA_BUILDINGS, ASIA_MOSQUE } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import StaticMerge from './StaticMerge.jsx'

// Asya Yakası silüeti: yamaçlara yayılan pastel binalar ve tepede cami.
// Binalar tek çizimde (instanced); pencere dokusu bina boyuna göre tekrarlanır, gece rastgele pencereler yanar.

const TINTS = ['#efe4cf', '#e9c9a8', '#f3e6b8', '#d9e1e6', '#e6b9a6', '#f4f1ea'].map((c) => new THREE.Color(c))
const FLOOR = 3 // m: bir kat ve pencere aralığı

// Pencere dokusu (bir hücre = bir pencere aralığı): duvar rengi beyaz (bina rengi ile çarpılır), cam koyu
function windowTextures() {
  const size = 64
  const make = (lit) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = lit ? '#000' : '#fff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = lit ? '#ffcf7a' : '#3b4452'
    ctx.fillRect(18, 16, 28, 30)
    if (!lit) {
      ctx.fillStyle = '#d9d4c8'
      ctx.fillRect(14, 46, 36, 4) // pencere denizliği
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  return { map: make(false), lit: make(true) }
}

function Buildings() {
  const walls = useRef()
  const roofs = useRef()
  const { material, roofMaterial, geometry } = useMemo(() => {
    const { map, lit } = windowTextures()
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap: lit, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.85 })
    // Her bina kendi ölçüsüne göre pencere tekrarı alır; gece yanan pencereler binaya göre karışık
    material.onBeforeCompile = (shader) => {
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
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            // Pencerelerin yaklaşık üçte biri yanar (hücre başına sabit rastgele)
            float on = step(0.66, fract(sin(dot(floor(vCell) + vSeed, vec2(12.9898, 78.233))) * 43758.5453));
            totalEmissiveRadiance *= on;
          }`,
        )
    }
    material.customProgramCacheKey = () => 'asia-buildings'
    const roofMaterial = new THREE.MeshStandardMaterial({ color: '#b5583d', roughness: 0.8 })
    // Taban y=0, tavan y=1 (ölçekle uzar)
    const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    return { material, roofMaterial, geometry }
  }, [])

  const placed = useMemo(
    () =>
      ASIA_BUILDINGS.map((b) => {
        // Eğimli zeminde boşluk kalmasın: en alçak köşeye otur, biraz göm
        const ground = Math.min(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => heightAt(b.x + (sx * b.w) / 2, b.z + (sz * b.d) / 2)))) - 0.8
        return { ...b, y: ground, top: heightAt(b.x, b.z) + b.h }
      }),
    [],
  )

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const repeat = new Float32Array(placed.length * 2)
    const seeds = new Float32Array(placed.length)
    placed.forEach((b, i) => {
      const height = b.top - b.y
      m.makeScale(b.w, height, b.d).setPosition(b.x, b.y, b.z)
      walls.current.setMatrixAt(i, m)
      walls.current.setColorAt(i, TINTS[b.tint])
      m.makeScale(b.w + 0.5, 0.45, b.d + 0.5).setPosition(b.x, b.top, b.z)
      roofs.current.setMatrixAt(i, m)
      repeat[i * 2] = Math.max(1, Math.round(Math.max(b.w, b.d) / FLOOR))
      repeat[i * 2 + 1] = Math.max(1, Math.round(height / FLOOR))
      seeds[i] = i * 7.31
    })
    walls.current.geometry.setAttribute('aRepeat', new THREE.InstancedBufferAttribute(repeat, 2))
    walls.current.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    for (const mesh of [walls.current, roofs.current]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    walls.current.instanceColor.needsUpdate = true
  }, [placed])

  useFrame(() => {
    material.emissiveIntensity = world.night * 1.3
  })

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {placed.map((b, i) => (
          <CuboidCollider key={i} args={[b.w / 2, (b.top - b.y) / 2, b.d / 2]} position={[b.x, (b.y + b.top) / 2, b.z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={walls} args={[geometry.clone(), material, placed.length]} castShadow receiveShadow />
      <instancedMesh ref={roofs} args={[geometry, roofMaterial, placed.length]} castShadow />
    </>
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
        {/* Yarım kubbeler dört yanda */}
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
        {/* Minareler (çapraz köşelerde) */}
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
      <Mosque />
    </>
  )
}
