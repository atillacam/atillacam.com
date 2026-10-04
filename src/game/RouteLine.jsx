import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { findRoute, routeLength } from './route.js'
import { revealAround, routeState } from './navigation.js'
import { vehicleState } from './input.js'
import { heightAt } from './terrain.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playChime } from '../audio.js'

// Yerde akan ok desenli GPS şeridi: araçtan hedefe kadar yolu izler
const WIDTH = 1.15

function ribbon(points) {
  // Rotayı 1 m aralıklarla örnekle, araziye yapıştır
  const samples = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const steps = Math.max(1, Math.ceil(len))
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  const pos = new Float32Array(samples.length * 2 * 3)
  const uv = new Float32Array(samples.length * 2 * 2)
  const index = []
  let dist = 0
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i]
    const q = samples[Math.min(i + 1, samples.length - 1)]
    const o = samples[Math.max(i - 1, 0)]
    let dx = q.x - o.x
    let dz = q.z - o.z
    const l = Math.hypot(dx, dz) || 1
    dx /= l
    dz /= l
    if (i > 0) dist += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z)
    const nx = -dz * (WIDTH / 2)
    const nz = dx * (WIDTH / 2)
    const y = heightAt(p.x, p.z) + 0.14
    pos.set([p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz], i * 6)
    uv.set([0, dist, 1, dist], i * 4)
    if (i > 0) {
      const a = (i - 1) * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

export default function RouteLine() {
  const mesh = useRef()
  const emptyGeometry = useMemo(() => new THREE.BufferGeometry(), [])
  const state = useRef({ timer: 0, reveal: 0, lastX: Infinity, lastZ: Infinity, targetId: null })
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#6aa1ff') } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            // Hedefe doğru akan ok (chevron) deseni
            float along = vUv.y * 0.55 - uTime * 1.4;
            float across = abs(vUv.x - 0.5) * 2.0;
            float chevron = fract(along + across * 0.35);
            float arrow = smoothstep(0.0, 0.08, chevron) * (1.0 - smoothstep(0.32, 0.42, chevron));
            float edge = 1.0 - smoothstep(0.8, 1.0, across);
            float a = (0.28 + arrow * 0.62) * edge;
            gl_FragColor = vec4(uColor * (1.0 + arrow * 0.8), a);
          }
        `,
      }),
    [],
  )

  useFrame((_, delta) => {
    const s = state.current
    material.uniforms.uTime.value += Math.min(delta, 0.1)
    const { x, z } = vehicleState.position
    const store = useStore.getState()

    // Keşif sisi: gezilen yerleri aç
    s.reveal += delta
    if (s.reveal > 0.3 && store.started) {
      s.reveal = 0
      revealAround(x, z)
    }

    const target = store.navTarget
    const m = mesh.current
    if (!target) {
      if (m) m.visible = false
      if (routeState.points.length) {
        routeState.points = []
        routeState.length = 0
        routeState.next = null
        routeState.version++
      }
      s.targetId = null
      return
    }
    material.uniforms.uColor.value.set(target.color ?? '#6aa1ff')

    // Varış
    const toTarget = Math.hypot(target.x - x, target.z - z)
    if (toTarget < (target.radius ?? 8) * 0.8) {
      store.setNavTarget(null)
      store.toast(translate('arrived', store.lang), translate(target.label, store.lang))
      if (!store.muted) playChime()
      return
    }

    // Rotayı araç belirgin hareket edince ya da hedef değişince yeniden hesapla
    s.timer += delta
    const moved = Math.hypot(x - s.lastX, z - s.lastZ)
    const empty = !m?.geometry?.attributes?.position
    if (empty || s.targetId !== target.id || (s.timer > 0.6 && moved > 4)) {
      s.timer = 0
      s.lastX = x
      s.lastZ = z
      s.targetId = target.id
      const points = findRoute(x, z, target.x, target.z)
      routeState.points = points
      routeState.length = routeLength(points)
      routeState.version++
      if (m) {
        m.geometry.dispose()
        m.geometry = ribbon(points)
      }
    }
    if (m) m.visible = true

    // Yön oku için aracın ~10 m ilerisindeki rota noktası
    let acc = 0
    let next = routeState.points[routeState.points.length - 1]
    for (let i = 1; i < routeState.points.length; i++) {
      const a = routeState.points[i - 1]
      const b = routeState.points[i]
      acc += Math.hypot(b.x - a.x, b.z - a.z)
      if (acc > 10) {
        next = b
        break
      }
    }
    routeState.next = next
  })

  return <mesh ref={mesh} material={material} visible={false} frustumCulled={false} renderOrder={2} geometry={emptyGeometry} />
}
