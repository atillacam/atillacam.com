import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './time.js'
import { LAKE } from './layout.js'
import { heightAt } from './terrain.js'

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Kod içinde üretilen yumuşak bulut dokusu
let cloudTexture = null
function getCloudTexture() {
  if (cloudTexture) return cloudTexture
  const w = 256
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const rand = seeded(42)
  for (let i = 0; i < 22; i++) {
    const x = w * 0.18 + rand() * w * 0.64
    const y = h * 0.42 + (rand() - 0.5) * h * 0.3
    const r = 18 + rand() * 30
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  cloudTexture = new THREE.CanvasTexture(canvas)
  cloudTexture.colorSpace = THREE.SRGBColorSpace
  return cloudTexture
}

const DAY = new THREE.Color('#ffffff')
const DUSK = new THREE.Color('#ffc7a8')
const NIGHT = new THREE.Color('#3a4466')

function Clouds() {
  const clouds = useMemo(() => {
    const rand = seeded(9)
    return Array.from({ length: 16 }, () => {
      const a = rand() * Math.PI * 2
      const r = 70 + rand() * 120
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 55 + rand() * 30, scale: 40 + rand() * 45, speed: 0.6 + rand() * 0.8 }
    })
  }, [])
  const refs = useRef([])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    // Gün batımında pembe-turuncu, gece koyu ve saydam
    const t = world.time
    const dusk = Math.max(1 - Math.abs(t - 0.75) / 0.06, 0) + Math.max(1 - Math.abs(t - 0.26) / 0.05, 0)
    color.copy(DAY).lerp(DUSK, Math.min(dusk, 1)).lerp(NIGHT, world.night)
    refs.current.forEach((sprite, i) => {
      if (!sprite) return
      const c = clouds[i]
      c.x += c.speed * delta
      if (c.x > 200) c.x = -200
      sprite.position.set(c.x, c.y, c.z)
      sprite.material.color.copy(color)
      sprite.material.opacity = 0.85 - world.night * 0.55
    })
  })

  return clouds.map((c, i) => (
    <sprite key={i} ref={(el) => (refs.current[i] = el)} position={[c.x, c.y, c.z]} scale={[c.scale, c.scale * 0.45, 1]}>
      <spriteMaterial map={getCloudTexture()} transparent depthWrite={false} fog={false} />
    </sprite>
  ))
}

// Gece göl kıyısında ve ağaçların arasında uçuşan ateş böcekleri
function Fireflies({ count = 90 }) {
  const data = useMemo(() => {
    const rand = seeded(17)
    const base = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Yarısı gölün çevresinde, yarısı dünyaya dağınık
      let x
      let z
      if (i % 2 === 0) {
        const a = rand() * Math.PI * 2
        const r = LAKE.radius + 1 + rand() * 9
        x = LAKE.x + Math.cos(a) * r
        z = LAKE.z + Math.sin(a) * r
      } else {
        x = (rand() * 2 - 1) * 62
        z = (rand() * 2 - 1) * 62
      }
      base[i * 3] = x
      base[i * 3 + 1] = Math.max(heightAt(x, z), LAKE.waterLevel) + 0.6 + rand() * 1.8
      base[i * 3 + 2] = z
      phase[i] = rand() * 100
    }
    return { base, phase }
  }, [count])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.base.slice(), 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(data.phase, 1))
    return g
  }, [data])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 400 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uScale;
          attribute float aPhase;
          varying float vBlink;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.7 + aPhase) * 0.9;
            p.y += sin(uTime * 1.1 + aPhase * 1.7) * 0.35;
            p.z += cos(uTime * 0.6 + aPhase * 0.8) * 0.9;
            vBlink = 0.35 + 0.65 * pow(max(0.5 + 0.5 * sin(uTime * 2.3 + aPhase * 3.0), 0.0), 3.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = 0.22 * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uNight;
          varying float vBlink;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vBlink * uNight;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * 1.6, a);
          }
        `,
      }),
    [],
  )

  useFrame((state, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1)
    material.uniforms.uNight.value = Math.max(world.night - 0.2, 0) / 0.8
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(state.camera.fov) / 2))
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

export default function Atmosphere() {
  return (
    <>
      <Clouds />
      <Fireflies />
    </>
  )
}
