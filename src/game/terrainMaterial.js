import * as THREE from 'three'
import { fbm } from './terrain.js'
import { world } from './time.js'

// Kod içinde üretilen detay dokuları: çimen dokusu ve kaya dokusu (gri tonlu, tekrarlanabilir)
function noiseTexture(size, scale, octaves, streak = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Kenarların tekrarı dikişsiz olsun diye iki örneği karıştır
      const u = x / size
      const v = y / size
      const a = fbm(x * scale, y * scale * (1 + streak), octaves)
      const b = fbm((x - size) * scale, y * scale * (1 + streak), octaves)
      const c = fbm(x * scale, (y - size) * scale * (1 + streak), octaves)
      const d = fbm((x - size) * scale, (y - size) * scale * (1 + streak), octaves)
      const n = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
      const k = Math.max(0, Math.min(255, Math.round(n * 255)))
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// Arazi malzemesi: köşe renklerinin üstüne iki ölçekli çimen detayı ve eğime göre kaya
export function createTerrainMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  const grass = noiseTexture(256, 0.09, 4, 1.5)
  const rock = noiseTexture(256, 0.05, 5)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grass }
    shader.uniforms.uRock = { value: rock }
    shader.uniforms.uSeason = world.uniforms.uSeason
    shader.uniforms.uSnow = world.uniforms.uSnow
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;\nvarying vec3 vTerrainNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainNormal = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGrass;\nuniform sampler2D uRock;\nuniform vec4 uSeason;\nuniform float uSnow;\nvarying vec3 vTerrainWorld;\nvarying vec3 vTerrainNormal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vTerrainWorld.xz;
          // Mevsim: yalnızca çimenli (yeşil) zemin renk değiştirir; yol, kum ve toprak aynı kalır
          vec3 c0 = diffuseColor.rgb;
          float green = smoothstep(0.0, 0.06, c0.g - max(c0.r, c0.b));
          float lum0 = dot(c0, vec3(0.333));
          vec3 seasonal = c0 * vec3(0.95, 1.08, 0.92) * uSeason.x + c0 * uSeason.y
            + c0 * vec3(1.2, 0.96, 0.6) * uSeason.z + mix(c0, vec3(lum0), 0.45) * vec3(0.92, 0.96, 1.02) * uSeason.w;
          diffuseColor.rgb = mix(c0, seasonal, green);
          float fine = texture2D(uGrass, p * 0.32).r;
          float broad = texture2D(uGrass, p * 0.045).r;
          diffuseColor.rgb *= mix(0.8, 1.14, fine) * mix(0.88, 1.1, broad);
          // Dik yamaçlarda kaya
          float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
          float r = texture2D(uRock, p * 0.12).r;
          vec3 rockColor = vec3(0.46, 0.44, 0.40) * (0.75 + r * 0.55);
          diffuseColor.rgb = mix(diffuseColor.rgb, rockColor, smoothstep(0.22, 0.42, slope + (r - 0.5) * 0.12));
          // Kar örtüsü: düz yerlerde yoğun, dik yamaçta ve yollarda ince; kenarları gürültülü
          float flatness = 1.0 - smoothstep(0.16, 0.4, slope);
          float patchy = texture2D(uGrass, p * 0.021).r;
          float snow = smoothstep(0.0, 0.22, uSnow * 1.3 - (1.0 - flatness) * 0.9 - patchy * 0.35);
          snow *= mix(0.55, 1.0, green);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97) * (0.93 + fine * 0.08), snow);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'terrain-detail-season'
  return material
}
