# atillacam.com — 3D Portfolyo

Atilla Çam'ın kişisel web sitesi. Ziyaretçiler fizik tabanlı bir arabayla açık bir dünyada dolaşıp projeleri, yetenekleri ve iletişim bilgilerini keşfediyor. Acelesi olanlar için tek tıkla açılan, hızlı ve SEO dostu bir klasik görünüm de var.

## Özellikler

- **Araç fiziği:** Rapier ışın tabanlı süspansiyon, turbo, zıplama, fren, havada dengelenme, ters dönünce otomatik düzelme
- **Akıcı kamera:** fizik her karede önce çalışır; kamera enterpolasyonlu konumu izler (yüksek Hz ekranlarda titreme yok), hıza göre uzaklaşır
- **Sürüş detayları:** turbo alevi, lastik izleri, toz, temas gölgesi, çarpma sesi ve kamera sarsıntısı
- **Görüş hattı:** kamera ile araç arasına giren ağaç ve nesneler desenli biçimde şeffaflaşır; araç hiç kaybolmaz
- **Atmosfer:** gökyüzünde süzülen bulutlar, gece ateş böcekleri, ışık sütunlu etkileşim portalları
- **Açık dünya:** tepelerle çevrili arazi, göl, çevre yarış yolu, taş kaplama meydanlar
- **Gün-gece döngüsü:** gökyüzü shader'ı, güneş, ay ve yıldızlar; gece yanan sokak lambaları ve araba farları
- **Bitki örtüsü:** rüzgârda sallanan ağaçlar ve çiçekler, arabanın değdiği yerde eğilen 90 bin çimen yaprağı
- **İçerik:** 5 proje panosu, Hakkımda kartı, itilebilir yetenek küpleri, 3D GitHub, LinkedIn ve Instagram logoları
- **Dış bölgeler:** futbol sahası (gol + konfeti), drift pisti (puan ve rekor), skor sayan bowling salonu, arazi parkuru, sinematik manzaralı gözlem tepesi, stunt parkı (rampalar, hızlandırıcı, ateş ve neon halkaları, takla puanı)
- **Mini golf:** arabayla dev topu deliğe sokma; dönen yel değirmeni, tamponlar, par 3 ve en iyi skor
- **Hayalet araba:** yarışta en iyi turunun yarı saydam kopyasıyla yarışırsın
- **Gezinti helikopteri (V):** haritanın üzerinde serbest uçuş; keşif sisi uçarken de açılır, inince araba helikopterin altına gelir
- **Kırılabilir dünya:** banklar, çitler ve tuğla duvarlar çarpınca parçalanır, bir süre sonra yeniden kurulur
- **Hava durumu:** otomatik döngüde yağmur (şimşek ve gök gürültüsü) ve kar; menüden elle seçilebilir
- **Mevsimler:** gerçek takvimden başlayan döngü; ilkbahar çiçekleri, sonbahar yaprakları, kışın kar örtüsü ve buz tutan göl
- **İzler ve su:** karda, kumda, toprakta ve ıslak çimende tekerlek izleri; gölde dalga ve yağmur halkaları
- **Gece detayları:** renkli fener dizileri, neon "İş tekliflerine açık" tabelası, kayan yıldızlar; gündüz kayan bulut gölgeleri
- **Hız:** sabit yapılar tek çizimde birleştirilir (StaticMerge), ince parçalar gölge düşürmez, zayıf ekran kartında düşük kaliteyle açılır, yazı tipleri sitenin karakterlerine indirgenir (`node scripts/subset-fonts.mjs`: sayfa için WOFF2, 3D için TTF)
- **Performans koruması:** FPS sınırı (30/60/sınırsız), takılınca otomatik kalite düşürme, pencere açıkken 24 FPS
- **Patlayan TNT kasaları:** zincirleme patlama, alev topu ve duman
- **Kendini düzeltme:** yan yatan, ters dönen ya da takılan araç kendiliğinden doğrulur
- **Oyun:** kontrol noktalı zamanlı yarış, yerel + dünya skor tablosu, 14 veri çekirdeği, 40 başarım, bowling, rampa
- **Gizli AÇ logoları:** haritaya saklanmış 10 logo; hepsini bulan metalik altın boyayı ve havai fişek gösterisini açar
- **İstanbul dokunuşları:** Galata Kulesi, gölde Kız Kulesi ve etrafında dönen düdüklü şehir hatları vapuru, itilip devrilebilen simitçi tezgâhı
- **Trafik:** çevre yolunda sağdan akan araçlar (sarı taksi dahil); önüne çıkınca durur, yarışta yoldan çekilir
- **Taksi modu:** duraktan 2 dakikalık vardiya; yolcuyu al, GPS ile götür, hızlı varırsan bahşiş
- **Helikopter halka parkuru:** pistten kalk, haritanın üzerindeki 10 halkadan sırayla geç (kılavuz ok, rekor süresi)
- **Sumo arenası:** eğimli platformda üç çarpışan arabayı dışarı it; son kalan kazanır
- **Cüzdan ve garaj dükkânı:** taksi, sumo, halka parkuru, yarış, golf ve başarımlardan ₺ kazan; boya (krom, mat, metalik), neon taban (polis, gün batımı, nabız, gökkuşağı), iz efektleri (alev, yıldız tozu, lale yaprakları), korna (tır, nostaljik tramvay, vapur), tavan (altın taç, Türk bayrağı, çakar) ve turbo alevi rengi satın al. Yalnızca görünüm satılır, yarışlar adil kalır
- **Simitçi:** ₺15'e simit al, 15 saniye simit gücü (yarışta geçersiz)
- **Navigasyon:** yol ağı üzerinde GPS rotası (yerde akan ok şeridi + yön oku), keşfedildikçe açılan harita sisi
- **Laboratuvar ve Kariyer Yolu:** canlı shader / Lorenz çekicisi / fraktal deneyleri; zaman çizelgesi panoları
- **Sürprizler:** arabayla devrilen mühendis heykeli, Konami kodu (↑↑↓↓←→←→BA) ile gökkuşağı boya
- **Fısıltılar:** ziyaretçiler bulundukları yere mesaj bırakır (T); diğerleri yanından geçerken okur
- **Ses tasarımı:** gündüz/gece değişen prosedürel müzik, vitesli motor sesi, lastik sürtünmesi, rüzgâr, yağmur, kuş ve cırcır böceği sesleri (hepsi Web Audio ile üretilir, ses dosyası yok)
- **Canlı dünya:** gerçekçi göl suyu, kuş sürüleri, gölde martılar, kelebekler, süzülen yapraklar, eğime göre kayalaşan arazi dokusu, sinematik açılış
- **Garaj:** iki araç (GLB hatchback ve kodla üretilen spor coupé) ve 6 boya rengi; yeni GLB araç src/game/cars.js ile eklenir
- **Araç fonksiyonları:** el freniyle drift (B/Q), hidrolik (1–5), farlar (F), takip kamerası (C), hız göstergesi
- **Arayüz:** Türkçe/İngilizce, mini harita ve büyük harita ile ışınlanma, bölge başlık kartları, mobil joystick, gamepad, kalite ayarı, ses
- **Gerçek GitHub verileri:** her yayından önce (`prebuild`) proje sayısı, yıldızlar ve son güncellemeler GitHub API'sinden çekilir; bağlantı yoksa kayıtlı veri kullanılır
- **Hazır HTML (SEO):** klasik görünüm derlemede sunucu tarafında çizilir ve `/klasik` adresine tam içerikli sayfa olarak yazılır
- **Analitik:** Vercel Web Analytics ve Speed Insights (çerezsiz); Vercel panelinden etkinleştirilmesi gerekir
- **Erişilebilirlik ve SEO:** klasik görünüm (`?klasik`), JSON-LD, Open Graph görseli, sitemap, WebGL yoksa otomatik geçiş

