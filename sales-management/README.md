# Sales Management System

Hệ thống quản lý bán hàng toàn diện tích hợp **nhanh.vn**, chạy trên Docker, deploy tại `https://ql.thuanchay.vn`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + shadcn/ui + Tailwind CSS |
| Backend | Node.js 20 + Express.js |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 + Bull |
| ORM | Prisma |
| Auth | JWT + Refresh Token + bcrypt |
| Proxy | Nginx |
| Container | Docker + Docker Compose |

---

## Cấu trúc dự án

```
sales-management/
├── docker-compose.yml          ← Development
├── docker-compose.prod.yml     ← Production
├── .env.example                ← Mẫu biến môi trường
├── deploy.sh                   ← Script deploy tự động
├── nginx/
│   ├── nginx.conf
│   └── conf.d/sales.conf       ← Config ql.thuanchay.vn
├── backend/
│   ├── Dockerfile
│   ├── prisma/schema.prisma    ← Database schema
│   └── src/
│       ├── app.js              ← Entry point
│       ├── worker.js           ← Background jobs
│       ├── config/             ← DB, Redis, NhanhVN config
│       ├── middleware/         ← Auth, Permission, Webhook, Error
│       ├── modules/            ← Auth, Users, Roles, Products, ...
│       ├── jobs/               ← Bull queue jobs
│       ├── utils/              ← Logger, Response, NhanhVN API
│       └── scripts/seed.js     ← DB seed (roles + admin)
└── frontend/
    ├── Dockerfile
    └── src/
        ├── app/                ← Next.js App Router pages
        ├── components/         ← UI components
        ├── lib/                ← API client, Zustand store, hooks
        └── types/              ← TypeScript types
```

---

## Phân quyền (RBAC)

| Role | Mô tả |
|---|---|
| **ADMIN** | Toàn quyền hệ thống, quản lý users |
| **MANAGER** | Quản lý sản phẩm, kho, đơn hàng, khách hàng, báo cáo |
| **STAFF** | Tạo đơn hàng, quản lý khách hàng |
| **ACCOUNTANT** | Xem và xuất báo cáo |
| **VIEWER** | Chỉ xem |

---

## Cài đặt & Chạy Development

### Yêu cầu
- Docker Desktop
- Node.js 20+ (để chạy ngoài Docker)

### 1. Clone & cấu hình

```bash
git clone <repo-url>
cd sales-management
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn
```

### 2. Khởi động tất cả services

```bash
docker compose up -d
```

### 3. Chạy migrations + seed

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend node src/scripts/seed.js
```

### 4. Truy cập

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:4000/api/v1
- **API Docs (Swagger):** http://localhost:4000/api/docs
- **Admin:** `admin@thuanchay.vn` / `Admin@2024!`

---

## Deploy Production (VPS Hostinger)

### Yêu cầu VPS
- Ubuntu 22.04 LTS
- RAM 8GB, 4 CPU, SSD 100GB
- Domain `ql.thuanchay.vn` đã trỏ DNS A record về IP VPS

### 1. Trỏ DNS

Tại Hostinger DNS Manager, thêm record:
```
Type:  A
Name:  ql
Value: <IP VPS của bạn>
TTL:   300
```

### 2. Upload project lên VPS

```bash
scp -r ./sales-management user@<VPS_IP>:/home/user/
ssh user@<VPS_IP>
cd sales-management
```

### 3. Cấu hình .env

```bash
cp .env.example .env
nano .env
# Điền đầy đủ: DB_PASSWORD, JWT_SECRET, NHANHVN_APP_ID, v.v.
```

### 4. Chạy deploy tự động

```bash
chmod +x deploy.sh
./deploy.sh
```

Script tự động:
1. Cài Docker (nếu chưa có)
2. Copy Nginx config
3. Cấp SSL Let's Encrypt cho `ql.thuanchay.vn`
4. Build & khởi động Docker containers
5. Chạy database migrations
6. Seed dữ liệu ban đầu (roles + admin)
7. Reload Nginx
8. Setup cron tự động renew SSL

### 5. Tránh conflict ports

| Service | Port |
|---|---|
| OpenClaw (existing) | 8080 |
| Paperclip (existing) | 3000 |
| **sales_backend** | 4000 (internal → Nginx) |
| **sales_frontend** | 3001 (internal → Nginx) |
| **Nginx** | 80/443 → route by subdomain |

---

## Cấu hình Nhanh.vn

### Lấy thông tin API

1. Đăng nhập [nhanh.vn](https://nhanh.vn)
2. Vào **Cài đặt → API** → lấy `App ID`, `Business ID`, `Access Token`
3. Điền vào `.env`:
   ```env
   NHANHVN_APP_ID=your_app_id
   NHANHVN_BUSINESS_ID=your_business_id
   NHANHVN_ACCESS_TOKEN=your_access_token
   NHANHVN_SECRET_KEY=your_webhook_secret
   ```

### Đăng ký Webhook URL

1. Vào **Nhanh.vn → Cài đặt → Webhook**
2. Điền URL: `https://ql.thuanchay.vn/webhooks/nhanhvn`
3. Chọn các events: `order_created`, `order_updated`, `order_cancelled`, `product_updated`, `inventory_updated`, `customer_updated`
4. Lưu và test webhook

