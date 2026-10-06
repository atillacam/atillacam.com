// GitHub'dan gerçek profil verilerini çeker ve src/data/github.json'a yazar.
// `npm run build` öncesinde otomatik çalışır (prebuild). Ağ yoksa ya da API sınırına
// takılırsa mevcut dosya korunur; yayın hiçbir zaman bu adım yüzünden bozulmaz.
// İsteğe bağlı: GITHUB_TOKEN ortam değişkeni varsa istek sınırı yükselir.
import fs from 'node:fs'
import path from 'node:path'

const USER = 'atillacam'
// Profil README deposu proje sayılmaz
const EXCLUDE = new Set([USER])
const OUT = path.resolve('src/data/github.json')

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'atillacam.com-build' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function get(url) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json()
}

try {
  const [user, repos] = await Promise.all([
    get(`https://api.github.com/users/${USER}`),
    get(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`),
  ])
  const own = repos.filter((r) => !r.fork && !r.archived)
  const projects = own.filter((r) => !EXCLUDE.has(r.name))
  const data = {
    fetchedAt: new Date().toISOString(),
    user: { login: user.login, publicRepos: user.public_repos, followers: user.followers, since: user.created_at },
    totals: {
      projects: projects.length,
      stars: own.reduce((sum, r) => sum + r.stargazers_count, 0),
      languages: [...new Set(projects.map((r) => r.language).filter(Boolean))],
      // Profil README deposu otomasyonla sık güncellenir; son güncelleme yalnızca projelerden hesaplanır
      lastPush: projects.reduce((max, r) => (r.pushed_at > max ? r.pushed_at : max), ''),
    },
    repos: Object.fromEntries(
      own.map((r) => [r.name, { stars: r.stargazers_count, language: r.language, pushedAt: r.pushed_at, url: r.html_url }]),
    ),
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
  console.log(`GitHub verisi güncellendi: ${data.totals.projects} proje, ${data.totals.stars} yıldız`)
} catch (err) {
  if (fs.existsSync(OUT)) console.warn(`GitHub verisi alınamadı, kayıtlı veri kullanılıyor (${err.message})`)
  else {
    // İlk kurulumda bile derleme sürsün: boş ama geçerli bir dosya bırak
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify({ fetchedAt: null, user: null, totals: null, repos: {} }, null, 2) + '\n')
    console.warn(`GitHub verisi alınamadı, boş veriyle devam ediliyor (${err.message})`)
  }
}
