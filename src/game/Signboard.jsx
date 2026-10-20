import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { RoundedBox } from '@react-three/drei'
import { Text } from './Text.jsx'
import { fontBlack, fontBold } from './fonts.js'
import StaticMerge from './StaticMerge.jsx'

// Ortak tabela: fırçalanmış metal çerçeve, koyu lacivert yüz, üstte ışıklı renk şeridi, başlık ve alt başlık.
// mount 'posts': iki direkli ayaklı tabela (position = zemin), 'wall': duvara/havaya asılı pano (position = pano merkezi).
// Parçalar birleştirilerek çizilir (StaticMerge); yazılar troika ile tek çağrı.
const FACE = '#121829'
const FRAME = '#c9ced6'

export default function Signboard({ position, rotation = 0, title, subtitle, accent = '#5b6cff', size = 1, mount = 'posts', postHeight = 2.4, dual = false }) {
  const titleSize = 0.62 * size
  const subSize = 0.27 * size
  // Genişlik yazıdan tahmin edilir (Nunito Black ~0.62 em/harf)
  const width = Math.max(title.length * titleSize * 0.66, (subtitle?.length ?? 0) * subSize * 0.58) + 1.1 * size
  const height = (subtitle ? 1.5 : 1.05) * size
  const panelY = mount === 'posts' ? postHeight + height / 2 : 0
  const textBlock = (side) => (
    <group position={[0, panelY, side * 0.1 * size]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
      <Text font={fontBlack} fontSize={titleSize} color="#ffffff" position={[0, subtitle ? 0.2 * size : -0.02 * size, 0]} anchorX="center" anchorY="middle" letterSpacing={0.02}>
        {title}
      </Text>
      {subtitle && (
        <Text font={fontBold} fontSize={subSize} color="#b9c3dc" position={[0, -0.36 * size, 0]} anchorX="center" anchorY="middle" letterSpacing={0.04}>
          {subtitle}
        </Text>
      )}
    </group>
  )
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {mount === 'posts' && (
        <RigidBody type="fixed" colliders={false}>
          {[-1, 1].map((s) => (
            <CylinderCollider key={s} args={[postHeight / 2, 0.12 * size]} position={[s * (width / 2 - 0.35 * size), postHeight / 2, 0]} />
          ))}
        </RigidBody>
      )}
      <StaticMerge>
        {mount === 'posts' &&
          [-1, 1].map((s) => (
            <group key={s} position={[s * (width / 2 - 0.35 * size), 0, 0]}>
              <mesh position={[0, (postHeight + height) / 2, 0]} castShadow>
                <cylinderGeometry args={[0.09 * size, 0.11 * size, postHeight + height, 10]} />
                <meshStandardMaterial color="#5d6573" metalness={0.7} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.22 * size, 0.26 * size, 0.24, 12]} />
                <meshStandardMaterial color="#9aa1ad" roughness={0.8} />
              </mesh>
            </group>
          ))}
        {/* Çerçeve, yüz ve ışıklı üst şerit */}
        <RoundedBox args={[width + 0.16 * size, height + 0.16 * size, 0.14 * size]} radius={0.06 * size} smoothness={2} position={[0, panelY, 0]} castShadow>
          <meshStandardMaterial color={FRAME} metalness={0.75} roughness={0.3} />
        </RoundedBox>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, panelY - 0.06 * size, s * 0.075 * size]}>
            <boxGeometry args={[width, height - 0.12 * size, 0.01]} />
            <meshStandardMaterial color={FACE} roughness={0.55} metalness={0.2} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={'a' + s} position={[0, panelY + height / 2 - 0.05 * size, s * 0.078 * size]}>
            <boxGeometry args={[width, 0.1 * size, 0.012]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
      </StaticMerge>
      {textBlock(1)}
      {dual && textBlock(-1)}
    </group>
  )
}
