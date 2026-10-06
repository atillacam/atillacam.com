// Sitedeki bütün kişisel içerik burada. 3D dünya da klasik görünüm de bu dosyayı okur.
// Çift dilli alanlar { tr, en } biçimindedir.

export const profile = {
  name: 'Atilla Çam',
  // Dünyanın ortasında fiziksel harfler olarak duran isim
  worldName: 'ATİLLA',
  title: { tr: 'Bilgisayar Mühendisi', en: 'Computer Engineer' },
  // Sitenin her yerinde kullanılan tam unvan (başlık, SEO, paylaşım görseli)
  headline: { tr: 'Bilgisayar Mühendisi · Yazılım Geliştirici', en: 'Computer Engineer · Software Developer' },
  tagline: {
    tr: 'Yapay zekâ destekli, ölçeklenebilir ve sürdürülebilir yazılımlar geliştiriyorum.',
    en: 'I build intelligent, scalable and maintainable software.',
  },
  location: { tr: 'İstanbul, Türkiye', en: 'Istanbul, Türkiye' },
  email: 'atillacam001@gmail.com',
  domain: 'atillacam.com',
  available: true,
  about: {
    tr: [
      'Merhaba, ben Atilla. Karmaşık problemleri sade, güvenilir ve ölçeklenebilir yazılımlara dönüştürmeye odaklanan bir bilgisayar mühendisiyim. Bir fikrin ilk taslağından üretimde çalışan bir sisteme kadar tüm süreci sahiplenmeyi seviyorum.',
      'Uzmanlaştığım alan, yapay zekânın gerçek iş akışlarına entegrasyonu. Büyük dil modellerini (LLM) yapılandırılmış çıktılar ve dayanıklı yedekleme stratejileriyle ürünlere bağlıyor, uçtan uca otomasyon hatları kuruyorum: içerik üretiminden video işlemeye, CI/CD süreçlerinden zamanlanmış görevlere kadar.',
      'Backend mimarisi, temiz kod ve performans benim için birer alışkanlık. Python, C/C++, C#, Java ve TypeScript ile çalışıyor; React ve Three.js ile etkileşimli arayüzler, Flutter ile mobil uygulamalar geliştiriyorum. Docker ve Linux ile kurulumları tekrarlanabilir kılıyor, her projede okunabilir ve test edilebilir bir yapı hedefliyorum.',
      'Şu anda tam zamanlı pozisyonlara ve freelance projelere açığım. Yapay zekâ, backend veya etkileşimli web üzerine çalışan bir ekipseniz konuşalım.',
    ],
    en: [
      "Hi, I'm Atilla, a computer engineer focused on turning complex problems into simple, reliable and scalable software. I enjoy owning the whole journey, from the first sketch of an idea to a system running in production.",
      'My core focus is bringing artificial intelligence into real workflows. I connect large language models to products with structured outputs and resilient fallback strategies, and I build end-to-end automation pipelines, from content generation and video processing to CI/CD and scheduled jobs.',
      'Backend architecture, clean code and performance are habits for me. I work with Python, C/C++, C#, Java and TypeScript, build interactive interfaces with React and Three.js and mobile apps with Flutter. I keep environments reproducible with Docker and Linux, and aim for readable, testable structure in every project.',
      "I'm currently open to full-time roles and freelance projects. If your team works on AI, backend or interactive web, let's talk.",
    ],
  },
  highlights: [
    { value: '5+', label: { tr: 'Açık kaynak proje', en: 'Open-source projects' } },
    { value: '8', label: { tr: 'Programlama dili', en: 'Programming languages' } },
    { value: '24/7', label: { tr: 'Çalışan otomasyonlar', en: 'Running automations' } },
  ],
  socials: [
    { id: 'github', label: 'GitHub', handle: '@atillacam', url: 'https://github.com/atillacam' },
    { id: 'linkedin', label: 'LinkedIn', handle: 'Atilla Çam', url: 'https://www.linkedin.com/in/atilla-%C3%A7am-4437b228a/' },
    { id: 'instagram', label: 'Instagram', handle: '@atillacammm', url: 'https://www.instagram.com/atillacammm' },
  ],
}

