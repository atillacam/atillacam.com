import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { siGithub, siInstagram } from 'simple-icons'
import { profile, skillCubes } from '../content.js'
import { AREAS, COLORS, MAILBOX, PROJECT_BOARDS, SOCIAL_PEDESTALS } from './layout.js'
import { fontBlack, fontBold, fontRegular } from './fonts.js'
import { useT } from '../i18n.js'
import { sanitizeNormals } from './geometry.js'

// LinkedIn logosu simple-icons'tan kaldırıldığı için yolu burada tutuyoruz (24×24)
const LINKEDIN_PATH =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

const ICON_PATHS = {
  github: siGithub.path,
  linkedin: LINKEDIN_PATH,
  instagram: siInstagram.path,
}

// ---------- Projeler ----------
function ProjectBoard({ project, position }) {
  const { L } = useT()
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.4, 2.6, 0.3]} position={[0, 3.7, 0]} />
        <CylinderCollider args={[1.15, 0.2]} position={[-3, 1.15, 0]} />
        <CylinderCollider args={[1.15, 0.2]} position={[3, 1.15, 0]} />
      </RigidBody>
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 2.3, 10]} />
          <meshStandardMaterial color={COLORS.ink} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <RoundedBox args={[8.8, 5.2, 0.4]} radius={0.16} smoothness={3} position={[0, 3.7, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.ink} roughness={0.55} />
      </RoundedBox>
      {/* Renkli üst şerit */}
      <mesh position={[0, 6.18, 0.21]}>
        <planeGeometry args={[8.4, 0.12]} />
        <meshStandardMaterial color={project.color} emissive={project.color} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <group position={[-3.9, 5.75, 0.22]}>
        <Text font={fontBold} fontSize={0.28} color={project.color} anchorX="left" anchorY="top" letterSpacing={0.12}>
          {`${project.year}  ·  GITHUB`}
        </Text>
        <Text font={fontBlack} fontSize={0.56} lineHeight={1.05} color={COLORS.cream} anchorX="left" anchorY="top" position={[0, -0.45, 0]} maxWidth={7.8}>
          {L(project.title)}
        </Text>
        <Text font={fontRegular} fontSize={0.28} lineHeight={1.4} color="#c3c9da" anchorX="left" anchorY="top" position={[0, -1.85, 0]} maxWidth={7.8}>
          {L(project.summary)}
        </Text>
        <Text font={fontBold} fontSize={0.25} color={project.color} anchorX="left" anchorY="top" position={[0, -3.55, 0]}>
          {project.tags.join('   ·   ')}
        </Text>
      </group>
    </group>
  )
}

// ---------- Hakkımda ----------
function AboutStand() {
  const { t, L, lang } = useT()
  const area = AREAS.find((a) => a.id === 'about')
  const [cx, , cz] = area.center
  return (
    <group>
      <group position={[cx, 0, cz - 13]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[4.6, 3.2, 0.35]} position={[0, 3.4, 0]} />
        </RigidBody>
        <RoundedBox args={[9.2, 6.4, 0.5]} radius={0.2} smoothness={3} position={[0, 3.4, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={COLORS.ink} roughness={0.55} />
        </RoundedBox>
        <mesh position={[0, 6.48, 0.26]}>
          <planeGeometry args={[8.8, 0.12]} />
          <meshStandardMaterial color={COLORS.teal} emissive={COLORS.teal} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <group position={[-4.1, 6.1, 0.27]}>
          <Text font={fontBold} fontSize={0.3} color={COLORS.teal} anchorX="left" anchorY="top" letterSpacing={0.14}>
            {t('about').toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
          </Text>
          <Text font={fontBlack} fontSize={0.82} color={COLORS.cream} anchorX="left" anchorY="top" position={[0, -0.45, 0]}>
            {profile.name}
          </Text>
          <Text font={fontBold} fontSize={0.36} color={COLORS.amber} anchorX="left" anchorY="top" position={[0, -1.45, 0]}>
            {`${L(profile.title)} · ${L(profile.location)}`}
          </Text>
          <Text font={fontRegular} fontSize={0.3} lineHeight={1.45} color="#c3c9da" anchorX="left" anchorY="top" position={[0, -2.1, 0]} maxWidth={8.2}>
            {L(profile.about)[0]}
          </Text>
          {profile.available && (
            <Text font={fontBold} fontSize={0.3} color="#5ee0a0" anchorX="left" anchorY="top" position={[0, -5.1, 0]}>
              {`●  ${t('openToWork')}`}
            </Text>
          )}
        </group>
      </group>
      <SkillCubes origin={[cx + 7, 0, cz + 7]} />
    </group>
  )
}

function SkillCubes({ origin }) {
  const size = 1.3
  const colors = [COLORS.blue, COLORS.amber, COLORS.teal, COLORS.coral]
  const slots = []
  let index = 0
  for (let row = 0; row < 4 && index < skillCubes.length; row++) {
    const count = 4 - row
    for (let i = 0; i < count && index < skillCubes.length; i++) {
      slots.push({ label: skillCubes[index], x: (i - (count - 1) / 2) * (size + 0.05), y: size / 2 + row * size, color: colors[index % 4] })
      index++
    }
  }
  return (
    <group position={origin}>
      {slots.map((s) => (
        <RigidBody key={s.label} colliders={false} position={[s.x, s.y + 0.01, 0]} friction={0.7}>
          <CuboidCollider args={[size / 2, size / 2, size / 2]} mass={0.8} />
          <RoundedBox args={[size, size, size]} radius={0.08} smoothness={2} castShadow receiveShadow>
            <meshStandardMaterial color={s.color} roughness={0.45} />
          </RoundedBox>
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ry) => (
            <Text
              key={ry}
              font={fontBlack}
              fontSize={s.label.length > 5 ? 0.22 : 0.3}
              color="#ffffff"
              rotation={[0, ry, 0]}
              position={[Math.sin(ry) * (size / 2 + 0.01), 0, Math.cos(ry) * (size / 2 + 0.01)]}
              anchorX="center"
              anchorY="middle"
            >
              {s.label}
            </Text>
          ))}
        </RigidBody>
      ))}
    </group>
  )
}

