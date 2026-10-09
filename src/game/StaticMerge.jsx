import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Hareket etmeyen parçaları birleştirir: aynı malzemeli (ve aynı gölge ayarlı) alt nesneler tek bir
// geometriye dökülür ve tek çizim çağrısıyla çizilir. Özgün nesneler sahnede kalır ama gizlenir
// (çarpışma, ref ve React yönetimi bozulmaz). Grup bir bütün olarak hareket edebilir (ör. araç),
// ama içindeki parçalar birbirine göre sabit olmalıdır.
// Hariç: yazılar (troika), instanced/çoklu malzemeli nesneler, userData.noMerge olan dallar.
// Not: aynı özellikli ama ayrı malzeme nesneleri birleşir; kod tarafından tek tek değiştirilen
// malzemeler paylaşılan tek bir nesne olmalı (ör. gece yanan pencereler) ya da noMerge ile korunmalı.

const MERGEABLE = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial'])

function signature(material) {
  if (!MERGEABLE.has(material.type) || material.onBeforeCompile?.toString() !== THREE.Material.prototype.onBeforeCompile?.toString()) return material.uuid
  const m = material
  return [
    m.type,
    m.color?.getHex(),
    m.emissive?.getHex(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.map?.uuid,
    m.transparent,
    m.opacity,
    m.side,
    m.flatShading,
    m.toneMapped,
    m.depthWrite,
    m.polygonOffset,
    m.polygonOffsetFactor,
    m.vertexColors,
    m.clearcoat,
  ].join('|')
}

function normalized(geometry, matrix) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  g.applyMatrix4(matrix)
  // Ortak öznitelik kümesi: konum, normal, uv (eksikse sıfır uv)
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  g.morphAttributes = {}
  g.clearGroups()
  return g
}

export default function StaticMerge({ children, ...props }) {
  const root = useRef()
  useLayoutEffect(() => {
    const group = root.current
    if (!group) return
    group.updateMatrixWorld(true)
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert()
    const buckets = new Map()
    group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.text !== undefined || Array.isArray(o.material) || !o.geometry) return
      for (let p = o; p && p !== group; p = p.parent) if (p.userData.noMerge || !p.visible) return
      const key = `${signature(o.material)}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(o)
    })
    const added = []
    const hidden = []
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue
      const geometries = meshes.map((m) => normalized(m.geometry, new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld)))
      const merged = mergeGeometries(geometries, false)
      geometries.forEach((g) => g.dispose())
      if (!merged) continue
      merged.computeBoundingSphere()
      const first = meshes[0]
      const mesh = new THREE.Mesh(merged, first.material)
      mesh.castShadow = first.castShadow
      mesh.receiveShadow = first.receiveShadow
      mesh.renderOrder = first.renderOrder
      mesh.userData.merged = true
      group.add(mesh)
      added.push(mesh)
      for (const m of meshes) {
        m.visible = false
        hidden.push(m)
      }
    }
    return () => {
      for (const m of added) {
        group.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [])
  return (
    <group ref={root} {...props}>
      {children}
    </group>
  )
}
