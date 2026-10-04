import * as THREE from 'three'

// Eğimli kenarlı (bevel) ExtrudeGeometry'de bazı dejenere üçgenler sıfır uzunlukta normal üretir.
// Shader'da normalize(vec3(0)) NaN verir ve Bloom bu tek pikseli tüm ekrana yayar.
// Bu yüzden sıfır normalleri üçgenin yüz normaliyle (ya da yukarı vektörüyle) değiştiriyoruz.
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()

export function sanitizeNormals(geometry) {
  const normal = geometry.attributes.normal
  const position = geometry.attributes.position
  if (!normal || !position) return geometry
  const index = geometry.index
  const faceOf = (i) => {
    // İndekssiz geometride üçgen = ardışık üç köşe
    const base = index ? null : i - (i % 3)
    if (base == null) return null
    _a.fromBufferAttribute(position, base)
    _b.fromBufferAttribute(position, base + 1)
    _c.fromBufferAttribute(position, base + 2)
    return _c.sub(_b).cross(_a.sub(_b))
  }
  for (let i = 0; i < normal.count; i++) {
    const x = normal.getX(i)
    const y = normal.getY(i)
    const z = normal.getZ(i)
    if (x * x + y * y + z * z > 1e-8 && Number.isFinite(x + y + z)) continue
    const face = faceOf(i)
    if (face && face.lengthSq() > 1e-12) {
      face.normalize()
      normal.setXYZ(i, face.x, face.y, face.z)
    } else {
      normal.setXYZ(i, 0, 0, 1)
    }
  }
  normal.needsUpdate = true
  return geometry
}

// Meshopt/quantization ile gelen öznitelikler normalize edilmiş tamsayıdır (ör. Int16, [-1, 1]).
// applyMatrix4 sonrası bu aralığın dışına çıkan değerler kırpılır; önce Float32'ye çeviriyoruz.
export function toFloatAttributes(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name]
    if (attr.array instanceof Float32Array && !attr.normalized && !attr.isInterleavedBufferAttribute) continue
    const out = new Float32Array(attr.count * attr.itemSize)
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c)
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize))
  }
  return geometry
}

// GLB parçasını dünya dönüşümüyle birlikte bağımsız bir geometriye çevirir
export function bakedGeometry(mesh) {
  const geometry = toFloatAttributes(mesh.geometry.clone())
  geometry.applyMatrix4(mesh.matrixWorld)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
