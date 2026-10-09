// Nunito yazı tiplerini sitenin karakterlerine indirger: 3D yazılar için TTF, sayfa için WOFF2.
// Temel Latin, Latin-1, Latin Genişletilmiş-A (Türkçe dahil) ve kaynak kodda geçen her özel karakter tutulur.
// Çalıştırma: node scripts/subset-fonts.mjs (yazı/içerik değişince tekrar çalıştırın)
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'

const FONTS = {
  'Nunito-Black.ttf': '@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf',
  'Nunito-ExtraBold.ttf': '@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf',
  'Nunito-SemiBold.ttf': '@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf',
}

const chars = new Set()
const range = (a, b) => {
  for (let c = a; c <= b; c++) chars.add(String.fromCodePoint(c))
}
range(0x20, 0x7e) // Temel Latin
range(0xa0, 0xff) // Latin-1
range(0x100, 0x17f) // Latin Genişletilmiş-A (ğ, ı, ş, İ ...)
// Kaynakta geçen özel karakterler (ör. ₺ · – — ★ ☾ …)
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) scan(p)
    else if (/\.(jsx?|json)$/.test(entry.name)) for (const ch of fs.readFileSync(p, 'utf8')) if (ch.codePointAt(0) > 0x7e) chars.add(ch)
  }
}
scan('src')
const text = [...chars].join('')

const out = 'src/assets/fonts'
fs.mkdirSync(out, { recursive: true })
for (const [name, source] of Object.entries(FONTS)) {
  const input = fs.readFileSync(path.resolve('node_modules', source))
  // TTF: 3D yazılar (troika WOFF2 okuyamaz); WOFF2: sayfa yazıları (CSS)
  const ttf = await subsetFont(input, text, { targetFormat: 'truetype' })
  const woff2 = await subsetFont(input, text, { targetFormat: 'woff2' })
  fs.writeFileSync(path.join(out, name), ttf)
  fs.writeFileSync(path.join(out, name.replace('.ttf', '.woff2')), woff2)
  console.log(`${name}: ${(input.length / 1024).toFixed(0)} KB → TTF ${(ttf.length / 1024).toFixed(0)} KB, WOFF2 ${(woff2.length / 1024).toFixed(0)} KB`)
}
