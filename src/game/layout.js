import { profile, projects } from '../content.js'

// Dünyanın yerleşimi. Kuzey = -z, doğu = +x. Birimler metre.
export const WORLD_HALF = 140 // görünmez duvarlar (kuzey, güney, batı)
// Dünya dikdörtgeni: doğuda Boğaz ve Asya Yakası ile genişler
export const WORLD = { minX: -WORLD_HALF, maxX: 320, minZ: -WORLD_HALF, maxZ: WORLD_HALF }
// Boğaz: x ekseninde kıyıdan kıyıya; deniz tabanı kıyılardan yumuşakça iner
export const STRAIT = { beachWest: 134, west: 162, east: 210, beachEast: 238, seaLevel: -0.75, depth: -7, centerX: 186 }
// Asma köprü (z = 30 boyunca): rampalar karada, tabliye denizin üstünde, iki kule.
// Rampalar 40 m (~11°): daha dik rampada araç inişte burnunu yere gömüyordu
export const BRIDGE = { z: 30, startX: 110, deckStart: 150, deckEnd: 222, endX: 262, deckY: 8, width: 8, towers: [162, 210], towerTop: 36 }

// Asya Yakası sokakları (asfalt): sahil yolu, meydandan geçen ana cadde ve iki ara sokak.
// Kesişimler aynı noktalarda biter (GPS grafı birbirine bağlar). street: asfalt olarak çizilir.
export const ASIA_STREETS = [
  [[247, -110], [247, -31]],
  [[247, -31], [247, 73]],
  [[247, 73], [247, 110]],
  [[247, -31], [283, -31]],
  [[283, -31], [300, -31]],
  [[247, 73], [283, 73]],
  [[283, 73], [300, 73]],
  [[283, 14], [283, -31]],
  [[283, -31], [283, -48]],
  [[283, 46], [283, 73]],
  [[283, 73], [283, 118]],
]
// Göbekli kavşaklar: köprü trafiği bunların çevresinden U dönüşü yapar
export const ROUNDABOUTS = {
  europe: { x: 91, z: 30, island: 3.2, lane: 7.5 },
  asia: { x: 282, z: 30, island: 4.5, lane: 11 }, // ortada dilek çeşmesi
}
export const TEA_GARDEN = { x: 238.5, z: 62 }

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
  { id: 'sumo', label: 'areaSumo', center: [33, 0, -33], radius: 13, color: '#e84a5f', spawn: [19, 1.2, -22], yaw: Math.PI / 4 },
  // Dış bölgeler: çevre yolun ötesinde, tepelerin arkasında (pad: zemin tipi)
  { id: 'soccer', label: 'areaSoccer', center: [78, 0, 78], radius: 20, color: '#4fd99a', spawn: [60, 1.2, 60], yaw: -Math.PI / 4, pad: 'field', outer: true },
  { id: 'drift', label: 'areaDrift', center: [-78, 0, 78], radius: 20, color: COLORS.coral, spawn: [-60, 1.2, 60], yaw: (-3 * Math.PI) / 4, pad: 'asphalt', outer: true },
  { id: 'offroad', label: 'areaOffroad', center: [-78, 0, -78], radius: 20, color: '#c58b4a', spawn: [-60, 1.2, -60], yaw: (3 * Math.PI) / 4, pad: 'dirt', outer: true },
  { id: 'lab', label: 'areaLab', center: [0, 0, -108], radius: 18, color: '#2ec4b6', spawn: [0, 1.2, -86], yaw: Math.PI / 2, pad: 'alley', outer: true },
  { id: 'career', label: 'areaCareer', center: [-106, 0, 0], radius: 18, color: COLORS.amber, spawn: [-84, 1.2, 0], yaw: Math.PI, pad: 'alley', outer: true },
  { id: 'bowling', label: 'areaBowling', center: [108, 0, 0], radius: 18, color: '#ff8a3d', spawn: [86, 1.2, 0], yaw: 0, pad: 'alley', outer: true },
  { id: 'lookout', label: 'areaLookout', center: [78, 0, -78], radius: 14, color: COLORS.violet, spawn: [60, 1.2, -60], yaw: Math.PI / 4, pad: 'hill', outer: true },
  { id: 'asia', label: 'areaAsia', center: [282, 0, 30], radius: 16, color: '#2ec4b6', spawn: [268, 1.2, 30], yaw: 0, outer: true },
  { id: 'stunt', label: 'areaStunt', center: [0, 0, 108], radius: 20, color: '#ff5d5d', spawn: [-18, 1.2, 108], yaw: 0, pad: 'asphalt', outer: true },
]

