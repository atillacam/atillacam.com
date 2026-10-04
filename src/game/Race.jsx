import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import { COLORS, RACE, RACE_START, RING_WIDTH, ringPoint } from './layout.js'
import { fontBlack } from './fonts.js'
import { teleport } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { formatTime } from '../format.js'
import { playCheckpoint, playChime, playCountdown } from '../audio.js'

const isVehicle = (payload) => payload.other.rigidBodyObject?.name === 'vehicle'

function Gate({ index, angle }) {
  const [x, z] = ringPoint(angle)
  const yaw = -angle // kapının yerel x ekseni yarıçap yönünde
  const half = RING_WIDTH / 2 + 0.9
  const banner = useRef()
  const isStart = index === 0
  const lang = useStore((s) => s.lang)

  useFrame((state) => {
    const { race } = useStore.getState()
    const isNext = race.active && (race.next === index || (index === 0 && race.next === RACE.checkpoints))
    if (banner.current) {
      banner.current.emissiveIntensity = isNext ? 1.2 + Math.sin(state.clock.elapsedTime * 8) * 0.5 : isStart ? 0.25 : 0.05
    }
  })

  const onEnter = (p) => {
    if (!isVehicle(p)) return
    const store = useStore.getState()
    const { race } = store
    if (!race.active) return
    if (index === 0) {
      if (race.next === RACE.checkpoints) {
        const ms = store.finishRace()
        if (!store.muted) playChime()
        store.toast(translate('raceFinished', store.lang), `${translate('raceTime', store.lang)}: ${formatTime(ms)}`)
      }
      return
    }
    if (race.next === index) {
      store.passCheckpoint(index)
      if (!store.muted) playCheckpoint()
    }
  }

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[half, 2, 0.4]} position={[0, 2, 0]} onIntersectionEnter={onEnter} />
        <CylinderCollider args={[2.2, 0.22]} position={[-half - 0.2, 2.2, 0]} />
        <CylinderCollider args={[2.2, 0.22]} position={[half + 0.2, 2.2, 0]} />
      </RigidBody>
      {[-half - 0.2, half + 0.2].map((px) => (
        <mesh key={px} position={[px, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 4.4, 10]} />
          <meshStandardMaterial color={COLORS.ink} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 4.35, 0]} castShadow>
        <boxGeometry args={[half * 2 + 0.8, 0.9, 0.2]} />
        <meshStandardMaterial ref={banner} color={isStart ? COLORS.cream : COLORS.amber} emissive={isStart ? '#ffffff' : COLORS.amber} emissiveIntensity={0.05} />
      </mesh>
      {[0.11, -0.11].map((zz, i) => (
        <Text
          key={zz}
          font={fontBlack}
          fontSize={0.5}
          color={COLORS.ink}
          position={[0, 4.35, zz]}
          rotation={[0, i ? Math.PI : 0, 0]}
          anchorX="center"
          anchorY="middle"
        >
          {isStart ? (lang === 'tr' ? 'START / BİTİŞ' : 'START / FINISH') : `${index} / ${RACE.checkpoints - 1}`}
        </Text>
      ))}
      {isStart && <StartLine half={RING_WIDTH / 2} />}
    </group>
  )
}

function StartLine({ half }) {
  // Dama desenli başlangıç çizgisi
  const squares = useMemo(() => {
    const list = []
    const size = 0.5
    const cols = Math.floor((half * 2) / size)
    for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) list.push({ x: -half + size / 2 + c * size, z: (r - 0.5) * size, dark: (c + r) % 2 === 0 })
    return list
  }, [half])
  return squares.map((s, i) => (
    <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.055, s.z]}>
      <planeGeometry args={[0.5, 0.5]} />
      <meshStandardMaterial color={s.dark ? '#16181f' : '#f4f1ea'} roughness={0.9} />
    </mesh>
  ))
}

// Geri sayım ve yarış kontrolü
function RaceController() {
  const requested = useStore((s) => s.race.requested)
  const timer = useRef()

  useEffect(() => {
    if (!requested) return
    const store = useStore.getState()
    teleport(RACE_START.position, RACE_START.yaw)
    store.closeAll()
    let n = 3
    if (!store.muted) playCountdown()
    timer.current = setInterval(() => {
      n -= 1
      const s = useStore.getState()
      if (n > 0) {
        s.setCountdown(n)
        if (!s.muted) playCountdown()
      } else {
        clearInterval(timer.current)
        s.beginRace()
        if (!s.muted) playCountdown(true)
      }
    }, 900)
    return () => clearInterval(timer.current)
  }, [requested])

  // Çok uzun süren ya da harita ile terk edilen yarışı iptal et
  useFrame(() => {
    const { race, cancelRace } = useStore.getState()
    if (race.active && performance.now() - race.start > 4 * 60 * 1000) cancelRace()
  })
  return null
}

export default function Race() {
  const gates = useMemo(() => Array.from({ length: RACE.checkpoints }, (_, i) => RACE.startAngle + (i / RACE.checkpoints) * Math.PI * 2), [])
  return (
    <>
      {gates.map((angle, i) => (
        <Gate key={i} index={i} angle={angle} />
      ))}
      <RaceController />
    </>
  )
}
