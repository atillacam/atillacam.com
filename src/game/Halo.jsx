import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './time.js'

// Yumuşak ışık halesi: gece görünür, her zaman kameraya döner
let haloTexture = null
function getHaloTexture() {
  if (haloTexture) return haloTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,236,200,1)')
  g.addColorStop(0.25, 'rgba(255,200,120,0.55)')
  g.addColorStop(1, 'rgba(255,170,80,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  haloTexture = new THREE.CanvasTexture(canvas)
  haloTexture.colorSpace = THREE.SRGBColorSpace
  return haloTexture
}

export default function Halo({ position, scale = 2.6, color = '#ffffff', dayOpacity = 0 }) {
  const sprite = useRef()
  useFrame(() => {
    if (sprite.current) sprite.current.material.opacity = dayOpacity + world.night * (1 - dayOpacity) * 0.9
  })
  return (
    <sprite ref={sprite} position={position} scale={scale}>
      <spriteMaterial map={getHaloTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} fog={false} />
    </sprite>
  )
}

