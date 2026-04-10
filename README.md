# 📊 Business Manager - Phần mềm Quản lý Kinh doanh & Kế toán

Hệ thống quản lý kinh doanh toàn diện cho doanh nghiệp bán thiết bị + gói cước dịch vụ hàng tháng.

## 🚀 Tính năng chính

### Quản lý bán hàng
- **Sản phẩm/Thiết bị**: CRUD, phân loại, serial/IMEI, 4 mức giá (giá vốn, bán lẻ, ĐL cấp 1, ĐL cấp 2)
- **Gói cước dịch vụ**: Tháng/quý/năm, tự động tính cước gia hạn
- **Khách hàng**: 3 nhóm (Đại lý cấp 1, Đại lý cấp 2, Khách lẻ), tự động áp giá theo nhóm
- **Đơn hàng bán**: Tạo đơn nhanh, tự động trừ kho, tính lợi nhuận, thanh toán (tiền mặt/CK/công nợ)
- **Nhà cung cấp & Nhập hàng**: Quản lý NCC, tạo đơn nhập, tự động cộng kho

### Kho & Tồn kho
- Tổng quan tồn kho, giá trị, cảnh báo tồn thấp
- Lịch sử xuất/nhập kho, điều chỉnh kho thủ công

### Kế toán & Công nợ
- Công nợ phải thu/phải trả, cảnh báo quá hạn
- Thu tiền tự động phân bổ FIFO, trả tiền NCC

### Thuê bao & Gia hạn
- Quản lý thuê bao, sắp hết hạn, tính cước hàng loạt, gia hạn

### Hóa đơn & Xuất nhập khẩu dữ liệu
- Hóa đơn PDF, báo giá PDF
- Xuất/nhập Excel/CSV

### Báo cáo
- Dashboard KPI + biểu đồ
- Doanh thu theo ngày/tháng/quý/năm, theo KH, theo nhóm KH
- Lợi nhuận theo SP, tồn kho, công nợ

### Hệ thống
- 5 vai trò: Admin, Quản lý, Kế toán, Kinh doanh, Kho
- Audit log, Backup/Restore database

---

## 🛠️ Công nghệ

| Thành phần | Công nghệ |
|-----------|-----------|
| Backend | Node.js, Express.js |
| Database | PostgreSQL 15+ |
| Query Builder | Knex.js |
| Frontend | React 18, Ant Design 5 |
| Charts | Recharts |
| Auth | JWT + bcrypt |
| PDF | PDFKit |
| Excel | ExcelJS |
| Container | Docker + Docker Compose |

---

## 📦 Cài đặt

### Yêu cầu
- Node.js 18+
- PostgreSQL 14+
- npm hoặc yarn

### 1. Cài đặt

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Cấu hình database

```bash
# Tạo database
createdb business_manager

# Cấu hình backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=business_manager
DB_USER=postgres
DB_PASSWORD=postgres123
```

### 3. Migration & Seed data

```bash
cd backend
npx knex migrate:latest --knexfile src/config/knexfile.js
npx knex seed:run --knexfile src/config/knexfile.js
```

### 4. Khởi chạy

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3000)
cd frontend
npm start
```

### 5. Docker

```bash
docker-compose up -d
# Truy cập: http://localhost:3000
```

---

## 👤 Tài khoản mặc định

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| admin@company.com | Admin@123 | Admin |
| ketoan@company.com | Ketoan@123 | Kế toán |
| kinhdoanh@company.com | Kinhdoanh@123 | Kinh doanh |
| kho@company.com | Kho@123 | Kho |
| quanly@company.com | Quanly@123 | Quản lý |

---

## 📁 Cấu trúc dự án

```
├── backend/
│   ├── src/
│   │   ├── config/          # Database & Knex config
│   │   ├── migrations/      # Database schema (21 tables)
│   │   ├── seeds/           # Sample data
│   │   ├── middleware/       # Auth, validation, audit
│   │   ├── routes/          # 14 API route modules
│   │   ├── utils/           # PDF, Excel, Backup
│   │   └── index.js         # Entry point
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # MainLayout
│   │   ├── pages/           # 14 page components
│   │   ├── services/        # API service layer
│   │   ├── App.js           # Router
│   │   └── index.js
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## 📡 API Endpoints

| Module | Endpoints |
|--------|----------|
| Auth | POST /api/auth/login, GET /api/auth/me |
| Users | CRUD /api/users |
| Customers | CRUD /api/customers |
| Products | CRUD /api/products |
| Service Plans | CRUD /api/service-plans |
| Suppliers | CRUD /api/suppliers |
| Sales Orders | CRUD /api/sales-orders |
| Purchase Orders | CRUD /api/purchase-orders |
| Inventory | GET /api/inventory, POST /api/inventory/adjust |
| Subscriptions | GET /api/subscriptions, POST batch-billing |
| Payments | POST /api/payments/receive, /pay |
| Invoices | CRUD /api/invoices |
| Reports | GET /api/reports/dashboard, /sales, ... |
| Data Exchange | POST /api/data/export, /import |

---

## 📄 License

MIT License
