// Rehberli tur durakları: kamera konumu, bakış noktası ve metin anahtarları (i18n: tourN / tourNText).
// Kamera bir duraktan ötekine yumuşakça uçar, durakta yavaşça süzülür; DWELL saniye sonra kendiliğinden ilerler.
export const TOUR_STOPS = [
  { pos: [34, 40, 58], look: [0, 0, -8] }, // karşılama: ana meydan ve çevre yolu
  { pos: [0, 9, -20], look: [0, 3.5, -48] }, // proje panoları
  { pos: [22, 8, 12], look: [42, 2, -2] }, // hakkımda
  { pos: [10, 12, -84], look: [0, 3, -112] }, // laboratuvar
  { pos: [-82, 10, 10], look: [-106, 3, -2] }, // kariyer
  { pos: [-24, 8, 12], look: [-46, 2, 2] }, // iletişim
  { pos: [125, 32, 85], look: [190, 6, 25] }, // Boğaz ve Asya Yakası
  { pos: [20, 26, 40], look: [0, 2, 0] }, // bitiş
]
export const TOUR_FLY = 2.4 // duraklar arası uçuş (sn)
export const TOUR_DWELL = 9 // durakta bekleme (sn)