export const skills = [
  {
    group: { tr: 'Yapay Zekâ & Otomasyon', en: 'AI & Automation' },
    items: ['LLM Entegrasyonu', 'Google Gemini API', 'Prompt Engineering', 'Structured Output', 'Pydantic', 'Makine Öğrenmesi', 'MoviePy', 'TTS / edge-tts'],
    itemsEn: ['LLM Integration', 'Google Gemini API', 'Prompt Engineering', 'Structured Output', 'Pydantic', 'Machine Learning', 'MoviePy', 'TTS / edge-tts'],
  },
  {
    group: { tr: 'Diller', en: 'Languages' },
    items: ['Python', 'C', 'C++', 'C#', 'Java', 'JavaScript', 'TypeScript', 'Dart', 'SQL'],
  },
  {
    group: { tr: 'Backend & Veri', en: 'Backend & Data' },
    items: ['Node.js', 'REST API', 'Asenkron Programlama', 'PostgreSQL', 'MySQL', 'Sistem Tasarımı', 'OOP & Tasarım Desenleri'],
    itemsEn: ['Node.js', 'REST APIs', 'Async Programming', 'PostgreSQL', 'MySQL', 'System Design', 'OOP & Design Patterns'],
  },
  {
    group: { tr: 'Frontend, 3D & Mobil', en: 'Frontend, 3D & Mobile' },
    items: ['React', 'Three.js', 'React Three Fiber', 'WebGL', 'Flutter', 'HTML & CSS', 'Vite'],
  },
  {
    group: { tr: 'DevOps & Araçlar', en: 'DevOps & Tools' },
    items: ['Docker', 'Linux', 'Git', 'GitHub Actions', 'CI/CD', 'VS Code'],
  },
]

// Hakkımda bölgesinde itilebilir küpler olarak duran yetenekler
export const skillCubes = ['Python', 'C++', 'C#', 'Java', 'TS', 'React', 'Docker', 'Linux', 'AI', 'SQL']

// Kariyer Yolu kilometre taşları (dünyada batıdaki yol boyunca dizilir).
// Yalnızca doğrulanabilen bilgiler var; eğitim ve iş deneyimini buraya ekleyebilirsin.
export const career = [
  { year: '2025', title: { tr: 'GitHub yolculuğu başladı', en: 'Started on GitHub' }, text: { tr: 'Açık kaynak projelerimi yayımlamaya başladım.', en: 'Began publishing my open-source work.' } },
  { year: '2026', title: { tr: 'Yapay zekâ içerik hatları', en: 'AI content pipelines' }, text: { tr: 'Gemini ile uçtan uca video ve içerik üreten otomasyonlar.', en: 'End-to-end video and content automation with Gemini.' } },
  { year: '2026', title: { tr: 'Mobil uygulama', en: 'Mobile app' }, text: { tr: 'Flutter ile öğrenciler için YKS uygulaması.', en: 'A Flutter exam-prep app for students.' } },
  { year: '2026', title: { tr: 'Otomasyon ve CI', en: 'Automation & CI' }, text: { tr: 'GitHub Actions ile bulutta çalışan zamanlanmış görevler.', en: 'Scheduled cloud jobs with GitHub Actions.' } },
  { year: '2026', title: { tr: 'atillacam.com', en: 'atillacam.com' }, text: { tr: 'Fizik motorlu, sürülebilir 3D portfolyo.', en: 'A drivable 3D portfolio with a physics engine.' } },
]

