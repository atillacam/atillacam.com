import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { input, vehicleState } from './input.js'
import { WORLD } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { useStore } from '../store.js'
import { updateHeli } from '../audio.js'

// Gezinti helikopteri: haritanın üzerinde serbestçe uçmak için.
// Yerel eksen arabayla aynı: ileri = +x, yukarı = +y. Çarpışma yok; yalnızca arazinin üstünde kalır.
const CRUISE_SPEED = 20 // m/s
const BOOST_SPEED = 34
const CLIMB_SPEED = 8
const MIN_CLEARANCE = 2.2 // kızakların arazinin üstünde kalacağı yükseklik
const MAX_ALTITUDE = 85
const TOUCH_CLEARANCE = 18 // dokunmatikte otomatik irtifa
const MARGIN = 6 // dünya sınırından içeride

function buildHelicopter() {
  const root = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: '#f2f4fa', roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 })
  const accent = new THREE.MeshPhysicalMaterial({ color: '#5b6cff', roughness: 0.35, metalness: 0.4, clearcoat: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1b2030', roughness: 0.6, metalness: 0.5 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0f1a2e', roughness: 0.05, metalness: 0.3, clearcoat: 1, transparent: true, opacity: 0.85 })
  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true
    parent.add(m)
    return m
  }
  // Gövde: yumuşak hatlı kabin + alt şerit
  const cabin = add(new THREE.SphereGeometry(1, 32, 20), paint, 0.2, 1.35, 0)
  cabin.scale.set(1.75, 0.95, 0.92)
  const stripe = add(new THREE.SphereGeometry(1, 32, 20), accent, 0.15, 1.12, 0)
  stripe.scale.set(1.62, 0.55, 0.95)
  // Kokpit camı (önde)
  const canopy = add(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0.95, 1.55, 0, 0, 0, -Math.PI / 2.6)
  canopy.scale.set(0.8, 0.85, 0.82)
  // Kuyruk kirişi, dikey ve yatay dengeleyiciler
  add(new THREE.CylinderGeometry(0.12, 0.3, 3.6, 14), paint, -2.75, 1.55, 0, 0, 0, Math.PI / 2 + 0.06)
  add(new RoundedBoxGeometry(0.7, 0.9, 0.08, 2, 0.03), accent, -4.45, 1.95, 0, 0, 0, -0.25)
  add(new RoundedBoxGeometry(0.5, 0.06, 1.1, 2, 0.02), paint, -4.25, 1.6, 0)
  // Rotor göbeği
  add(new THREE.CylinderGeometry(0.16, 0.22, 0.45, 12), dark, 0.15, 2.45, 0)
  // Kızaklar ve bağlantılar
  for (const z of [-0.8, 0.8]) {
    add(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 10), dark, 0.2, 0.05, z, 0, 0, Math.PI / 2)
    for (const x of [-0.6, 0.9]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), dark, x, 0.42, z * 0.85, z > 0 ? -0.35 : 0.35, 0, 0)
  }
  // Ana rotor (dönen)
  const rotor = new THREE.Group()
  rotor.position.set(0.15, 2.72, 0)
  root.add(rotor)
  for (let i = 0; i < 4; i++) {
    const blade = add(new RoundedBoxGeometry(3.6, 0.05, 0.26, 2, 0.02), dark, 1.8, 0, 0, 0, 0, 0, new THREE.Group())
    blade.parent.rotation.y = (i / 4) * Math.PI * 2
    rotor.add(blade.parent)
  }
  // Hızlı dönerken bulanık rotor diski
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshBasicMaterial({ color: '#1b2030', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }))
  disc.rotation.x = -Math.PI / 2
  rotor.add(disc)
  // Kuyruk rotoru
  const tail = new THREE.Group()
  tail.position.set(-4.5, 1.95, 0.12)
  root.add(tail)
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group()
    g.rotation.z = i * Math.PI
    add(new RoundedBoxGeometry(0.08, 0.7, 0.03, 1, 0.01), dark, 0, 0.35, 0, 0, 0, 0, g)
    tail.add(g)
  }
  // Seyir ışıkları: sol kırmızı, sağ yeşil, kuyrukta beyaz flaş
  const lamp = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
    m.position.set(x, y, z)
    root.add(m)
    return m
  }
  lamp('#ff3b3b', 0.2, 1.3, -0.95)
  lamp('#3bff7a', 0.2, 1.3, 0.95)
  const strobe = lamp('#ffffff', -4.7, 2.42, 0)
  return { root, rotor, disc, tail, strobe }
}

// Yumuşak, yuvarlak gölge dokusu
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const _fwd = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _look = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')
const _tilt = new THREE.Euler()

