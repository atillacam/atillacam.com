// Proje görselleri kodla çizilir (dış dosya yok): kapak = projenin teknoloji adımlarından akış şeması.
// project.image verilirse (gerçek ekran görüntüsü, /public altında) klasik görünümde onun yerine o kullanılır.
// 3D panonun tüm yüzü de burada tek bir dokuya çizilir: tek çizim çağrısı, net yazı.

const FONT = 'Nunito, system-ui, sans-serif'

// Fontlar yüklenmeden tuvale yazılırsa yedek fonta düşer: önce bekle
export function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  return Promise.all(['600 20px Nunito', '800 20px Nunito', '900 20px Nunito'].map((f) => document.fonts.load(f))).catch(() => {})
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// Satırlara böl (en fazla maxLines; taşarsa …)
function wrap(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  else if (lines.length === maxLines && line) lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:]*\S*$/, '') + '…'
  return lines
}

// Kapak: koyu zemin, proje renginde ışıma, nokta ızgara ve numaralı adımlardan oluşan akış şeması
export function drawCover(ctx, project, x, y, w, h) {
  const color = project.color
  ctx.save()
  roundRect(ctx, x, y, w, h, h * 0.06)
  ctx.clip()
  const bg = ctx.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#161d33')
  bg.addColorStop(1, '#0d1222')
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  const glow = ctx.createRadialGradient(x + w * 0.85, y + h * 0.1, 0, x + w * 0.85, y + h * 0.1, w * 0.7)
  glow.addColorStop(0, rgba(color, 0.42))
  glow.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = glow
  ctx.fillRect(x, y, w, h)
  // Nokta ızgara
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  const step = h / 9
  for (let gx = x + step / 2; gx < x + w; gx += step) for (let gy = y + step / 2; gy < y + h; gy += step) ctx.fillRect(gx, gy, h * 0.006, h * 0.006)

  // Akış şeması: en fazla 4 adım
  const steps = project.tags.slice(0, 4)
  const n = steps.length
  const gap = w * 0.045
  const nodeW = (w * 0.9 - gap * (n - 1)) / n
  const nodeH = h * 0.36
  const top = y + (h - nodeH) / 2 + h * 0.04
  steps.forEach((tag, i) => {
    const nx = x + w * 0.05 + i * (nodeW + gap)
    // Bağlantı oku
    if (i > 0) {
      const ax = nx - gap + gap * 0.18
      const bx = nx - gap * 0.18
      const ay = top + nodeH / 2
      ctx.strokeStyle = rgba(color, 0.9)
      ctx.lineWidth = h * 0.012
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, ay)
      ctx.stroke()
      ctx.fillStyle = rgba(color, 0.95)
      ctx.beginPath()
      ctx.moveTo(bx + h * 0.012, ay)
      ctx.lineTo(bx - h * 0.025, ay - h * 0.028)
      ctx.lineTo(bx - h * 0.025, ay + h * 0.028)
      ctx.fill()
    }
    roundRect(ctx, nx, top, nodeW, nodeH, nodeH * 0.18)
    ctx.fillStyle = i === n - 1 ? rgba(color, 0.22) : 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.lineWidth = h * 0.008
    ctx.strokeStyle = rgba(color, i === n - 1 ? 1 : 0.7)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = color
    ctx.font = `900 ${Math.round(nodeH * 0.2)}px ${FONT}`
    ctx.fillText(String(i + 1).padStart(2, '0'), nx + nodeW * 0.1, top + nodeH * 0.36)
    ctx.fillStyle = '#ffffff'
    let size = Math.round(nodeH * 0.24)
    ctx.font = `800 ${size}px ${FONT}`
    while (ctx.measureText(tag).width > nodeW * 0.82 && size > 8) ctx.font = `800 ${--size}px ${FONT}`
    ctx.fillText(tag, nx + nodeW * 0.1, top + nodeH * 0.74)
  })
  ctx.restore()
}

const covers = new Map()
// Klasik görünüm için kapak (önbellekli data URL)
export function coverUrl(project, w = 800, h = 400) {
  const key = project.id + w
  if (covers.has(key)) return covers.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  drawCover(canvas.getContext('2d'), project, 0, 0, w, h)
  const url = canvas.toDataURL('image/png')
  covers.set(key, url)
  return url
}

// 3D pano yüzü: üst şerit, kapak, yıl ve bağlantı, başlık, özet, teknoloji rozetleri
export function drawBoard(canvas, project, { title, summary, linkLabel }) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  const pad = W * 0.035
  ctx.fillStyle = '#121829'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = project.color
  ctx.fillRect(0, 0, W, H * 0.014)
  drawCover(ctx, project, pad, pad, W - pad * 2, H * 0.38)

  let y = pad + H * 0.38 + H * 0.075
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = project.color
  ctx.font = `800 ${Math.round(H * 0.032)}px ${FONT}`
  ctx.fillText(`${project.year}  ·  ${linkLabel}`, pad, y)
  y += H * 0.085
  ctx.fillStyle = '#f6f1e6'
  ctx.font = `900 ${Math.round(H * 0.066)}px ${FONT}`
  for (const line of wrap(ctx, title, W - pad * 2, 1)) ctx.fillText(line, pad, y)
  y += H * 0.07
  ctx.fillStyle = '#c3c9da'
  ctx.font = `600 ${Math.round(H * 0.036)}px ${FONT}`
  for (const line of wrap(ctx, summary, W - pad * 2, 3)) {
    ctx.fillText(line, pad, y)
    y += H * 0.05
  }
  // Teknoloji rozetleri
  let px = pad
  const py = H - pad - H * 0.06
  ctx.font = `800 ${Math.round(H * 0.03)}px ${FONT}`
  for (const tag of project.tags) {
    const tw = ctx.measureText(tag).width + H * 0.05
    if (px + tw > W - pad) break
    roundRect(ctx, px, py, tw, H * 0.06, H * 0.03)
    ctx.fillStyle = rgba(project.color, 0.16)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = rgba(project.color, 0.8)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(tag, px + H * 0.025, py + H * 0.041)
    px += tw + H * 0.02
  }
}