// ---------- İletişim ----------
function Mailbox() {
  const { t } = useT()
  return (
    <group position={MAILBOX.position} rotation={[0, MAILBOX.rotation, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 1.3, 1.1]} position={[0, 3.3, 0]} />
        <CylinderCollider args={[1, 0.2]} position={[0, 1, 0]} />
      </RigidBody>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 2, 10]} />
        <meshStandardMaterial color={COLORS.ink} metalness={0.4} roughness={0.5} />
      </mesh>
      <RoundedBox args={[3.2, 2.2, 2.2]} radius={0.3} smoothness={3} position={[0, 3.1, 0]} castShadow>
        <meshStandardMaterial color={COLORS.blue} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 4.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 3.2, 28, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={COLORS.blue} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.65, 1.12]}>
        <boxGeometry args={[1.8, 0.14, 0.02]} />
        <meshStandardMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[1.75, 4.2, 0.6]} castShadow>
        <boxGeometry args={[0.12, 1.8, 0.12]} />
        <meshStandardMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[1.75, 4.9, 0.95]}>
        <boxGeometry args={[0.06, 0.5, 0.65]} />
        <meshStandardMaterial color={COLORS.coral} />
      </mesh>
      <Text font={fontBlack} fontSize={0.3} color={COLORS.cream} position={[0, 2.85, 1.12]} anchorX="center">
        {t('sayHello')}
      </Text>
      <Text font={fontBold} fontSize={0.17} color="#dce6ff" position={[0, 2.5, 1.12]} anchorX="center">
        {profile.email}
      </Text>
    </group>
  )
}

// SVG yolundan kalın, eğimli kenarlı 3D logo
function flipWinding(geometry) {
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of [pos, uv]) {
      if (!attr) continue
      for (let c = 0; c < attr.itemSize; c++) {
        const a = attr.array[(i + 1) * attr.itemSize + c]
        attr.array[(i + 1) * attr.itemSize + c] = attr.array[(i + 2) * attr.itemSize + c]
        attr.array[(i + 2) * attr.itemSize + c] = a
      }
    }
  }
}

function useLogoGeometry(id) {
  return useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ICON_PATHS[id]}"/></svg>`
    const data = new SVGLoader().parse(svg)
    const shapes = data.paths.flatMap((p) => p.toShapes())
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.25, bevelSegments: 3, curveSegments: 14 })
    // SVG'de y aşağı doğru; yansıt ve yüz yönünü düzelt
    geometry.scale(1, -1, 1)
    flipWinding(geometry)
    geometry.center()
    geometry.scale(0.11, 0.11, 0.11)
    geometry.computeVertexNormals()
    sanitizeNormals(geometry)

    if (id === 'instagram') {
      // Instagram renk geçişi: sol alt sarı → turuncu → pembe → sağ üst mor
      const stops = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'].map((c) => new THREE.Color(c))
      const pos = geometry.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const c = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        const k = THREE.MathUtils.clamp((pos.getX(i) + pos.getY(i)) / 2.7 + 0.5, 0, 0.999) * (stops.length - 1)
        const j = Math.floor(k)
        c.copy(stops[j]).lerp(stops[j + 1], k - j)
        colors.set([c.r, c.g, c.b], i * 3)
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    return geometry
  }, [id])
}