export const GOLF_PAR = 3 // mini golf deliğinin par değeri

// Sumo arenası: yükseltilmiş yuvarlak platform; dışarı düşen kaybeder
export const SUMO = { x: 33, z: -33, radius: 10, height: 0.45, bots: 3, limit: 90 }
// Helikopter pisti: halka parkuru buradan başlar ve burada biter
export const HELIPAD = { x: 13, z: -30 }
// Taksi durağı (meydanda)
export const TAXI_STAND = { x: 6, z: 5 }

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
  { id: 'simit', label: 'placeSimit', action: 'spotSimitAction', position: [13.6, 0, -7.6], color: '#c8302c' },
  { id: 'wish', label: 'spotWish', action: 'spotWishAction', position: [282, 0, 37.5], color: '#7ad7ff' },
  { id: 'tea', label: 'spotTea', action: 'spotTeaAction', position: [TEA_GARDEN.x + 5.2, 0, TEA_GARDEN.z], color: '#c8302c' },
  { id: 'taxi', label: 'spotTaxi', action: 'spotTaxiAction', position: [6, 0, 5], color: '#f2c230' },
  { id: 'helipad', label: 'spotHelipad', action: 'spotHelipadAction', position: [13, 0, -30], color: '#7ad7ff' },
  { id: 'sumo', label: 'areaSumo', action: 'spotSumoAction', position: [23, 0, -23], color: '#e84a5f' },
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
  // Köprü yolu: çevre yolundan köprü başına, köprü (bridge: arazide çizilmez, yalnızca GPS için) ve Asya Yakası
  { from: [Math.sqrt((RING_RADIUS + RING_WIDTH / 2) ** 2 - 30 ** 2), 30], to: [110, 30], outer: true },
  { from: [110, 30], to: [262, 30], outer: true, bridge: true },
  { from: [262, 30], to: [266.5, 30], outer: true },
  ...ASIA_STREETS.map(([from, to]) => ({ from, to, outer: true, street: true })),
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

// Helikopter halka parkuru: [x, yerden yükseklik, z]. Sırayla geçilir; son halka pistin üstünde.
export const SKY_RINGS = [
  [2, 13, -52], // proje panolarının üstü
  [-19, 14, -40], // Galata Kulesi'nin yanı
  [-44, 10, -6], // iletişim meydanı
  [-28, 8, 42], // Kız Kulesi ve martılar
  [-12, 7, 66], // çevre yolunun üstü, alçaktan
  [0, 11, 100], // stunt parkı
  [58, 13, 70], // tepelerin arası
  [34, 9, 34], // mini golf
  [70, 22, -68], // gözlem tepesinin zirvesi
  [13, 8, -30], // bitiş: helikopter pisti
]

// Taksi: yolcuların bekleyip indiği yerler (label: i18n anahtarı)
export const TAXI_PLACES = [
  { id: 'galata', label: 'placeGalata', x: -22, z: -28 },
  { id: 'maiden', label: 'placeMaiden', x: -20, z: 24 },
  { id: 'simit', label: 'placeSimit', x: 14, z: -6 },
  { id: 'projects', label: 'areaProjects', x: 0, z: -29 },
  { id: 'about', label: 'areaAbout', x: 27, z: 0 },
  { id: 'contact', label: 'areaContact', x: -27, z: 0 },
  { id: 'race', label: 'areaRace', x: -10, z: 61 },
  { id: 'golf', label: 'areaGolf', x: 23, z: 23 },
  { id: 'stunt', label: 'areaStunt', x: -9, z: 90 },
  { id: 'lab', label: 'areaLab', x: 0, z: -88 },
  { id: 'bowling', label: 'areaBowling', x: 88, z: 0 },
  { id: 'career', label: 'areaCareer', x: -86, z: 0 },
]