// Laboratuvar: sitenin içinde gerçek zamanlı çalışan küçük deneyler
export const labExperiments = [
  { id: 'shader', title: { tr: 'Gürültü Küresi', en: 'Noise Sphere' }, text: { tr: 'GPU üzerinde gürültüyle şekil değiştiren küre (GLSL).', en: 'A sphere deformed by noise on the GPU (GLSL).' } },
  { id: 'attractor', title: { tr: 'Lorenz Çekicisi', en: 'Lorenz Attractor' }, text: { tr: 'Kaos teorisinin ünlü çekicisi, binlerce parçacıkla.', en: 'The famous chaos-theory attractor, with thousands of particles.' } },
  { id: 'fractal', title: { tr: 'Fraktal Küp', en: 'Fractal Cube' }, text: { tr: 'Kendini tekrar eden Menger süngeri.', en: 'A self-similar Menger sponge.' } },
  { id: 'speed', title: { tr: 'Hız Görselleştirici', en: 'Speed Visualiser' }, text: { tr: 'Arabanın hızına ve motoruna tepki veren çubuklar.', en: 'Bars reacting to your car speed and engine.' } },
]

// Doğrulanmış bir iş geçmişi eklemek istersen burayı doldur; boşsa bölüm görünmez.
export const experience = []

