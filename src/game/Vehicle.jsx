import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { input, pollGamepad, vehicleState } from './input.js'
import { AREAS, LAKE, SPAWN, WORLD_HALF } from './layout.js'
import { world as worldTime } from './time.js'
import { heightAt } from './terrain.js'
import { bakedGeometry } from './geometry.js'
import TurboFlame from './TurboFlame.jsx'
import { buildRacer, paintHex, PAINTS } from './cars.js'
import { useStore } from '../store.js'
import { playHonk, playSplash, playThud, setMuted, setMusic, updateAmbience, updateEngine } from '../audio.js'

export const CAR_URL = '/models/car.glb'

// Araç yerel ekseninde ileri = +x, yukarı = +y, sol = -z.
// Ölçüler optimize edilmiş car.glb'den alındı (scripts/optimize-models.mjs).
const MASS = 6
const MASS_PROPERTIES = {
  mass: MASS,
  // Alçak kütle merkezi ve yüksek eylemsizlik: hızlanırken şaha kalkmaz, virajda devrilmez
  centerOfMass: { x: 0.05, y: -0.4, z: 0 },
  // Yüksek yalpa/yunuslama eylemsizliği: gaz ve frende gövde abartılı yatmaz
  principalAngularInertia: { x: 3.6, y: 3.8, z: 8.5 },
  angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
}
const WHEEL_RADIUS = 0.31
const REST_LENGTH = 0.3
const WHEELS = [
  { position: { x: 0.615, y: 0, z: -0.59 }, front: true },
  { position: { x: 0.615, y: 0, z: 0.59 }, front: true },
  { position: { x: -0.61, y: 0, z: -0.59 }, front: false },
  { position: { x: -0.61, y: 0, z: 0.59 }, front: false },
]
// Modelde tekerlek merkezleri y=0'da; süspansiyon dinlenmedeyken onları aynı yere oturtmak için
const MODEL_OFFSET_Y = -REST_LENGTH
vehicleState.modelOffsetY = MODEL_OFFSET_Y

// Varsayılan kamera açısı: güneydoğudan, hafif yukarıdan
const CAMERA_HOME = { azimuth: 0.42, polar: 0.98 }

const ENGINE_FORCE = 30
const BOOST_MULTIPLIER = 1.6
const MAX_SPEED = 17
const MAX_BOOST_SPEED = 25
const BRAKE_FORCE = 0.6
const MAX_STEER = 0.48
// Görsel direksiyon açısı fiziğin %65'i: geniş lastikler çamurluktan taşmaz
const VISUAL_STEER = 0.65

const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _up = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _target = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _vel = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _right = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _wheel = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Tekerleğin görsel süspansiyon hareketi çamurluk boşluğuyla sınırlı (yukarı 7 cm, aşağı 5 cm)
function visualSuspension(length) {
  return THREE.MathUtils.clamp(length ?? REST_LENGTH, REST_LENGTH - 0.07, REST_LENGTH + 0.05)
}

function yawQuaternion(yaw) {
  return _quat.setFromEuler(_euler.set(0, yaw, 0))
}

// GLB'den gövde ve tekerlekleri ayır; tekerlek geometrisini kendi merkezine taşı ki dönebilsin
function useCarModel() {
  const { scene } = useGLTF(CAR_URL)
  return useMemo(() => {
    const body = new THREE.Group()
    const wheels = {}
    const glass = []
    const paint = []
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if (!o.isMesh) return
      const mesh = o.clone()
      mesh.geometry = bakedGeometry(o)
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      mesh.castShadow = true
      mesh.receiveShadow = true
      // GLTFLoader düğüm adlarındaki boşlukları alt çizgiye çevirir
      const name = (o.name || o.parent?.name || '').replace(/_/g, ' ')
      const wheelName = ['front left wheel', 'front right wheel', 'rear wheels'].find((n) => name.startsWith(n))
      if (wheelName) {
        mesh.geometry.computeBoundingBox()
        const center = new THREE.Vector3()
        mesh.geometry.boundingBox.getCenter(center)
        mesh.geometry.translate(-center.x, -center.y, -center.z)
        wheels[wheelName] = mesh
      } else {
        // Boya: gövde malzemesi garajdaki renge boyanır (doku ile çarpılır)
        if (mesh.material.name === 'car_body') {
          mesh.material = mesh.material.clone()
          paint.push(mesh.material)
        }
        if (mesh.material.name === 'headlight_glass') {
          mesh.material = mesh.material.clone()
          mesh.material.emissive = new THREE.Color('#fff2c6')
          glass.push(mesh.material)
        }
        body.add(mesh)
      }
    })
    return { body, wheels, glass, paint }
  }, [scene])
}

