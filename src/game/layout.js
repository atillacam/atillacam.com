import { profile, projects } from '../content.js'

// Dünyanın yerleşimi. Kuzey = -z, doğu = +x. Birimler metre.
export const WORLD_HALF = 140 // görünmez duvarlar
export const OUTER = 78 // dış bölgelerin çapraz uzaklığı (x ve z)
export const RING_RADIUS = 66 // çevre yarış yolu
export const RING_WIDTH = 7
export const SPAWN = { position: [0, 1.2, 8], yaw: Math.PI / 2 } // yaw=π/2 → kuzeye bakar

export const COLORS = {
  ink: '#121726',
  cream: '#f6f3ec',
  blue: '#3d7bff',
  amber: '#ffb547',
  teal: '#2ec4b6',
  coral: '#ff5d5d',
  violet: '#9b7bff',
  path: '#cbbb95',
  pathEdge: '#b3a27c',
  ring: '#4a4f5c',
}

// Büyük bölgeler: ziyaret takibi, harita ve hızlı ışınlanma
export const AREAS = [
  { id: 'home', label: 'areaHome', center: [0, 0, 0], radius: 13, color: COLORS.blue, spawn: [0, 1.2, 8], yaw: Math.PI / 2 },
  { id: 'projects', label: 'areaProjects', center: [0, 0, -42], radius: 21, color: COLORS.amber, spawn: [0, 1.2, -28], yaw: Math.PI / 2 },
  { id: 'about', label: 'areaAbout', center: [40, 0, 0], radius: 15, color: COLORS.teal, spawn: [27, 1.2, 0], yaw: 0 },
  { id: 'contact', label: 'areaContact', center: [-40, 0, 0], radius: 15, color: COLORS.violet, spawn: [-27, 1.2, 0], yaw: Math.PI },
  { id: 'playground', label: 'areaPlayground', center: [0, 0, 40], radius: 16, color: COLORS.coral, spawn: [0, 1.2, 26], yaw: -Math.PI / 2 },
  { id: 'lake', label: 'areaLake', center: [-34, 0, 34], radius: 11, color: '#4fa3d9', spawn: [-22, 1.2, 22], yaw: (3 * Math.PI) / 4 },
  { id: 'race', label: 'areaRace', center: [0, 0, RING_RADIUS], radius: 9, color: COLORS.amber, spawn: [8, 1.2, RING_RADIUS], yaw: Math.PI },
  // Dış bölgeler: çevre yolun ötesinde, tepelerin arkasında (pad: zemin tipi)
  { id: 'soccer', label: 'areaSoccer', center: [78, 0, 78], radius: 20, color: '#4fd99a', spawn: [60, 1.2, 60], yaw: -Math.PI / 4, pad: 'field', outer: true },
  { id: 'drift', label: 'areaDrift', center: [-78, 0, 78], radius: 20, color: COLORS.coral, spawn: [-60, 1.2, 60], yaw: (-3 * Math.PI) / 4, pad: 'asphalt', outer: true },
  { id: 'offroad', label: 'areaOffroad', center: [-78, 0, -78], radius: 20, color: '#c58b4a', spawn: [-60, 1.2, -60], yaw: (3 * Math.PI) / 4, pad: 'dirt', outer: true },
  { id: 'bowling', label: 'areaBowling', center: [108, 0, 0], radius: 18, color: '#ff8a3d', spawn: [86, 1.2, 0], yaw: 0, pad: 'alley', outer: true },
  { id: 'lookout', label: 'areaLookout', center: [78, 0, -78], radius: 14, color: COLORS.violet, spawn: [60, 1.2, -60], yaw: Math.PI / 4, pad: 'hill', outer: true },
]

export const LAKE = { x: -34, z: 34, radius: 11, waterLevel: -0.75 }

// Projeler: kuzeyde bir sıra pano
const projectSpacing = 10.5
const projectStart = -((projects.length - 1) * projectSpacing) / 2
export const PROJECT_BOARDS = projects.map((p, i) => ({
  project: p,
  position: [projectStart + i * projectSpacing, 0, -49],
}))

// Sosyal medya kaideleri (iletişim bölgesi)
export const SOCIAL_PEDESTALS = profile.socials.map((s, i) => ({
  social: s,
  position: [-46 + i * 6.5, 0, -9],
}))

export const MAILBOX = { position: [-52, 0, 3], rotation: Math.PI / 2 }

// Yarış: başlangıç kapısı güneyde, saat yönünün tersine (θ artarak) gidilir
export const RACE = {
  startAngle: Math.PI / 2,
  checkpoints: 8,
}
export function ringPoint(angle, radius = RING_RADIUS) {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}
export const RACE_START = (() => {
  const a = RACE.startAngle - 0.09
  const [x, z] = ringPoint(a)
  // Teğet yönü (θ artarken): (-sin, cos) → yaw = atan2(-dz, dx)
  const dx = -Math.sin(a)
  const dz = Math.cos(a)
  return { position: [x, 1.2, z], yaw: Math.atan2(-dz, dx) }
})()