## Çalıştırma

```bash
npm install
npm run dev       # geliştirme: http://localhost:5173
npm run build     # yayın için dist/
npm run preview   # build'i yerelde dene: http://localhost:4173
npm run lint
```

## İçeriği düzenleme

Bütün metinler **`src/content.js`** içinde. Çift dilli alanlar `{ tr, en }` biçiminde. Arayüz metinleri ise `src/i18n.js` içinde.

- Yeni proje eklemek için `projects` dizisine bir nesne ekle. Pano dünyaya kendiliğinden yerleşir.
- Doğrulanmış bir iş deneyimi eklemek için `experience` dizisini doldur. Dizi boşsa bölüm görünmez.

## 3D modeller

Kaynak modeller `models-src/` klasöründe (toplam yaklaşık 115 MB). Bu klasör boyutu nedeniyle depoya dahil değildir; yalnızca yerel bilgisayarda durur. Optimize edilmiş hâlleri `public/models/` klasöründe (2,8 MB).

```bash
npm run models    # models-src → public/models (+ src/game/credits.json)
```

`scripts/optimize-models.mjs` her modelde şunları yapar:

- eski SpecGloss malzemeleri MetalRough'a çevirir
- dönüşümleri köşelere işler ve metre ölçeğine getirir
- aynı malzemeli parçaları birleştirir ve üçgen sayısını azaltır
- dokuları WebP'ye çevirir
- geometriyi Meshopt ile sıkıştırır

Model ayarları (yükseklik, sadeleştirme oranı, doku boyutu) betiğin başındaki `MODELS` tablosunda.

