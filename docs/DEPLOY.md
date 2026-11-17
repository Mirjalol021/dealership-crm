# Deploy qo'llanmasi — Dealership CRM

Bu hujjat CRM'ni ishlab chiqish (dev) muhitidan real ishlab chiqarish (production)
muhitiga chiqarish uchun to'liq qo'llanma. Loyiha arxitekturasi:

```
┌──────────────────────────────────────────────────────────────┐
│  Bitta Node.js jarayoni (Fastify) :3000                        │
│   ├── /api/*            → REST API (Auth, Leads, Sales, ...)   │
│   └── /*  (SPA)         → client/dist (qurilgan React ilovasi) │
│                                                                │
│  PostgreSQL  ← Prisma ORM                                      │
└──────────────────────────────────────────────────────────────┘
```

**Muhim tamoyil:** frontend va backend **bir xil** manzildan (origin) tarqatiladi —
server `client/dist`ni o'zi serve qiladi. Bu CORS/cookie muammolarini minimallashtiradi.

---

## 0. Talablar (requirements)

| Komponent | Minimal | Izoh |
|-----------|---------|------|
| Node.js | 20 LTS (tavsiya: 22/24) | `node --version` |
| npm | 10+ | |
| PostgreSQL | 14+ | 16 tavsiya |
| RAM | 1 GB | 512 MB ham yetadi |
| OS | Linux (Ubuntu 22.04/24.04) | macOS ham mumkin |
| HTTPS | **majburiy** | prod'da cookie `secure` — faqat HTTPS |

Tekshirish:
```bash
node --version && npm --version && psql --version
```

---

## 1. Muhit o'zgaruvchilari (Environment variables)