// Çevre yolunda dolaşan araçlar. Sağdan trafik: açı artarak giden (dir 1) iç şeritte, ters yöndeki dış şeritte
export const TRAFFIC = [
  { lane: RING_RADIUS - 1.75, dir: 1, angle: 0.4, color: '#f2c230', taxi: true },
  { lane: RING_RADIUS - 1.75, dir: 1, angle: 0.4 + Math.PI, color: '#d8322f' },
  { lane: RING_RADIUS + 1.75, dir: -1, angle: 2.2, color: '#f2f2f0' },
  { lane: RING_RADIUS + 1.75, dir: -1, angle: 2.2 + Math.PI, color: '#2f6fe0' },
]

// Asya Yakası silüeti: tepedeki cami (kubbe + iki minare) ve yamaçlara yayılan binalar.
// Yerleşim sabit tohumla üretilir (her açılışta aynı); meydan, yol, fener ve tabela çevresi boş kalır.
export const ASIA_MOSQUE = { x: 276, z: -64 }
export const ASIA_BUILDINGS = (() => {
  let seed = 977
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const plaza = AREAS.find((a) => a.id === 'asia')
  const keepOut = [
    { x: plaza.center[0], z: plaza.center[2], r: plaza.radius + 7 },
    { x: ASIA_MOSQUE.x, z: ASIA_MOSQUE.z, r: 17 },
    { x: STRAIT.beachEast - 4, z: -26, r: 12 }, // deniz feneri
  ]
  const list = []
  // Sütunlar arasında meydandan kuzey-güneye uzanan ~6 m'lik ana cadde (x ≈ 283) ve 3-6 m'lik sokaklar
  for (const x of [258, 270, 293, 303]) {
    for (let z = -122; z <= 122; z += 13) {
      const bx = x + (rand() - 0.5) * 2
      const bz = z + (rand() - 0.5) * 2
      const w = 5 + rand() * 2.5
      const d = 5 + rand() * 2.5
      const h = 6 + rand() * rand() * 20
      const tint = Math.floor(rand() * 6)
      if (Math.abs(bz - BRIDGE.z) < 10 && bx < plaza.center[0]) continue // köprüden meydana yol
      if (keepOut.some((k) => Math.hypot(bx - k.x, bz - k.z) < k.r)) continue
      // Sokaklardan en az yarım bina + 4 m (kaldırım) uzak
      const clear = Math.max(w, d) / 2 + 4
      if (ASIA_STREETS.some(([[ax, az], [cx, cz]]) => Math.hypot(Math.max(Math.min(bx, Math.max(ax, cx)), Math.min(ax, cx)) - bx, Math.max(Math.min(bz, Math.max(az, cz)), Math.min(az, cz)) - bz) < clear)) continue
      if (Math.hypot(bx - TEA_GARDEN.x, bz - TEA_GARDEN.z) < 14) continue
      list.push({ x: bx, z: bz, w, d, h, tint })
    }
  }
  return list
})()

// Ağaç ve kaya yerleştirirken boş bırakılacak alanlar
export const CLEARINGS = [
  ...ASIA_BUILDINGS.map((b) => ({ x: b.x, z: b.z, r: Math.max(b.w, b.d) * 0.75 })),
  { x: ASIA_MOSQUE.x, z: ASIA_MOSQUE.z, r: 15 },
  { x: ISTANBUL.galata.x, z: ISTANBUL.galata.z, r: 7 },
  ...AREAS.map((a) => ({ x: a.center[0], z: a.center[2], r: a.radius + 3 })),
  { x: 0, z: -9, r: 11 },
  { x: -16, z: 20, r: 4 },
  { x: -16, z: -16, r: 6 }, // heykel
]