### Các events được xử lý

| Event | Xử lý |
|---|---|
| `order_created` | Tạo/upsert đơn hàng vào DB local |
| `order_updated` | Cập nhật trạng thái đơn hàng |
| `order_cancelled` | Hủy đơn hàng |
| `product_updated` | Cập nhật sản phẩm |
| `inventory_updated` | Cập nhật số lượng tồn kho |
| `customer_updated` | Tạo/cập nhật khách hàng |

---

## API Reference

### Authentication

```
POST /api/v1/auth/login          — Đăng nhập
POST /api/v1/auth/refresh        — Làm mới token
POST /api/v1/auth/logout         — Đăng xuất
GET  /api/v1/auth/me             — Thông tin user hiện tại
PATCH /api/v1/auth/change-password — Đổi mật khẩu
```

### Products

```
GET    /api/v1/products           — Danh sách (filter, search, paginate)
POST   /api/v1/products           — Tạo mới
GET    /api/v1/products/:id       — Chi tiết
PUT    /api/v1/products/:id       — Cập nhật
DELETE /api/v1/products/:id       — Xóa (soft)
POST   /api/v1/products/:id/sync-nhanhvn — Đồng bộ lên nhanh.vn
GET    /api/v1/products/categories — Danh sách danh mục
```

### Inventory

```
GET  /api/v1/inventory            — Tồn kho hiện tại
POST /api/v1/inventory/import     — Nhập kho
POST /api/v1/inventory/export     — Xuất kho
POST /api/v1/inventory/adjust     — Điều chỉnh
GET  /api/v1/inventory/transactions — Lịch sử giao dịch
GET  /api/v1/inventory/report     — Báo cáo XNT
```

### Orders

```
GET  /api/v1/orders               — Danh sách (filter by status, date)
POST /api/v1/orders               — Tạo đơn hàng
GET  /api/v1/orders/:id           — Chi tiết
PUT  /api/v1/orders/:id/status    — Cập nhật trạng thái
POST /api/v1/orders/:id/sync-nhanhvn — Đồng bộ với nhanh.vn
```

### Sync

```
POST /api/v1/sync/products        — Trigger sync sản phẩm
POST /api/v1/sync/orders          — Trigger sync đơn hàng
POST /api/v1/sync/inventory       — Trigger sync kho
GET  /api/v1/sync/test-connection — Test kết nối nhanh.vn
GET  /api/v1/sync/logs            — Lịch sử sync
```

### Health Check

```
GET /api/v1/health                — Kiểm tra DB + Redis
```

---

## Bảo mật

- **JWT:** Access token 15 phút, Refresh token 7 ngày, tự động rotate
- **Blacklist:** Token bị thu hồi lưu vào Redis (logout, suspended)
- **HMAC:** Webhook từ nhanh.vn được verify chữ ký SHA-256
- **Rate limit:** 500 req/15min (API), 20 req/15min (auth)
- **HTTPS:** Bắt buộc, tự redirect từ HTTP
- **CORS:** Chỉ cho phép domain whitelist

---

## Quản lý containers

```bash
# Xem log
docker compose logs -f backend

# Restart service
docker compose restart backend

# Vào shell container
docker compose exec backend sh

# Chạy migration mới
docker compose exec backend npx prisma migrate deploy

# Xem queue jobs
docker compose exec redis redis-cli KEYS "bull:*"
```

---

## License

MIT © 2024 thuanchay.vn
