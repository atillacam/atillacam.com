import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'

// Yüksek kalite: MSAA kenar yumuşatma + hafif vinyet + ACES ton eşleme.
// Not: Bloom bazı GPU/tarayıcı ortamlarında tüm kareyi siyaha çevirdiği için kullanılmıyor;
// gece ışıkları bunun yerine Halo sprite'larıyla parlıyor (bkz. Vegetation.jsx).
export default function Effects() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    const c = new EffectComposer(gl, target)
    c.addPass(new RenderPass(scene, camera))
    const vignette = new ShaderPass(VignetteShader)
    vignette.uniforms.offset.value = 0.95
    vignette.uniforms.darkness.value = 1.15
    c.addPass(vignette)
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
  }, [composer, gl, size])

  useEffect(() => () => composer.dispose(), [composer])

  // Öncelik > 0: R3F kendi çizimini bırakır, kareyi composer çizer
  useFrame((_, delta) => composer.render(delta), 1)
  return null
}