export default function Vehicle() {
  const body = useRef()
  const collider = useRef()
  const wheelGroups = useRef([])
  const controller = useRef()
  const headlight = useRef()
  const visual = useRef()
  const headlightTarget = useMemo(() => new THREE.Object3D(), [])
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const glbCar = useCarModel()
  const racer = useMemo(() => buildRacer(), [])
  const carId = useStore((s) => s.carId)
  const carColor = useStore((s) => s.carColor)
  const car = carId === 'racer' ? racer : glbCar

  // Seçilen boya rengini uygula
  useEffect(() => {
    const hex = paintHex(carColor)
    const metal = PAINTS.find((p) => p.id === carColor)?.metal
    car.paint.forEach((m) => {
      // Özgün yüzey değerleri bir kez saklanır; metalik boya geri alınabilsin
      m.userData.base ??= { metalness: m.metalness, roughness: m.roughness }
      m.color.set(hex)
      m.metalness = metal ? 0.65 : m.userData.base.metalness
      m.roughness = metal ? 0.28 : m.userData.base.roughness
    })
  }, [car, carColor])

  const steer = useRef(0)
  const lookTarget = useRef(new THREE.Vector3(...SPAWN.position))
  const orbit = useRef({ ...CAMERA_HOME, polar: 0.72, distance: 88, baseDistance: 16, intro: 0, dragging: false, lastX: 0, lastY: 0, idle: 10 })
  const stats = useRef({ distance: 0, flushed: 0, upsideDown: 0, lastPos: null, splash: 0 })
  const shake = useRef({ amount: 0, lastHit: 0 })
  const blob = useRef()

  // Rapier ışın tabanlı araç kontrolcüsü
  useEffect(() => {
    const vehicle = world.createVehicleController(body.current)
    WHEELS.forEach((wheel, i) => {
      vehicle.addWheel(wheel.position, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 }, REST_LENGTH, WHEEL_RADIUS)
      vehicle.setWheelSuspensionStiffness(i, 46)
      vehicle.setWheelSuspensionCompression(i, 4.6)
      vehicle.setWheelSuspensionRelaxation(i, 5.2)
      vehicle.setWheelMaxSuspensionTravel(i, 0.14)
      vehicle.setWheelFrictionSlip(i, 3.2)
      vehicle.setWheelSideFrictionStiffness(i, 1.1)
    })
    controller.current = vehicle
    if (import.meta.env.DEV) window.__portfolio = Object.assign(window.__portfolio ?? {}, { vehicleBody: body.current })
    return () => {
      controller.current = null
      world.removeVehicleController(vehicle)
    }
  }, [world])

  // Kamerayı fareyle sürükleyip döndürme, tekerlekle yakınlaştırma
  useEffect(() => {
    const el = gl.domElement
    const o = orbit.current
    const down = (e) => {
      if (e.pointerType === 'touch') return
      o.dragging = true
      o.lastX = e.clientX
      o.lastY = e.clientY
    }
    const move = (e) => {
      if (!o.dragging) return
      o.azimuth -= (e.clientX - o.lastX) * 0.005
      o.polar = THREE.MathUtils.clamp(o.polar - (e.clientY - o.lastY) * 0.004, 0.45, 1.3)
      o.lastX = e.clientX
      o.lastY = e.clientY
      o.idle = 0
    }
    const up = () => (o.dragging = false)
    const wheel = (e) => {
      o.baseDistance = THREE.MathUtils.clamp(o.baseDistance + e.deltaY * 0.012, 7, 32)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('wheel', wheel, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  // Ses açık/kapalı
  useEffect(() => {
    setMuted(useStore.getState().muted)
    setMusic(useStore.getState().music)
    return useStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) setMuted(s.muted)
      if (s.music !== prev.music) setMusic(s.music)
    })
  }, [])

  const respawn = (position, yaw) => {
    const rb = body.current
    // Her zaman arazinin üstüne bırak (tepelerde zeminin içine doğmasın)
    const y = Math.max(position[1], heightAt(position[0], position[2]) + 1.3)
    rb.setTranslation({ x: position[0], y, z: position[2] }, true)
    rb.setRotation(yawQuaternion(yaw), true)
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
    stats.current.lastPos = null
  }

  useBeforePhysicsStep((physicsWorld) => {
    const vehicle = controller.current
    const rb = body.current
    if (!vehicle || !rb) return
    const store = useStore.getState()
    const active = store.started && !store.modal && !store.race.countdown && store.mode === 'car'

    // Klavye + dokunmatik + gamepad birleşimi
    const pad = pollGamepad()
    const k = input.keys
    let throttle = (k.forward ? 1 : 0) - (k.backward ? 1 : 0)
    let steerInput = (k.left ? 1 : 0) - (k.right ? 1 : 0)
    let boost = k.boost
    let brake = k.brake
    if (input.touch.active) {
      throttle = input.touch.throttle
      steerInput = input.touch.steer
      boost ||= input.touch.boost
    }
    if (pad && (pad.throttle !== 0 || pad.steer !== 0 || pad.boost || pad.brake)) {
      throttle = pad.throttle || throttle
      steerInput = pad.steer || steerInput
      boost ||= pad.boost
      brake ||= pad.brake
    }
    if (!active) {
      throttle = 0
      steerInput = 0
      boost = false
    }
    vehicleState.throttle = Math.abs(throttle)
    vehicleState.boost = boost && throttle > 0

    const speed = vehicle.currentVehicleSpeed()
    const maxSpeed = boost ? MAX_BOOST_SPEED : MAX_SPEED
    // Ters yönde gaz verilirse önce fren yap
    const reversing = throttle !== 0 && Math.sign(throttle) !== Math.sign(speed) && Math.abs(speed) > 1
    let engine = 0
    if (!reversing && throttle !== 0) {
      const limit = throttle > 0 ? maxSpeed : maxSpeed * 0.5
      const headroom = THREE.MathUtils.clamp(1 - Math.abs(speed) / limit, 0, 1)
      engine = throttle * ENGINE_FORCE * (boost ? BOOST_MULTIPLIER : 1) * Math.min(1, headroom * 3)
    }
    // El freni (B/Ctrl): arka tekerlekler kilitlenip tutuş azalır → kontrollü drift
    const handbrake = brake && Math.abs(speed) > 3
    const brakeForce = reversing ? BRAKE_FORCE : brake && !handbrake ? BRAKE_FORCE : throttle === 0 ? 0.14 : 0
    vehicleState.braking = brake || reversing
    vehicleState.handbrake = handbrake

    // Hızlandıkça direksiyon açısı azalır: yüksek hızda kontrol kolaylaşır
    const steerLimit = THREE.MathUtils.lerp(MAX_STEER, 0.22, Math.min(Math.abs(speed) / MAX_BOOST_SPEED, 1))
    steer.current = THREE.MathUtils.lerp(steer.current, steerInput * steerLimit, 0.2)

    for (let i = 0; i < WHEELS.length; i++) {
      // Rapier, bu aks yönünde pozitif kuvveti geriye uygular; bu yüzden işaret ters
      vehicle.setWheelEngineForce(i, WHEELS[i].front ? 0 : -engine)
      vehicle.setWheelSteering(i, WHEELS[i].front ? steer.current : 0)
      vehicle.setWheelBrake(i, handbrake ? (WHEELS[i].front ? 0 : 0.22) : brakeForce)
      vehicle.setWheelFrictionSlip(i, handbrake && !WHEELS[i].front ? 1.05 : 3.2)
      vehicle.setWheelSideFrictionStiffness(i, handbrake && !WHEELS[i].front ? 0.5 : 1.1)
    }

    const ownCollider = collider.current
    vehicle.updateVehicle(physicsWorld.timestep, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== ownCollider.handle)

    const grounded = WHEELS.some((_, i) => vehicle.wheelIsInContact(i))
    vehicleState.grounded = grounded

    // Havadayken araç yavaşça düzleşir: rampadan atlayınca dört teker üstüne iner
    if (!grounded) {
      const r = rb.rotation()
      _quat.set(r.x, r.y, r.z, r.w)
      _up.set(0, 1, 0).applyQuaternion(_quat)
      if (_up.y > -0.2) {
        _axis.crossVectors(_up, WORLD_UP).multiplyScalar(MASS * 0.9 * physicsWorld.timestep)
        rb.applyTorqueImpulse({ x: _axis.x, y: 0, z: _axis.z }, true)
      }
    }

    // Tek seferlik olaylar
    if (input.events.size) {
      if (input.events.has('jump') && grounded && active) {
        rb.applyImpulse({ x: 0, y: MASS * 5.5, z: 0 }, true)
      }
      for (let n = 1; n <= 5; n++) {
        if (!input.events.has('hydro' + n) || !active || !grounded) continue
        const r = rb.rotation()
        _quat.set(r.x, r.y, r.z, r.w)
        const tr = rb.translation()
        const corners = n === 5 ? [0, 1, 2, 3] : [n - 1]
        for (const c of corners) {
          _wheel.set(WHEELS[c].position.x, 0, WHEELS[c].position.z).applyQuaternion(_quat)
          rb.applyImpulseAtPoint({ x: 0, y: MASS * (n === 5 ? 1.4 : 2.4), z: 0 }, { x: tr.x + _wheel.x, y: tr.y + _wheel.y, z: tr.z + _wheel.z }, true)
        }
      }
      if (input.events.has('honk') && active) {
        if (!store.muted) playHonk()
        store.addProgress('honk', 1)
      }
      if (input.events.has('respawn')) {
        const t = rb.translation()
        respawn([t.x, Math.max(t.y, 0) + 1.5, t.z], vehicleState.heading)
      }
      input.events.clear()
    }
    if (vehicleState.teleport) {
      // Helikopterdeyken haritadan ışınlanma helikopteri taşır (araba park yerinde kalır)
      if (store.mode === 'heli') vehicleState.heliTeleport = vehicleState.teleport
      else respawn(vehicleState.teleport.position, vehicleState.teleport.yaw)
      vehicleState.teleport = null
    }
  })

  useFrame((state, delta) => {
    const vehicle = controller.current
    const rb = body.current
    if (!vehicle || !rb) return
    const dt = Math.min(delta, 0.1)
    const store = useStore.getState()

    // Tekerlek görselleri: 0 = sol ön, 1 = sağ ön, 2 = arka aks (iki arka tekerleğin ortalaması)
    for (let i = 0; i < 3; i++) {
      const group = wheelGroups.current[i]
      if (!group) continue
      if (i < 2) {
        const c = vehicle.wheelChassisConnectionPointCs(i)
        const s = visualSuspension(vehicle.wheelSuspensionLength(i))
        group.position.set(c.x, c.y - s, c.z)
        group.rotation.set(0, (vehicle.wheelSteering(i) ?? 0) * VISUAL_STEER, 0)
        group.children[0].rotation.z = vehicle.wheelRotation(i) ?? 0
      } else {
        const s = (visualSuspension(vehicle.wheelSuspensionLength(2)) + visualSuspension(vehicle.wheelSuspensionLength(3))) / 2
        group.position.set(WHEELS[2].position.x, -s, 0)
        group.children[0].rotation.z = vehicle.wheelRotation(2) ?? 0
      }
    }

    // Helikopter modunda araba park hâlinde: kamera, ses ve canlı durum helikopterde
    if (store.mode !== 'car') {
      updateEngine(0, 0)
      updateAmbience(worldTime.night, worldTime.wet ?? 0, Math.abs(vehicleState.speed) * 0.6)
      return
    }

    // Ekranda çizilen (enterpolasyonlu) konum: kamera ve efektler bunu izler, böylece araç titremez
    const phys = rb.translation()
    visual.current.getWorldPosition(_pos)
    visual.current.getWorldQuaternion(_quat)
    const t = _pos
    _forward.set(1, 0, 0).applyQuaternion(_quat)
    _up.set(0, 1, 0).applyQuaternion(_quat)
    const speed = vehicle.currentVehicleSpeed()
    const lv = rb.linvel()
    _vel.set(lv.x, lv.y, lv.z)

    worldTime.uniforms.uCar.value.set(t.x, t.y, t.z)
    vehicleState.position.x = t.x
    vehicleState.position.y = t.y
    vehicleState.position.z = t.z
    vehicleState.heading = Math.atan2(-_forward.z, _forward.x)
    vehicleState.quaternion.x = _quat.x
    vehicleState.quaternion.y = _quat.y
    vehicleState.quaternion.z = _quat.z
    vehicleState.quaternion.w = _quat.w
    vehicleState.speed = speed
    vehicleState.upright = _up.y
    _right.set(0, 0, 1).applyQuaternion(_quat) // aracın sağı (+z)
    vehicleState.slip = Math.abs(_vel.dot(_right))
    for (let i = 0; i < 2; i++) {
      const s = vehicle.wheelSuspensionLength(i + 2) ?? REST_LENGTH
      _wheel.set(WHEELS[i + 2].position.x, -s - WHEEL_RADIUS + 0.02, WHEELS[i + 2].position.z).applyQuaternion(_quat).add(_pos)
      vehicleState.rearWheels[i].x = _wheel.x
      vehicleState.rearWheels[i].y = _wheel.y
      vehicleState.rearWheels[i].z = _wheel.z
      vehicleState.rearContact[i] = vehicle.wheelIsInContact(i + 2)
    }
    vehicleState.forward.x = _forward.x
    vehicleState.forward.y = _forward.y
    vehicleState.forward.z = _forward.z

    // Gizli kod: 30 sn gökkuşağı boya
    if (store.rainbow > performance.now()) {
      car.paint.forEach((m) => m.color.setHSL((state.clock.elapsedTime * 0.35) % 1, 0.75, 0.55))
      vehicleState.rainbowWas = true
    } else if (vehicleState.rainbowWas) {
      vehicleState.rainbowWas = false
      car.paint.forEach((m) => m.color.set(paintHex(store.carColor)))
    }

    // Gece farlar
    const night = worldTime.night
    const lights = store.headlights === 'on' ? 1 : store.headlights === 'off' ? 0 : night
    car.glass.forEach((m) => (m.emissiveIntensity = lights * 2.2))
    if (headlight.current) {
      headlight.current.intensity = lights * 40
      headlight.current.visible = lights > 0.05
    }

    // Dünyadan düşerse geri getir
    if (phys.y < -12 || Math.abs(phys.x) > WORLD_HALF + 10 || Math.abs(phys.z) > WORLD_HALF + 10) {
      respawn(SPAWN.position, SPAWN.yaw)
    }

    // Göle düşerse: sıçrama, başarım ve kıyıya geri dönüş
    const s = stats.current
    const inLake = Math.hypot(t.x - LAKE.x, t.z - LAKE.z) < LAKE.radius + 1 && t.y < LAKE.waterLevel + 0.15
    if (inLake) {
      if (s.splash === 0 && !store.muted) playSplash()
      s.splash += dt
      if (s.splash > 1.1) {
        const lake = AREAS.find((a) => a.id === 'lake')
        respawn(lake.spawn, lake.yaw)
        store.unlock('swim')
        s.splash = 0
      }
    } else s.splash = 0

    // Başarımlar
    if (store.started) {
      if (s.lastPos) {
        const d = Math.hypot(t.x - s.lastPos.x, t.z - s.lastPos.z)
        if (d < 2) s.distance += d
      }
      s.lastPos = { x: t.x, z: t.z }
      if (s.distance - s.flushed > 25) {
        store.addProgress('road', s.distance - s.flushed)
        s.flushed = s.distance
      }
      if (Math.hypot(t.x - SPAWN.position[0], t.z - SPAWN.position[2]) > 20) store.unlock('start')
      if (t.y - heightAt(t.x, t.z) > 5.5) store.unlock('sky')
      if (night > 0.6) store.unlock('night')
      // Kendini düzeltme: yan yatma, ters dönme ya da tekerlekleri yere değmeden takılı kalma
      const slow = _vel.length() < 2.5
      const tilted = _up.y < 0.45
      const stuck = !vehicleState.grounded && _vel.length() < 0.6
      if (_up.y < -0.5) {
        s.upsideDown += dt
        if (s.upsideDown > 0.6) store.unlock('turtle')
      } else s.upsideDown = 0
      s.tilt = (tilted && slow) || stuck ? (s.tilt ?? 0) + dt : 0
      vehicleState.recovering = Math.min((s.tilt ?? 0) / 1.3, 1)
      if (s.tilt > (stuck && !tilted ? 2.5 : 1.3)) {
        // Burun dikse yönü sağ vektörden al; değilse mevcut yönü koru
        const yaw = Math.abs(_forward.y) > 0.8 ? Math.atan2(_right.x, _right.z) : vehicleState.heading
        respawn([t.x, Math.max(t.y, heightAt(t.x, t.z)) + 1.6, t.z], yaw)
        if (!store.muted) playThud(1.5)
        s.tilt = 0
      }
    }

    // Motor sesi
    if (store.started && !store.muted) updateEngine(speed, store.modal ? 0 : vehicleState.throttle, vehicleState.slip, vehicleState.grounded)
    else updateEngine(0, 0)
    updateAmbience(worldTime.night, worldTime.wet ?? 0, store.started ? speed : 0)

    // Kamera takibi
    const o = orbit.current
    const cinematic = store.cinematic > performance.now()
    const chase = store.cameraMode === 'chase' && !cinematic
    if (!store.started) {
      // Giriş ekranı: dünyanın üzerinde yüksekten, yavaş bir tur
      o.azimuth += dt * 0.05
      o.polar += (0.72 - o.polar) * (1 - Math.exp(-2 * dt))
    } else if (cinematic) {
      // Gözlem tepesi: dünyanın etrafında yavaş, geniş bir tur
      o.azimuth += dt * 0.22
      o.polar += (1.0 - o.polar) * (1 - Math.exp(-1.2 * dt))
    } else if (chase && !o.dragging) {
      // Takip kamerası: aracın arkasında, hareket yönüne döner
      const behind = Math.atan2(-_forward.x, -_forward.z)
      const diff = Math.atan2(Math.sin(behind - o.azimuth), Math.cos(behind - o.azimuth))
      o.azimuth += diff * (1 - Math.exp(-3.5 * dt))
      o.polar += (1.22 - o.polar) * (1 - Math.exp(-3 * dt))
    } else if (!o.dragging) {
      // Kullanıcı bırakınca kamera 2 sn sonra varsayılan açıya yumuşakça döner
      o.idle += dt
      if (o.idle > 2) {
        const diff = Math.atan2(Math.sin(CAMERA_HOME.azimuth - o.azimuth), Math.cos(CAMERA_HOME.azimuth - o.azimuth))
        const ease = 1 - Math.exp(-1.6 * dt)
        o.azimuth += diff * ease
        o.polar += (CAMERA_HOME.polar - o.polar) * ease
      }
    }
    // Hızlıyken kamera biraz ileriye bakar
    _target.set(t.x + _vel.x * 0.18, t.y, t.z + _vel.z * 0.18)
    lookTarget.current.lerp(_target, 1 - Math.exp(-6 * dt))
    const lt = lookTarget.current
    // Dikey ekranda (telefon) görüş alanı dar; kamerayı uzaklaştır
    const speedAbs = Math.abs(speed)
    const targetDistance = !store.started ? 88 : cinematic ? 46 : chase ? 8.5 + Math.min(speedAbs * 0.12, 3) : o.baseDistance + Math.min(speedAbs * 0.18, 4.5)
    if (store.started && o.intro < 1) {
      // Sinematik iniş: kamera yüksekten süzülerek arabanın arkasına iner (3,4 sn, yumuşak hızlanma/yavaşlama)
      if (o.intro === 0) o.introFrom = { distance: o.distance, polar: o.polar, azimuth: o.azimuth }
      o.intro = Math.min(o.intro + dt / 3.4, 1)
      const k = o.intro < 0.5 ? 4 * o.intro ** 3 : 1 - (-2 * o.intro + 2) ** 3 / 2
      const f = o.introFrom
      const turn = Math.atan2(Math.sin(CAMERA_HOME.azimuth - f.azimuth), Math.cos(CAMERA_HOME.azimuth - f.azimuth))
      o.distance = f.distance + (targetDistance - f.distance) * k
      o.polar = f.polar + (CAMERA_HOME.polar - f.polar) * k
      o.azimuth = f.azimuth + turn * k
      o.idle = 0
    } else {
      o.distance += (targetDistance - o.distance) * (1 - Math.exp(-(store.started ? 1.6 : 4) * dt))
    }
    const distance = o.distance * (state.size.width < state.size.height ? 1.5 : 1)
    const targetFov = 45 + Math.min(speedAbs / MAX_BOOST_SPEED, 1) * 7
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-3 * dt))
      camera.updateProjectionMatrix()
    }
    _camPos.set(
      lt.x + Math.sin(o.azimuth) * Math.sin(o.polar) * distance,
      lt.y + Math.cos(o.polar) * distance,
      lt.z + Math.cos(o.azimuth) * Math.sin(o.polar) * distance,
    )
    camera.position.lerp(_camPos, 1 - Math.exp(-5 * dt))
    // Çarpma sarsıntısı: kısa ve hızla sönen
    const sh = shake.current
    if (sh.amount > 0.001) {
      const k = sh.amount
      camera.position.x += (Math.random() - 0.5) * k
      camera.position.y += (Math.random() - 0.5) * k
      sh.amount *= Math.exp(-9 * dt)
    }
    camera.lookAt(lt.x, lt.y + 0.5, lt.z)
    // Kameranın yatay bakış yönü (GPS yön oku için)
    vehicleState.cameraYaw = Math.atan2(lt.x - camera.position.x, lt.z - camera.position.z)

    // Temas gölgesi: aracın altındaki zemine yumuşak bir leke
    if (blob.current) {
      const ground = heightAt(t.x, t.z)
      const h = Math.max(t.y - ground - 0.55, 0)
      blob.current.position.set(t.x, ground + 0.06, t.z)
      blob.current.rotation.set(-Math.PI / 2, 0, vehicleState.heading)
      const fade = Math.max(1 - h / 4, 0)
      blob.current.material.opacity = 0.5 * fade
      blob.current.scale.setScalar(1 + h * 0.15)
    }
  })

  return (
    <>
    <mesh ref={blob} renderOrder={1}>
      <planeGeometry args={[3.1, 1.9]} />
      <meshBasicMaterial map={getBlobTexture()} transparent depthWrite={false} opacity={0.5} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
    <RigidBody ref={body} name="vehicle" colliders={false} position={SPAWN.position} rotation={[0, SPAWN.yaw, 0]} canSleep={false} angularDamping={1.2} linearDamping={0.05} ccd>
      <CuboidCollider
        ref={collider}
        args={[1.25, 0.34, 0.6]}
        position={[0.07, 0.02, 0]}
        massProperties={MASS_PROPERTIES}
        friction={0.4}
        contactForceEventThreshold={260}
        onContactForce={(e) => {
          // Sert çarpışmada ses ve kamera sarsıntısı (zemin teması sayılmaz)
          const now = performance.now()
          const sh = shake.current
          if (now - sh.lastHit < 300) return
          const f = e.totalForceMagnitude
          const dir = e.maxForceDirection
          if (Math.abs(dir.y) > 0.8) return
          sh.lastHit = now
          sh.amount = Math.min(0.08 + f / 6000, 0.35)
          if (!useStore.getState().muted) playThud(Math.min(f / 900, 3))
        }}
      />
      <group ref={visual} />
      <group position={[0, MODEL_OFFSET_Y, 0]}>
        <primitive object={car.body} />
        {/* Stop lambaları */}
        {[-0.46, 0.46].map((z) => (
          <mesh key={z} position={[-1.235, 0.22, z]}>
            <boxGeometry args={[0.02, 0.07, 0.16]} />
            <meshStandardMaterial color="#ff2b2b" emissive="#ff2020" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Tekerlekler: dış grup süspansiyon + direksiyon, iç grup dönüş */}
      {[car.wheels['front left wheel'], car.wheels['front right wheel'], car.wheels['rear wheels']].map((wheel, i) => (
        <group key={i} ref={(el) => (wheelGroups.current[i] = el)}>
          <group>{wheel && <primitive object={wheel} />}</group>
        </group>
      ))}
      {/* Turbo alevi: egzoz ağzı (car.glb ölçülerinden) */}
      <TurboFlame position={[-1.2, -0.39, -0.03]} />
      {/* Far ışığı */}
      <primitive object={headlightTarget} position={[9, -1.2, 0]} />
      <spotLight ref={headlight} position={[1.3, 0.1, 0]} target={headlightTarget} angle={0.55} penumbra={0.6} distance={28} decay={1.4} color="#fff1cf" intensity={0} />
    </RigidBody>
    </>
  )
}

// Kenarları yumuşak oval gölge dokusu
let blobTexture = null
function getBlobTexture() {
  if (blobTexture) return blobTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  blobTexture = new THREE.CanvasTexture(canvas)
  return blobTexture
}

useGLTF.preload(CAR_URL)