// Etkileşim noktaları: araç üstündeyken Enter ile pencere açılır
export const SPOTS = [
  { id: 'welcome', label: 'spotWelcome', action: 'spotWelcomeAction', position: [-7, 0, 2], color: COLORS.blue },
  { id: 'about', label: 'areaAbout', action: 'spotAboutAction', position: [40, 0, -6], color: COLORS.teal },
  { id: 'skills', label: 'spotSkills', action: 'spotSkillsAction', position: [35, 0, 6], color: COLORS.teal },
  { id: 'contact', label: 'areaContact', action: 'spotContactAction', position: [-45, 0, 6], color: COLORS.violet },
  { id: 'race', label: 'spotRace', action: 'spotRaceAction', position: [9, 0, RING_RADIUS - 8], color: COLORS.amber },
  { id: 'bowling', label: 'areaBowling', action: 'spotBowlingAction', position: [93, 0, -6], color: '#ff8a3d' },
  { id: 'lookout', label: 'areaLookout', action: 'spotLookoutAction', position: [78, 0, -78], color: COLORS.violet },
  { id: 'credits', label: 'spotCredits', action: 'spotCreditsAction', position: [-16, 0, 20], color: '#c9b6ff' },
  ...SOCIAL_PEDESTALS.map(({ social, position }) => ({
    id: `social:${social.id}`,
    label: social.label,
    rawLabel: true,
    action: 'spotSocialAction',
    position: [position[0], 0, position[2] + 5.5],
    color: social.id === 'github' ? '#9aa4b8' : social.id === 'linkedin' ? '#2f7fdc' : '#e1306c',
  })),
  ...PROJECT_BOARDS.map(({ project, position }) => ({
    id: `project:${project.id}`,
    label: project.title,
    rawLabel: true,
    action: 'spotProjectAction',
    position: [position[0], 0, position[2] + 6.5],
    color: project.color,
  })),
]

// Yollar (düz zemin şeritleri) — merkezden bölgelere
// Yollar meydan kenarlarında biter (meydanın içine taşmaz)
export const PATHS = [
  { from: [0, 0], to: [0, -21.2] },
  { from: [0, 0], to: [25.2, 0] },
  { from: [0, 0], to: [-25.2, 0] },
  { from: [0, 0], to: [0, 24.2] },
  { from: [0, 55.8], to: [0, RING_RADIUS - RING_WIDTH / 2] },
  { from: [-8, 8], to: [-22, 22] },
  { from: [RING_RADIUS + RING_WIDTH / 2, 0], to: [90, 0], outer: true },
  // Çevre yoldan dış bölgelere: tepeleri yararak geçen yollar
  ...[
    [1, 1, 20],
    [-1, 1, 20],
    [-1, -1, 20],
    [1, -1, 14],
  ].map(([sx, sz, radius]) => {
    const a = (RING_RADIUS + RING_WIDTH / 2) / Math.SQRT2
    const b = (Math.hypot(OUTER, OUTER) - radius) / Math.SQRT2
    return { from: [sx * a, sz * a], to: [sx * b, sz * b], outer: true }
  }),
]

// Sokak lambaları: yolların kenarında ve çevre yolunda
export const LAMPS = [
  ...[-8, -18].map((z) => [3.6, 0, z]),
  ...[10, 20].map((x) => [x, 0, -3.6]),
  ...[-10, -20].map((x) => [x, 0, 3.6]),
  ...[12, 21, 60].map((z) => [3.6, 0, z]),
  ...Array.from({ length: 10 }, (_, i) => {
    const [x, z] = ringPoint((i / 10) * Math.PI * 2 + 0.3, RING_RADIUS - RING_WIDTH / 2 - 1.6)
    return [x, 0, z]
  }),
]

// Toplanabilir veri çekirdekleri
export const COLLECTIBLES = [
  [18, -18],
  [-20, -22],
  [58, 26],
  [-58, -26],
  [26, 54],
  [46, -46],
  [-52, 50],
  [RING_RADIUS, 0],
  [0, -RING_RADIUS],
  [-14, 40],
  [92, 64],
  [-96, 92],
  [-84, -70],
  [86, -70],
].map(([x, z], i) => ({ id: `core-${i + 1}`, x, z }))

// Ağaç ve kaya yerleştirirken boş bırakılacak alanlar
export const CLEARINGS = [
  ...AREAS.map((a) => ({ x: a.center[0], z: a.center[2], r: a.radius + 3 })),
  { x: 0, z: -9, r: 11 },
  { x: -16, z: 20, r: 4 },
]