const LOGO_COLORS = { github: '#f0f6fc', linkedin: '#0a66c2', instagram: '#ffffff' }

function SocialPedestal({ social, position, index }) {
  const geometry = useLogoGeometry(social.id)
  const logo = useRef()
  useFrame((state) => {
    if (!logo.current) return
    const t = state.clock.elapsedTime + index * 1.3
    logo.current.rotation.y = Math.sin(t * 0.8) * 0.5
    logo.current.position.y = 3.1 + Math.sin(t * 1.6) * 0.12
  })
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.7, 1.1]} position={[0, 0.7, 0]} />
      </RigidBody>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.2, 1.4, 32]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <torusGeometry args={[1.0, 0.04, 8, 48]} />
        <meshStandardMaterial color={LOGO_COLORS[social.id] === '#ffffff' ? '#e1306c' : LOGO_COLORS[social.id]} emissive={social.id === 'instagram' ? '#e1306c' : LOGO_COLORS[social.id]} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <group ref={logo} position={[0, 3.1, 0]}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial color={LOGO_COLORS[social.id]} vertexColors={social.id === 'instagram'} roughness={0.3} metalness={0.15} />
        </mesh>
      </group>
      <Text font={fontBold} fontSize={0.28} color={COLORS.cream} position={[0, 0.75, 1.21]} anchorX="center" anchorY="middle">
        {social.handle}
      </Text>
    </group>
  )
}

// ---------- Merkez tabela ----------
function Signpost({ position }) {
  const { t } = useT()
  const signs = [
    { label: t('areaProjects'), rotation: Math.PI / 2, color: COLORS.amber, y: 2.6 },
    { label: t('areaAbout'), rotation: 0, color: COLORS.teal, y: 2.1 },
    { label: t('areaContact'), rotation: Math.PI, color: COLORS.violet, y: 1.6 },
    { label: t('areaPlayground'), rotation: -Math.PI / 2, color: COLORS.coral, y: 1.1 },
  ]
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.5, 0.15]} position={[0, 1.5, 0]} />
      </RigidBody>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 3, 8]} />
        <meshStandardMaterial color={COLORS.ink} metalness={0.4} roughness={0.5} />
      </mesh>
      {signs.map((s) => (
        <group key={s.rotation} position={[0, s.y, 0]} rotation={[0, s.rotation, 0]}>
          <mesh position={[1.05, 0, 0]} castShadow>
            <boxGeometry args={[1.9, 0.4, 0.08]} />
            <meshStandardMaterial color={s.color} />
          </mesh>
          {[0.05, -0.05].map((z, i) => (
            <Text key={z} font={fontBold} fontSize={0.2} color={COLORS.ink} position={[1.05, 0, z]} rotation={[0, i ? Math.PI : 0, 0]} anchorX="center" anchorY="middle">
              {s.label}
            </Text>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- Emeği geçenler tabelası ----------
function CreditsSign() {
  const { t } = useT()
  // Göl yolunun kenarında (yolu kapatmadan)
  return (
    <group position={[-21, 0, 14]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.9, 0.15]} position={[0, 1.4, 0]} />
      </RigidBody>
      <RoundedBox args={[2.6, 1.5, 0.16]} radius={0.06} smoothness={2} position={[0, 1.55, 0]} castShadow>
        <meshStandardMaterial color="#6b4a33" roughness={0.9} />
      </RoundedBox>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} castShadow>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color="#5a3d2a" />
        </mesh>
      ))}
      <Text font={fontBlack} fontSize={0.24} color={COLORS.cream} position={[0, 1.62, 0.09]} anchorX="center" anchorY="middle" maxWidth={2.3} textAlign="center">
        {t('credits')}
      </Text>
      <Text font={fontRegular} fontSize={0.14} color="#e8dccb" position={[0, 1.3, 0.09]} anchorX="center" anchorY="middle">
        CC BY 4.0
      </Text>
    </group>
  )
}

export default function Landmarks() {
  return (
    <>
      {PROJECT_BOARDS.map(({ project, position }) => (
        <ProjectBoard key={project.id} project={project} position={position} />
      ))}
      <AboutStand />
      <Mailbox />
      {SOCIAL_PEDESTALS.map(({ social, position }, i) => (
        <SocialPedestal key={social.id} social={social} position={position} index={i} />
      ))}
      <Signpost position={[5.5, 0, 2]} />
      <CreditsSign />
    </>
  )
}
