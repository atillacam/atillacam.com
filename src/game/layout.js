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
  { id: 'golf', label: 'areaGolf', center: [34, 0, 34], radius: 12, color: '#4fd99a', spawn: [24, 1.2, 24], yaw: -Math.PI / 4 },
  // Dış bölgeler: çevre yolun ötesinde, tepelerin arkasında (pad: zemin tipi)
  { id: 'soccer', label: 'areaSoccer', center: [78, 0, 78], radius: 20, color: '#4fd99a', spawn: [60, 1.2, 60], yaw: -Math.PI / 4, pad: 'field', outer: true },
  { id: 'drift', label: 'areaDrift', center: [-78, 0, 78], radius: 20, color: COLORS.coral, spawn: [-60, 1.2, 60], yaw: (-3 * Math.PI) / 4, pad: 'asphalt', outer: true },
  { id: 'offroad', label: 'areaOffroad', center: [-78, 0, -78], radius: 20, color: '#c58b4a', spawn: [-60, 1.2, -60], yaw: (3 * Math.PI) / 4, pad: 'dirt', outer: true },
  { id: 'lab', label: 'areaLab', center: [0, 0, -108], radius: 18, color: '#2ec4b6', spawn: [0, 1.2, -86], yaw: Math.PI / 2, pad: 'alley', outer: true },
  { id: 'career', label: 'areaCareer', center: [-106, 0, 0], radius: 18, color: COLORS.amber, spawn: [-84, 1.2, 0], yaw: Math.PI, pad: 'alley', outer: true },
  { id: 'bowling', label: 'areaBowling', center: [108, 0, 0], radius: 18, color: '#ff8a3d', spawn: [86, 1.2, 0], yaw: 0, pad: 'alley', outer: true },
  { id: 'lookout', label: 'areaLookout', center: [78, 0, -78], radius: 14, color: COLORS.violet, spawn: [60, 1.2, -60], yaw: Math.PI / 4, pad: 'hill', outer: true },
  { id: 'stunt', label: 'areaStunt', center: [0, 0, 108], radius: 20, color: '#ff5d5d', spawn: [-18, 1.2, 108], yaw: 0, pad: 'asphalt', outer: true },
]

export const GOLF_PAR = 3 // mini golf deliğinin par değeri

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
  // Kapılar yol girişleriyle (45°'nin katları) çakışmasın diye 11.5° kaydırıldı: direkler yolu kesmez
  startAngle: Math.PI / 2 - 0.2,
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
  { id: 'lab', label: 'areaLab', action: 'spotLabAction', position: [0, 0, -95], color: '#2ec4b6' },
  { id: 'bowling', label: 'areaBowling', action: 'spotBowlingAction', position: [93, 0, -6], color: '#ff8a3d' },
  { id: 'lookout', label: 'areaLookout', action: 'spotLookoutAction', position: [78, 0, -78], color: COLORS.violet },
  { id: 'credits', label: 'spotCredits', action: 'spotCreditsAction', position: [-21, 0, 18], color: '#c9b6ff' },
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
  { from: [8, 8], to: [25.5, 25.5] },
  { from: [RING_RADIUS + RING_WIDTH / 2, 0], to: [90, 0], outer: true },
  { from: [-(RING_RADIUS + RING_WIDTH / 2), 0], to: [-88, 0], outer: true },
  { from: [0, -(RING_RADIUS + RING_WIDTH / 2)], to: [0, -90], outer: true },
  // Stunt parkı: güneydeki START/BİTİŞ kapısının direklerinden kaçınmak için çaprazdan bağlanır
  { from: ringPoint(Math.PI / 2 + 0.32, RING_RADIUS + RING_WIDTH / 2), to: [-9.2, 90.3], outer: true },
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
// Çevre yolu lambaları: iki yarış kapısının tam ortası (kapı açısı + 22.5°)
const RACE_LAMP_OFFSET = RACE.startAngle + Math.PI / 8
export const LAMPS = [
  ...[-8, -18].map((z) => [3.6, 0, z]),
  ...[10, 20].map((x) => [x, 0, -3.6]),
  ...[-10, -20].map((x) => [x, 0, 3.6]),
  ...[12, 21, 60].map((z) => [3.6, 0, z]),
  // Çevre yolu lambaları iki yarış kapısının tam ortasında: yol girişlerini ve kapı direklerini kesmez
  ...Array.from({ length: 8 }, (_, i) => {
    const [x, z] = ringPoint((i / 8) * Math.PI * 2 + RACE_LAMP_OFFSET, RING_RADIUS - RING_WIDTH / 2 - 1.6)
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

// Gizli AÇ logoları: kenar köşelere saklanmış; hepsini bulan altın boyayı açar.
// air: yalnızca havadayken (rampadan atlayınca) alınır
const STUNT_AREA = AREAS.find((a) => a.id === 'stunt')
export const HIDDEN_LOGOS = [
  { x: -31.5, z: -37.5 }, // Galata Kulesi'nin arkası
  { x: -34, z: 37.6 }, // Kız Kulesi'nin arkası, gölün içinde
  { x: STUNT_AREA.center[0] + 10, z: STUNT_AREA.center[2] - 11, y: 3.0, air: true }, // stunt parkı, kuzey rampasının üstü
  { x: 88, z: -88 }, // gözlem tepesinin arka yamacı
  { x: -64, z: 94 }, // drift pistinin güney kıyısı
  { x: 16, z: -57 }, // proje panolarının arkası
  { x: 46, z: 46 }, // mini golfün arka köşesi
  { x: -92, z: -86 }, // arazi parkurunun en dibi
  { x: 11, z: -121 }, // laboratuvarın arka sokağı
  { x: -119, z: 9 }, // kariyer yolunun sonu
].map((l, i) => ({ id: `logo-${i + 1}`, ...l }))

// İstanbul dokunuşları
export const ISTANBUL = {
  galata: { x: -28, z: -34 },
  simit: { x: 11.5, z: -10.5, rot: -Math.PI / 4 }, // ön yüzü meydanın ortasına bakar
  maiden: { x: LAKE.x, z: LAKE.z }, // Kız Kulesi gölün ortasında
  ferryRadius: 7, // vapurun göldeki tur yarıçapı
}

// Çevre yolunda dolaşan araçlar. Sağdan trafik: açı artarak giden (dir 1) iç şeritte, ters yöndeki dış şeritte
export const TRAFFIC = [
  { lane: RING_RADIUS - 1.75, dir: 1, angle: 0.4, color: '#f2c230', taxi: true },
  { lane: RING_RADIUS - 1.75, dir: 1, angle: 0.4 + Math.PI, color: '#d8322f' },
  { lane: RING_RADIUS + 1.75, dir: -1, angle: 2.2, color: '#f2f2f0' },
  { lane: RING_RADIUS + 1.75, dir: -1, angle: 2.2 + Math.PI, color: '#2f6fe0' },
]

// Ağaç ve kaya yerleştirirken boş bırakılacak alanlar
export const CLEARINGS = [
  { x: ISTANBUL.galata.x, z: ISTANBUL.galata.z, r: 7 },
  ...AREAS.map((a) => ({ x: a.center[0], z: a.center[2], r: a.radius + 3 })),
  { x: 0, z: -9, r: 11 },
  { x: -16, z: 20, r: 4 },
  { x: -16, z: -16, r: 6 }, // heykel
]
