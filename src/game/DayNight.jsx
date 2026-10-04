import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { skyColors, sunElevation, world } from './time.js'
import { vehicleState } from './input.js'
import { lampPlacements } from './scatter.js'
import { useStore } from '../store.js'

const _top = new THREE.Color()
const _horizon = new THREE.Color()
const _sunColor = new THREE.Color()
const _grey = new THREE.Color()
const WARM = new THREE.Color('#ffb070')
const NOON = new THREE.Color('#fff4e2')
const MOON = new THREE.Color('#9db4ff')

function SkyDome() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() },
      uNight: { value: 0 },
    }),
    [],
  )
  const mesh = useRef()
  useFrame(({ camera }) => {
    uniforms.uTop.value.copy(_top)
    uniforms.uHorizon.value.copy(_horizon)
    uniforms.uSunDir.value.copy(world.sunDir)
    uniforms.uNight.value = world.night
    mesh.current?.position.copy(camera.position)
  })
  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          uniform vec3 uSunDir;
          uniform float uNight;
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
            // Güneş parlaması
            float sd = max(dot(dir, uSunDir), 0.0);
            col += vec3(1.0, 0.82, 0.55) * pow(sd, 220.0) * 2.5 * (1.0 - uNight);
            col += vec3(1.0, 0.65, 0.4) * pow(sd, 8.0) * 0.25 * (1.0 - uNight);
            // Ay
            float md = max(dot(dir, -uSunDir), 0.0);
            col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9993, 0.9996, md) * uNight;
            col += vec3(0.5, 0.6, 0.9) * pow(md, 60.0) * 0.25 * uNight;
            // Yıldızlar
            vec3 cell = floor(dir * 180.0);
            float star = step(0.9965, hash(cell)) * smoothstep(0.05, 0.3, dir.y);
            col += vec3(star) * uNight * 0.9;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// Gece en yakın lambalarda gerçek ışık: 4 ışıklık havuz, aracın etrafındaki lambalara taşınır
function LampLights() {
  const lights = useRef([])
  const lamps = useMemo(() => lampPlacements().map((l) => l.bulb.clone().setY(l.bulb.y - 0.25)), [])
  useFrame(() => {
    const { x, z } = vehicleState.position
    const sorted = [...lamps].sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2))
    lights.current.forEach((light, i) => {
      if (!light) return
      light.position.copy(sorted[i])
      light.intensity = world.night * 12
      light.visible = world.night > 0.02
    })
  })
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <pointLight key={i} ref={(el) => (lights.current[i] = el)} color="#ffc98a" distance={16} decay={1.6} intensity={0} />
      ))}
    </>
  )
}

export default function DayNight({ shadows = true }) {
  const sun = useRef()
  const hemi = useRef()
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)

  // Yerel ortam haritası: metal ve parlak yüzeyler siyah görünmez, dış dosya gerekmez
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  const lastNight = useRef(null)
  const lastRequest = useRef(null)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    world.uniforms.uTime.value += dt
    const request = useStore.getState().timeRequest
    if (request && request.id !== lastRequest.current) {
      lastRequest.current = request.id
      world.target = request.target
    }

    // Zaman ilerlemesi ya da hedef saate yumuşak geçiş
    if (world.target != null) {
      let diff = world.target - world.time
      if (diff < 0) diff += 1
      const step = Math.min(diff, dt * 0.28)
      world.time = (world.time + step) % 1
      if (diff < 0.002) world.target = null
    } else {
      world.time = (world.time + dt * world.speed) % 1
    }

    const t = world.time
    const elevation = sunElevation(t)
    const azimuth = t * Math.PI * 2
    world.sunDir.set(Math.cos(azimuth) * 0.8, elevation, Math.sin(azimuth) * 0.6 + 0.35).normalize()
    world.night = 1 - THREE.MathUtils.smoothstep(elevation, -0.12, 0.12)

    skyColors(t, _top, _horizon)
    // Kötü havada gökyüzü griye döner, şimşekte bir anlığına aydınlanır
    const overcast = Math.max(world.wet, world.snowy * 0.7)
    _top.lerp(_grey.setRGB(0.32, 0.35, 0.4), overcast * 0.7)
    _horizon.lerp(_grey.setRGB(0.55, 0.58, 0.62), overcast * 0.6)
    if (world.flash > 0) {
      _top.lerp(_grey.setRGB(0.85, 0.88, 1), world.flash * 0.6)
      _horizon.lerp(_grey.setRGB(0.9, 0.92, 1), world.flash * 0.5)
    }
    if (scene.fog) {
      scene.fog.color.copy(_horizon).lerp(_top, 0.25)
      scene.fog.near = THREE.MathUtils.lerp(70, 25, overcast)
      scene.fog.far = THREE.MathUtils.lerp(230, 120, overcast)
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(0.4, 0.08, world.night)

    // Gündüz güneş, gece ay ışığı (aynı ışık, yön ve renk değişir)
    const light = sun.current
    if (light) {
      const isMoon = world.night > 0.5
      const dir = isMoon ? world.sunDir.clone().negate() : world.sunDir
      // Gölge kamerasını gölge haritası pikseline hizala: araç hareket ederken gölgeler kaymaz/titremez
      const texel = 64 / 2048
      const x = Math.round(vehicleState.position.x / texel) * texel
      const z = Math.round(vehicleState.position.z / texel) * texel
      light.position.set(x + dir.x * 40, Math.max(dir.y, 0.25) * 45, z + dir.z * 40)
      light.target.position.set(x, 0, z)
      light.target.updateMatrixWorld()
      if (isMoon) {
        light.color.copy(MOON)
        light.intensity = 0.55 * world.night
      } else {
        _sunColor.copy(WARM).lerp(NOON, THREE.MathUtils.clamp(elevation * 2.2, 0, 1))
        light.color.copy(_sunColor)
        light.intensity = 3.0 * THREE.MathUtils.clamp(elevation * 3 + 0.15, 0, 1) * (1 - overcast * 0.6)
      }
    }
    if (hemi.current) {
      hemi.current.color.copy(_top).lerp(NOON, 0.55)
      hemi.current.groundColor.set('#5b7a45').multiplyScalar(1 - world.night * 0.75)
      hemi.current.intensity = THREE.MathUtils.lerp(0.85, 0.4, world.night) * (1 - overcast * 0.2) + world.flash * 2.2
    }

    const isNight = world.night > 0.5
    if (isNight !== lastNight.current) {
      lastNight.current = isNight
      useStore.getState().setNight(isNight)
    }
  })

  return (
    <>
      <SkyDome />
      <hemisphereLight ref={hemi} args={['#e6f4ff', '#5b7a45', 1.1]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <LampLights />
    </>
  )
}