// Her proje dünyada bir reklam panosu olarak görünür.
export const projects = [
  {
    id: 'shorts-generator',
    title: 'AI YouTube Shorts Generator',
    year: '2026',
    color: '#ff5d5d',
    tags: ['Python', 'Gemini API', 'MoviePy', 'edge-tts'],
    summary: {
      tr: 'Tek komutla senaryodan seslendirmeye, altyazıdan müziğe hazır dikey video üreten uçtan uca yapay zekâ hattı.',
      en: 'An end-to-end AI pipeline that turns a single prompt into a finished vertical video: script, voice-over, captions and music.',
    },
    description: {
      tr: [
        'Google Gemini ile viral giriş cümleleri ve 30 saniyelik senaryolar üretir; her sahne için arka plan arama etiketlerini otomatik çıkarır.',
        'Pixabay Video API’den temaya uygun dikey klipler bulur, indirir ve 1080×1920 / 24 FPS formatına normalize ederek tek bir dinamik arka plana birleştirir.',
        'edge-tts ile doğal seslendirme, kelime kelime TikTok tarzı altyazılar ve otomatik ses kısma (ducking) ile müzik miksajı yapar. SEO uyumlu başlık, açıklama ve etiketleri JSON olarak dışa aktarır.',
      ],
      en: [
        'Uses Google Gemini to write viral hooks and 30-second scripts, automatically tagging each scene with background search queries.',
        'Finds matching vertical clips via the Pixabay Video API, then normalises and stitches them into a single dynamic 1080×1920 / 24 FPS background.',
        'Generates natural voice-overs with edge-tts, word-by-word TikTok-style captions and music mixing with automatic ducking. Exports SEO-ready titles, descriptions and tags as JSON.',
      ],
    },
    link: 'https://github.com/atillacam/youtube-shorts-generator',
  },
  {
    id: 'shorts-pipeline',
    title: 'AI Shorts Pipeline',
    year: '2026',
    color: '#ffb547',
    tags: ['Python', 'Gemini', 'Pydantic', 'JSON Schema'],
    summary: {
      tr: 'Gemini’nin yapılandırılmış çıktısıyla seslendirme metni ve görsel üretim promptları oluşturan dayanıklı içerik motoru.',
      en: 'A resilient content engine that produces voice-over scripts and image-generation prompts with Gemini structured output.',
    },
    description: {
      tr: [
        'Pydantic şeması ve JSON Schema ile modelden her zaman doğrulanmış, tip güvenli çıktı alır; serbest metin ayrıştırma hatalarını ortadan kaldırır.',
        'Sunucu yoğunluğu (503) ve API hatalarında sırayla yedek modellere geçerek kesintisiz çalışır.',
        'Her senaryo için giriş, gelişme ve vurucu final aşamalarına uygun, dikey formatta üç sinematik görsel promptu hazırlar.',
      ],
      en: [
        'Gets validated, type-safe output from the model every time using a Pydantic schema and JSON Schema, eliminating free-text parsing errors.',
        'Stays online through server overloads (503) and API errors by falling back to alternative models in order.',
        'Prepares three cinematic, vertical image prompts for each script, matching its intro, build-up and punchline.',
      ],
    },
    link: 'https://github.com/atillacam/ai-shorts-pipeline',
  },
  {
    id: 'yks-app',
    title: { tr: 'YKS Mobil Uygulaması', en: 'YKS Mobile App' },
    year: '2026',
    color: '#3d7bff',
    tags: ['Flutter', 'Dart', 'Material UI', 'Validation'],
    summary: {
      tr: 'Üniversite sınavına hazırlanan öğrenciler için kullanıcı hesabı ve profil akışlarına sahip Flutter uygulaması.',
      en: 'A Flutter app for students preparing for the Turkish university entrance exam, with full account and profile flows.',
    },
    description: {
      tr: [
        'Giriş, kayıt, şifremi unuttum ve profil ekranlarından oluşan eksiksiz bir kimlik doğrulama akışı.',
        'E-posta, telefon, şifre ve tarih alanlarında kapsamlı doğrulama; “Beni hatırla” ve kayıtlı hesap seçimi.',
        'KVKK ve açık rıza onaylarını zorunlu tutan, mevzuata uygun kayıt süreci.',
      ],
      en: [
        'A complete authentication flow with sign-in, sign-up, password recovery and profile screens.',
        'Thorough validation for e-mail, phone, password and date fields, plus “Remember me” and saved-account selection.',
        'A regulation-compliant sign-up that requires KVKK (Turkish GDPR) and explicit consent approval.',
      ],
    },
    link: 'https://github.com/atillacam/new.yks',
  },
  {
    id: 'daily-streak',
    title: 'Daily Streak Keeper',
    year: '2026',
    color: '#2ec4b6',
    tags: ['Python', 'GitHub Actions', 'Cron', 'Automation'],
    summary: {
      tr: 'Bilgisayar kapalıyken bile bulutta çalışan, zamanlanmış GitHub Actions otomasyonu.',
      en: 'A scheduled GitHub Actions automation that runs in the cloud, even when your computer is off.',
    },
    description: {
      tr: [
        'Cron tetikleyicileriyle günde birkaç kez çalışan bulut tabanlı bir iş akışı.',
        'README dosyasını her çalışmada istatistikler, TRT/UTC zaman damgaları ve günün notuyla otomatik günceller.',
        'Sunucusuz, bakım gerektirmeyen ve tamamen sürüm kontrolünde tutulan bir otomasyon örneği.',
      ],
      en: [
        'A cloud-based workflow triggered several times a day with cron schedules.',
        'Automatically updates its README on every run with statistics, TRT/UTC timestamps and a quote of the day.',
        'A serverless, zero-maintenance automation kept entirely under version control.',
      ],
    },
    link: 'https://github.com/atillacam/daily-streak',
  },
  {
    id: 'portfolio',
    title: { tr: 'atillacam.com — 3D Portfolyo', en: 'atillacam.com — 3D Portfolio' },
    year: '2026',
    color: '#9b7bff',
    tags: ['React', 'Three.js', 'Rapier', 'WebGL'],
    summary: {
      tr: 'Şu an içinde gezdiğin site: fizik motorlu, gün-gece döngülü, arabayla keşfedilen açık dünya portfolyo.',
      en: 'The site you are driving in right now: an open-world portfolio with a physics engine and a day-night cycle.',
    },
    description: {
      tr: [
        'React Three Fiber ve Three.js ile çizilen dünya; Rapier ile ışın tabanlı süspansiyonlu araç fiziği.',
        'Gün-gece döngüsü, gece yanan sokak lambaları, rüzgârda sallanan bitki örtüsü, zamanlı yarış pisti ve toplanabilir nesneler.',
        '115 MB’lık kaynak modeller özel bir glTF hattıyla 4,5 MB’a indirildi; WebGL olmayan cihazlar için erişilebilir klasik görünüm.',
      ],
      en: [
        'A world rendered with React Three Fiber and Three.js, with ray-cast suspension car physics powered by Rapier.',
        'A day-night cycle, street lamps that light up at night, wind-swept vegetation, a timed race track and collectibles.',
        '115 MB of source models squeezed to 4.5 MB with a custom glTF pipeline, plus an accessible classic view for devices without WebGL.',
      ],
    },
    link: 'https://github.com/atillacam/atillacam.com',
  },
]