Bütün modeller **CC BY 4.0** lisanslı. Yazar adları sitede "Emeği geçenler" bölümünde otomatik listelenir. Yeni model eklersen bu bölüm de güncellenir.

`scripts/brand-assets.mjs` dosyası paylaşım görselini (`og-image.png`), favicon'u, uygulama ikonlarını, manifest'i, robots.txt ve sitemap.xml'i üretir.

## Mimari

| Dosya | Görev |
| --- | --- |
| `src/App.jsx` | 3D / klasik görünüm seçimi, hata sınırı. 3D paketi ayrı yüklenir. |
| `src/store.js` | Zustand durumu: dil, kalite, pencereler, yarış, başarımlar (localStorage) |
| `src/game/Game.jsx` | Canvas ve sahne bileşimi |
| `src/game/layout.js` | Dünya yerleşimi: bölgeler, noktalar, lambalar, toplanabilirler |
| `src/game/terrain.js` | Tek yükseklik fonksiyonu: görsel arazi, fizik ve yerleşim aynı değeri kullanır |
| `src/game/Vehicle.jsx` | Araba modeli, araç fiziği, farlar, takip kamerası |
| `src/game/DayNight.jsx` | Gökyüzü, güneş/ay ışığı, lamba ışık havuzu, ortam haritası |
| `src/game/Vegetation.jsx` · `scatter.js` | 30 m'lik hücrelere bölünmüş instanced modeller ve rüzgâr |
| `src/game/Grass.jsx` | GPU çimen shader'ı |
| `src/game/Race.jsx` · `Collectibles.jsx` | Yarış ve veri çekirdekleri |
| `src/game/HiddenLogos.jsx` | Gizli AÇ logoları ve havai fişek |
| `src/game/shop.js` · `Cosmetics.jsx` | Dükkân kataloğu ve ödüller; neon taban, tavan aksesuarları, iz efektleri |
| `src/game/Taxi.jsx` · `SkyRings.jsx` · `Sumo.jsx` | Taksi modu, helikopter halka parkuru, sumo arenası |
| `src/game/Istanbul.jsx` · `Traffic.jsx` | Galata, Kız Kulesi, vapur, simitçi; çevre yolu trafiği |
| `src/game/Effects.jsx` | MSAA, vinyet, ACES ton eşleme |
| `src/game/Skids.jsx` · `Dust.jsx` | Lastik izleri ve toz parçacıkları |
| `src/game/route.js` · `navigation.js` · `RouteLine.jsx` | GPS yol grafı (Dijkstra), keşif sisi, yerdeki rota şeridi |
| `src/game/Showcase.jsx` | Laboratuvar, kariyer yolu, yıkılabilir heykel |
| `src/game/Whispers.jsx` · `src/online.js` | Ziyaretçi fısıltıları ve dünya sıralaması (Supabase REST, yoksa yerel) |
| `src/audio.js` | Web Audio: motor, efektler, ortam sesleri, prosedürel müzik |
| `src/ui/` | Arayüz katmanı ve klasik site |

## Çevrimiçi özellikler (isteğe bağlı)

Fısıltılar ve dünya sıralaması [Supabase](https://supabase.com) ile çalışır. Kurulmazsa site sorunsuz çalışır; fısıltılar yalnızca ziyaretçinin tarayıcısında saklanır, dünya sıralaması gizlenir.

1. supabase.com'da ücretsiz bir proje oluştur.
2. **SQL Editor → New query** ekranına `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run** de. Tablolar, satır güvenliği (RLS) kuralları ve taşma koruması kurulur. Ziyaretçiler yalnızca okuyup ekleyebilir; düzenleme ve silme yalnızca panelden yapılır.
3. **Project Settings → API** sayfasındaki *Project URL* ve *anon public* anahtarını `.env.example` dosyasını örnek alarak `.env.local` dosyasına yaz.
4. Vercel/Netlify'da aynı iki değişkeni (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) ortam değişkeni olarak ekleyip yeniden yayınla.

Uygunsuz bir fısıltıyı silmek için Supabase panelinde **Table Editor → whispers** tablosundan satırı sil.

## Yayınlama (atillacam.com)

`vercel.json` ve `netlify.toml` hazır. Önbellek ve güvenlik başlıkları da bu dosyalarda tanımlı.

**Vercel (önerilen):**

1. Projeyi GitHub'a gönder.
2. vercel.com'da **Add New → Project** ile depoyu seç. Ayarlar otomatik algılanır.
3. **Settings → Domains** bölümüne `atillacam.com` ve `www.atillacam.com` adreslerini ekle.
4. Alan adı sağlayıcının DNS panelinde Vercel'in gösterdiği kayıtları gir (genellikle kök alan adı için `A 76.76.21.21`, www için `CNAME cname.vercel-dns.com`).