export default function Helicopter() {
  const camera = useThree((s) => s.camera)
  const group = useRef()
  const shadow = useRef()
  const model = useMemo(() => buildHelicopter(), [])
  const shadowMap = useMemo(() => shadowTexture(), [])
  const s = useRef({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    yawRate: 0,
    pitch: 0,
    roll: 0,
    spin: 0,
    takeoff: 0,
    active: false,
    look: new THREE.Vector3(),
  })

  // Helikopter moduna girince arabanın üstünden kalkar
  useEffect(
    () =>
      useStore.subscribe((st, prev) => {
        if (st.mode === 'heli' && prev.mode === 'car') {
          const h = s.current
          const p = vehicleState.position
          h.pos.set(p.x, Math.max(p.y, heightAt(p.x, p.z)) + 0.6, p.z)
          h.vel.set(0, 0, 0)
          h.yaw = vehicleState.heading
          h.yawRate = 0
          h.takeoff = 1.8
          h.active = true
          h.look.copy(h.pos)
        }
      }),
    [],
  )

  useFrame((_, delta) => {
    const dt = THREE.MathUtils.clamp(delta, 0, 0.05)
    const store = useStore.getState()
    const h = s.current
    const g = group.current
    if (store.mode === 'car') {
      if (g) g.visible = false
      if (shadow.current) shadow.current.visible = false
      if (h.active) {
        h.active = false
        updateHeli(false, 0)
      }
      return
    }
    if (!g) return
    g.visible = true

    // Haritadan ışınlanma: helikopteri hedefin üstüne taşı
    if (vehicleState.heliTeleport) {
      const [x, , z] = vehicleState.heliTeleport.position
      h.pos.set(x, Math.max(h.pos.y, heightAt(x, z) + 12), z)
      h.vel.set(0, 0, 0)
      h.yaw = vehicleState.heliTeleport.yaw ?? h.yaw
      vehicleState.heliTeleport = null
    }

    const landing = store.mode === 'landing'
    const usable = store.started && !store.modal
    const k = input.keys
    let throttle = usable ? (k.forward ? 1 : 0) - (k.backward ? 1 : 0) : 0
    let turn = usable ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0
    let lift = usable ? (k.up ? 1 : 0) - (k.brake ? 1 : 0) : 0
    let boost = usable && k.boost
    const ground = heightAt(h.pos.x, h.pos.z)
    if (input.touch.active && usable) {
      throttle = input.touch.throttle
      turn = input.touch.steer
      boost ||= input.touch.boost
      // Dokunmatikte irtifa kendiliğinden korunur (turbo düğmesi daha yükseğe çıkarır)
      const target = ground + TOUCH_CLEARANCE + (boost ? 20 : 0)
      lift = THREE.MathUtils.clamp((target - h.pos.y) / 4, -1, 1)
    }
    if (landing) {
      throttle = 0
      turn = 0
      lift = -1
    }
    // Kalkış: ilk anlarda kendiliğinden yükselir
    if (h.takeoff > 0) {
      h.takeoff -= dt
      if (lift <= 0 && !landing) lift = 1
    }

    // Yatay hız: istenen hıza yumuşakça yaklaş (ataletli, kaygan uçuş hissi)
    _fwd.set(Math.cos(h.yaw), 0, -Math.sin(h.yaw))
    const max = boost ? BOOST_SPEED : CRUISE_SPEED
    const ease = 1 - Math.exp(-(landing ? 3 : 1.4) * dt)
    const prevFwd = h.vel.x * _fwd.x + h.vel.z * _fwd.z
    h.vel.x += (_fwd.x * throttle * max - h.vel.x) * ease
    h.vel.z += (_fwd.z * throttle * max - h.vel.z) * ease
    // İnişte yüksekten hızlı, yere yaklaştıkça yavaş alçalır
    const landSpeed = THREE.MathUtils.clamp((h.pos.y - ground) * 0.7, 3, 14)
    h.vel.y += (lift * (landing ? landSpeed : CLIMB_SPEED) - h.vel.y) * (1 - Math.exp(-(landing ? 4 : 2.2) * dt))
    h.yawRate += (turn * 1.5 - h.yawRate) * (1 - Math.exp(-4 * dt))
    h.yaw += h.yawRate * dt
    h.pos.addScaledVector(h.vel, dt)

    // Sınırlar: arazinin üstünde, dünyanın içinde, belli bir irtifanın altında
    h.pos.x = THREE.MathUtils.clamp(h.pos.x, WORLD.minX + MARGIN, WORLD.maxX - MARGIN)
    h.pos.z = THREE.MathUtils.clamp(h.pos.z, WORLD.minZ + MARGIN, WORLD.maxZ - MARGIN)
    const floor = heightAt(h.pos.x, h.pos.z) + MIN_CLEARANCE * (landing ? 0.35 : 1)
    if (h.pos.y < floor) {
      h.pos.y = floor
      h.vel.y = Math.max(h.vel.y, 0)
    }
    if (h.pos.y > MAX_ALTITUDE) {
      h.pos.y = MAX_ALTITUDE
      h.vel.y = Math.min(h.vel.y, 0)
    }

    // İniş tamamlandı: araba helikopterin altına gelir
    if (landing && h.pos.y <= floor + 0.05) {
      vehicleState.teleport = { position: [h.pos.x, heightAt(h.pos.x, h.pos.z) + 1.3, h.pos.z], yaw: h.yaw }
      store.setMode('car')
      return
    }

    // Gövde eğimi: hızlanırken burun öne, dönerken yana yatar
    const fwdSpeed = h.vel.x * _fwd.x + h.vel.z * _fwd.z
    const accel = (fwdSpeed - prevFwd) / Math.max(dt, 1e-3)
    h.pitch += (-THREE.MathUtils.clamp(fwdSpeed / BOOST_SPEED * 0.28 + accel * 0.012, -0.35, 0.35) - h.pitch) * (1 - Math.exp(-3 * dt))
    h.roll += (-h.yawRate * 0.22 - h.roll) * (1 - Math.exp(-3 * dt))
    _e.set(0, h.yaw, 0)
    g.position.copy(h.pos)
    g.quaternion.setFromEuler(_e)
    _q.setFromEuler(_tilt.set(h.roll, 0, h.pitch))
    g.quaternion.multiply(_q)

    // Rotorlar, flaş ışığı, ses
    const power = landing ? 0.6 : 0.75 + Math.min(Math.abs(throttle) + Math.abs(lift) * 0.5, 1) * 0.25
    h.spin += dt * 28 * power
    model.rotor.rotation.y = h.spin
    model.disc.material.opacity = 0.1 + power * 0.06
    model.tail.rotation.z = h.spin * 2.2
    model.strobe.visible = (performance.now() % 1200) < 90
    if (!store.muted) updateHeli(true, power)
    else updateHeli(false, 0)

    // Zemindeki gölge: yükseldikçe büyür ve solar
    const altitude = h.pos.y - heightAt(h.pos.x, h.pos.z)
    if (shadow.current) {
      shadow.current.visible = true
      shadow.current.position.set(h.pos.x, heightAt(h.pos.x, h.pos.z) + 0.06, h.pos.z)
      const sc = 4.5 + altitude * 0.06
      shadow.current.scale.set(sc, sc, 1)
      shadow.current.material.opacity = THREE.MathUtils.clamp(0.7 - altitude / 60, 0.12, 0.7) * (1 - world.night * 0.6)
    }

    // Canlı durum: harita, keşif sisi, GPS ve hız göstergesi helikopteri izler
    vehicleState.position.x = h.pos.x
    vehicleState.position.y = h.pos.y
    vehicleState.position.z = h.pos.z
    vehicleState.heading = h.yaw
    vehicleState.speed = fwdSpeed
    vehicleState.altitude = altitude
    vehicleState.grounded = false
    vehicleState.slip = 0
    vehicleState.rearContact[0] = vehicleState.rearContact[1] = false
    world.uniforms.uCar.value.set(h.pos.x, h.pos.y, h.pos.z)

    // Takip kamerası: arkadan ve yukarıdan, hızlanınca biraz uzaklaşır
    const dist = 15 + Math.min(Math.abs(fwdSpeed), BOOST_SPEED) * 0.18
    _camPos.set(h.pos.x - _fwd.x * dist, h.pos.y + 6 + dist * 0.18, h.pos.z - _fwd.z * dist)
    const camFloor = heightAt(_camPos.x, _camPos.z) + 2
    if (_camPos.y < camFloor) _camPos.y = camFloor
    camera.position.lerp(_camPos, 1 - Math.exp(-3 * dt))
    _look.set(h.pos.x + _fwd.x * 6, h.pos.y + 0.5, h.pos.z + _fwd.z * 6)
    h.look.lerp(_look, 1 - Math.exp(-5 * dt))
    camera.lookAt(h.look)
    vehicleState.cameraYaw = Math.atan2(h.look.x - camera.position.x, h.look.z - camera.position.z)
  })

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model.root} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowMap} transparent depthWrite={false} opacity={0.5} />
      </mesh>
    </>
  )
}