`server/.env` fayli (git'ga **commit qilinmaydi**):

```bash
# --- Database ---
DATABASE_URL="postgresql://crm_user:KUCHLI_PAROL@127.0.0.1:5432/dealership_crm?schema=public&connection_limit=10"

# --- Server ---
PORT=3000
NODE_ENV=production

# --- Session (MAJBURIY: >= 32 tasodifiy belgi) ---
# Generatsiya:  openssl rand -hex 32
SESSION_SECRET="<64-belgili-tasodifiy-qiymat>"
SESSION_TTL_HOURS=24

# --- CORS (prod'da faqat haqiqiy domen(lar), vergul bilan) ---
CORS_ORIGINS="https://crm.example.com"

# --- Proxy orqasida ishlayotgan bo'lsangiz (Cloudflare/nginx/LB) MAJBURIY ---
# Aks holda req.ip = proxy IP bo'lib, per-IP login limiti va audit log buziladi.
TRUST_PROXY=true

# --- Login himoyasi ---
LOGIN_MAX_ATTEMPTS=10
LOGIN_WINDOW_MINUTES=15
LOGIN_MAX_ATTEMPTS_PER_IP=50

# --- Til ---
DEFAULT_LANGUAGE=uz
```

### ⚠️ Xavfsizlik qoidalari
- **`SESSION_SECRET`**: server prod'da default/sekal qiymatni rad etadi
  (`config.ts`da tekshiriladi). `openssl rand -hex 32` bilan yarating.
- **`NODE_ENV=production`** bo'lsa: cookie `secure` bo'ladi → **HTTPS shart**.
- **`CORS_ORIGINS`** prod'da bo'sh qolsa ham CSRF origin tekshiruvi ishlaydi
  (faqat ro'yxatdagi originlar qabul qilinadi).
- `TRUST_PROXY=true` — proxy orqasida bo'lsangiz. To'g'ridan-to'g'ri expose
  qilsangiz `false` qoldiring (aks holda hujumchi `X-Forwarded-For`ni soxta qilib
  login limitini chetlab o'tadi).

---

## 2. Ma'lumotlar bazasini tayyorlash

```bash
sudo -u postgres psql <<'SQL'
CREATE USER crm_user WITH PASSWORD 'KUCHLI_PAROL';
CREATE DATABASE dealership_crm OWNER crm_user;
GRANT ALL PRIVILEGES ON DATABASE dealership_crm TO crm_user;
SQL
```

> `DATABASE_URL`dagi parol va foydalanuvchi shu bilan mos bo'lsin.

---

## 3. Build va ishga tushirish

```bash
git clone <repo> dealership-crm && cd dealership-crm

# 3.1 Server bog'liqliklari
cd server
npm ci                      # package-lock bo'yicha aniq o'rnatish

# 3.2 Prisma client + migratsiyalar
npx prisma generate
npx prisma migrate deploy   # prod uchun (dev emas!) — mavjud migratsiyalarni qo'llaydi

# 3.3 Birinchi seed (brendlar, filial, Super Admin)
npx tsx prisma/seed.ts      # faqat BIRINCHI marta. Qayta ishga tushsa ham xavfsiz (idempotent)

# 3.4 Backend build
npm run build               # tsc → server/dist

# 3.5 Frontend build (server/dist'dan serve qilinadi)
cd ../client
npm ci
npm run build               # → client/dist

cd ../server
npm run start               # node dist/index.js  → :3000
```

Yoki ildizdan (dev):
```bash
./start.sh                  # backend (tsx watch) + Vite dev, dev rejimda
```

> **Muhim:** server `client/dist/index.html` mavjudligini tekshiradi. Agar u yo'q
> bo'lsa, faqat API ishlaydi, SPA serve qilinmaydi. Shuning uchun **client'ni
> server'dan OLDIN build qiling** (yoki qayta `npm run start`).

---

## 4. Deploy variantlari

### 4.1 A) Bitta VPS (eng oddiy, tavsiya etiladi)

Ubuntu VPS'da:

```bash
# systemd xizmati: /etc/systemd/system/crm.service
[Unit]
Description=Dealership CRM
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/dealership-crm/server
EnvironmentFile=/opt/dealership-crm/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3
# Xavfsizlik
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crm
sudo systemctl status crm
journalctl -u crm -f          # loglar
```

**nginx** (TLS + reverse proxy):

```nginx
server {
    listen 443 ssl http2;
    server_name crm.example.com;

    ssl_certificate     /etc/letsencrypt/live/crm.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.example.com/privkey.pem;

    client_max_body_size 12m;   # bulk import (10MB body + overhead)

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
server { listen 80; server_name crm.example.com; return 301 https://$host$request_uri; }
```

> nginx orqasida `.env`da **`TRUST_PROXY=true`** qiling.
> Let's Encrypt: `sudo certbot --nginx -d crm.example.com`

### 4.2 B) Cloudflare Tunnel (server'ni internetga to'g'ridan-to'g'ri chiqmasdan)

Eng xavfsiz usul — VPS'ning 443/80 porti yopiq bo'ladi.

**Quick tunnel (test uchun, URL har restart'da o'zgaradi):**
```bash
./tunnel.sh                 # repo ildizida (server + tunnel birga)
# URL chiqadi: https://<random>.trycloudflare.com
```

**Named tunnel (barqaror domen — prod uchun):**
```bash
cloudflared tunnel login
cloudflared tunnel create crm
cloudflared tunnel route dns crm crm.example.com

# ~/.cloudflared/config.yml
tunnel: crm
credentials-file: /home/deploy/.cloudflared/<UUID>.json
ingress:
  - hostname: crm.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```
```bash
sudo cloudflared service install   # systemd xizmati sifatida
```

`.env`: `CORS_ORIGINS=https://crm.example.com`, `TRUST_PROXY=true`.

> To'liq qo'llanma va xatolar: `docs/AUDIT-2026-09-26.md` (L4).

### 4.3 C) Railway / Render / Fly.io (PaaS)

- **Build command:** `cd server && npm ci && npx prisma generate && npm run build && cd ../client && npm ci && npm run build`
- **Start command:** `node server/dist/index.js`
- **Root directory:** repo ildizi (server emas — chunki client ham kerak)
- **Env:** barcha o'zgaruvchilarni panel orqali kiriting.
- **Postgres:** provayderning managed DB'sini qo'shing → `DATABASE_URL`ni ular beradi.
- **Migratsiyalar:** deploy'dan keyin bir marta
  `npx prisma migrate deploy` (yoki release command sifatida).
- HTTPS avtomatik — `CORS_ORIGINS`ni PaaS domeningizga qo'ying.
  PaaS proxy ortida → `TRUST_PROXY=true`.

> ⚠️ `client/dist` server bilan **bir xil** build artefaktida bo'lishi kerak —
> shuning uchun build'dan keyin `client/dist` ham deploy qilinadi (Dockerfile'ga qarang).

### 4.4 D) Docker (konteyner)

Repo ildizida `Dockerfile` yarating:

```dockerfile
# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci
COPY server/ server/
RUN cd server && npx prisma generate && npm run build

COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build

# --- runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/server/package.json server/
COPY --from=build /app/client/dist client/dist
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

> **Diqqat:** server `client/dist`ni `<repo>/client/dist` da kutadi
> (`path.resolve(__dirname, '../../client/dist')`). Konteynerda yuqoridagi
> tuzilma bunga mos keladi (`/app/server/dist` + `/app/client/dist`).
>
> Migratsiya: konteyner start'idan oldin bir marta
> `docker run --rm ... npx prisma migrate deploy` yoki entrypoint skriptida.

```bash
docker build -t crm .
docker run -d --name crm -p 3000:3000 --env-file server/.env crm
```

---

## 5. Yangilash (update / redeploy)

```bash
cd /opt/dealership-crm
git pull

# Backend
cd server
npm ci
npx prisma migrate deploy      # yangi migratsiyalar bo'lsa
npm run build

# Frontend
cd ../client
npm ci
npm run build

# Xizmatni qayta ishga tushirish
sudo systemctl restart crm
```

> `prisma migrate deploy` **hech qachon** ma'lumot o'chirmaydi (xavfsiz). Faqat
> kutayotgan migratsiyalarni qo'llaydi. Dev'dagi `migrate dev` prod'da ishlatilmaydi.

---

## 6. Back up va tiklash (backup / restore)

**Har kuni avtomatik backup** (`crontab -e`):
```bash
0 2 * * * pg_dump "postgresql://crm_user:PAROL@127.0.0.1:5432/dealership_crm" \
  | gzip > /var/backups/crm-$(date +\%F).sql.gz
```

**Tiklash:**
```bash
gunzip -c /var/backups/crm-2026-09-26.sql.gz | psql "postgresql://.../dealership_crm"
```

**Fayllar:** ilova holatsiz (stateless) — faqat DB va `.env` muhim. `.env`ni
xavfsiz joyda (masalan, parol menejeri) saqlang.

---

## 7. Production checklist

Ishga tushishdan oldin:

- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` — `openssl rand -hex 32`, default emas
- [ ] Barcha seed parollari **almashtirildi** (admin/manager/...)
- [ ] `CORS_ORIGINS` = haqiqiy domen(lar)
- [ ] `TRUST_PROXY=true` — agar proxy/tunnel orqasida
- [ ] HTTPS ishlaydi (cookie `secure` uchun shart)
- [ ] PostgreSQL paroli kuchli, tashqi port yopiq
- [ ] `npx prisma migrate deploy` bajarilgan
- [ ] Client `npm run build` qilingan → `client/dist` mavjud
- [ ] Backup cron o'rnatilgan
- [ ] Firewall: tashqi dunyoga faqat 443 (nginx/CF orqali)
- [ ] `docs/AUDIT-2026-09-26.md`dagi ochiq punktlar ko'rib chiqildi

---

## 8. Sog'liqni tekshirish (health / monitoring)

```bash
curl -s https://crm.example.com/api/health      # {"ok":true,"env":"production"}
curl -s -o /dev/null -w "%{http_code}\n" https://crm.example.com/   # 200 (SPA)
```

- Loglar: `journalctl -u crm -f` (systemd) yoki `docker logs -f crm`.
- Xatolar markazlashtirilgan: `server/src/lib/errorHandler.ts` — prod'da
  stack trace'lar mijozga **chiqmaydi**.

---

## 9. Ko'p uchraydigan muammolar

| Alomat | Sabab / Yechim |
|--------|----------------|
| Login `403 CSRF_ORIGIN_REJECTED` | Tunnel/domen URL o'zgargan → `CORS_ORIGINS`ni yangilab, serverni qayta ishga tushiring |
| Login ishlaydi, lekin sessiya saqlanmaydi | HTTPS yo'q (cookie `secure`) yoki `TRUST_PROXY` noto'g'ri |
| `client/dist` serve qilinmaydi (404 SPA) | Client build qilinmagan → `cd client && npm run build`, keyin qayta start |
| Barcha foydalanuvchi "bitta IP" | `TRUST_PROXY=true` qilmagan → per-IP login limiti va audit buziladi |
| Server boot bo'lmaydi | `SESSION_SECRET` < 32 belgi yoki default; `DATABASE_URL` noto'g'ri |
| `Unknown argument` Prisma xatosi | `npx prisma generate` qilinmagan (build'dan oldin) |
| Bulk import `413` | nginx `client_max_body_size` kichik → 12m qiling |
| Migratsiya xatosi prod'da | `migrate dev` emas, `migrate deploy` ishlatilganiga ishonch hosil qiling |

---

## 10. Arxitektura eslatmalari (deploy qarorlarи uchun)

- **Bitta jarayon** API + SPA beradi → CORS/cookie oddiy. Masshtablash kerak
  bo'lsa, stateless (sessiya DB'da) → bir nechta nusxa + yuk balanslagich mumkin,
  lekin **in-memory login throttle** umumiy bo'lmaydi (Redis kerak bo'ladi).
- **Sessiyalar** DB'da (`Session` jadvali) → restart'da foydalanuvchilar chiqmaydi.
- **`TRUST_PROXY`** faqat proxy orqasida `true` — aks holda IP spoofing xavfi.
- **Migratsiyalar** faqat `migrate deploy` bilan (prod). Schema o'zgarishlari
  `schema.prisma` + migratsiya orqali.
