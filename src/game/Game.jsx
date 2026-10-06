import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Physics, useRapier } from '@react-three/rapier'
import { useProgress } from '@react-three/drei'
import * as THREE from 'three'
import DayNight from './DayNight.jsx'
import Terrain from './Terrain.jsx'
import Vegetation from './Vegetation.jsx'
import Grass from './Grass.jsx'
import Letters from './Letters.jsx'
import Landmarks from './Landmarks.jsx'
import Playground from './Playground.jsx'
import Spots from './Spots.jsx'
import Race from './Race.jsx'
import Collectibles from './Collectibles.jsx'
import HiddenLogos from './HiddenLogos.jsx'
import Istanbul from './Istanbul.jsx'
import Traffic from './Traffic.jsx'
import Zones from './Zones.jsx'
import Bowling from './Bowling.jsx'
import Showcase from './Showcase.jsx'
import Dust from './Dust.jsx'
import Skids from './Skids.jsx'
import Ripples from './Ripples.jsx'
import Atmosphere from './Atmosphere.jsx'
import Weather from './Weather.jsx'
import Seasons from './Seasons.jsx'
import NightSky from './NightSky.jsx'
import Ghost from './Ghost.jsx'
import Stunt from './Stunt.jsx'
import MiniGolf from './MiniGolf.jsx'
import Breakables from './Breakables.jsx'
import Helicopter from './Helicopter.jsx'
import RouteLine from './RouteLine.jsx'
import Life from './Life.jsx'
import Whispers from './Whispers.jsx'
import Vehicle from './Vehicle.jsx'
import Effects from './Effects.jsx'
import { AutoQuality, FrameDriver } from './Performance.jsx'
import { bindKeyboard, input, vehicleState } from './input.js'
import { world } from './time.js'
import { useStore } from '../store.js'

// Geliştirme sırasında konsoldan fizik dünyasını sorgulamak için
function PhysicsDebugHandle() {
  const { world, rapier } = useRapier()
  useEffect(() => {
    if (import.meta.env.DEV) window.__portfolio = Object.assign(window.__portfolio ?? {}, { physicsWorld: world, rapier })
  }, [world, rapier])
  return null
}

function DebugHandle() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (import.meta.env.DEV) window.__portfolio = Object.assign(window.__portfolio ?? {}, { scene, gl, camera, THREE })
  }, [scene, gl, camera])
  return null
}

function ReadySignal() {
  useEffect(() => {
    // İlk kare çizildikten sonra hazır de
    const id = requestAnimationFrame(() => requestAnimationFrame(() => useStore.getState().setReady()))
    return () => cancelAnimationFrame(id)
  }, [])
  return null
}

// Yükleme yüzdesini giriş ekranına bildir
function ProgressReporter() {
  const progress = useProgress((s) => s.progress)
  useEffect(() => useStore.getState().setLoadProgress(progress), [progress])
  return null
}

export default function Game() {
  const paused = useStore((s) => !!s.modal)
  const quality = useStore((s) => s.quality)
  const high = quality === 'high'

  useEffect(() => bindKeyboard(), [])

  // Geliştirme sırasında konsoldan test edebilmek için
  useEffect(() => {
    if (import.meta.env.DEV) window.__portfolio = Object.assign(window.__portfolio ?? {}, { input, vehicleState, store: useStore, world })
  }, [])

  return (
    <>
    <ProgressReporter />
    <Canvas
      shadows={high ? 'percentage' : false}
      dpr={high ? [1, 1.75] : [0.75, 1.25]}
      frameloop="never"
      camera={{ position: [12, 16, 30], fov: 45, near: 0.3, far: 600 }}
      gl={{ antialias: !high, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      aria-label="3D portfolyo dünyası"
    >
      <FrameDriver />
      {!paused && <AutoQuality key={quality} min={high ? 1 : 0.75} max={high ? 1.75 : 1.25} />}
      <fog attach="fog" args={['#bfe2f4', 70, 230]} />
      <DayNight shadows={high} />
      <Suspense fallback={null}>
        {/* Fizik her karede ilk sırada çalışır; kamera ve efektler enterpolasyonlu konumu okur */}
        <Physics timeStep={1 / 60} paused={paused} updatePriority={-10}>
          <Terrain />
          <Vegetation quality={quality} />
          <Letters />
          <Landmarks />
          <Playground />
          <Spots />
          <Race />
          <Collectibles />
          <HiddenLogos />
          <Istanbul />
          <Traffic />
          <Zones />
          <Bowling />
          <Showcase />
          <NightSky />
          <Stunt />
          <MiniGolf />
          <Breakables />
          <Vehicle />
          <PhysicsDebugHandle />
        </Physics>
        <Grass count={high ? 115000 : 28000} />
        <Dust />
        <Skids />
        <Ripples />
        <Ghost />
        <Helicopter />
        <Atmosphere />
        <Seasons />
        <Weather />
        <RouteLine />
        <Life />
        <Whispers />
        {high && <Effects />}
        <ReadySignal />
        <DebugHandle />
      </Suspense>
    </Canvas>
    </>
  )
}
