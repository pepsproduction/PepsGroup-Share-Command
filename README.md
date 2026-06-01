# PepsGroup Share Command

> **Manual Share Planner** — ระบบช่วยจัดการคิวโพสต์กลุ่ม Facebook แบบ Manual เท่านั้น

[![Deploy to GitHub Pages](https://github.com/PepsProduction/PepsGroup-Share-Command/actions/workflows/deploy.yml/badge.svg)](https://github.com/PepsProduction/PepsGroup-Share-Command/actions/workflows/deploy.yml)

---

## ⚠️ ข้อสำคัญ

> ระบบนี้เป็นเครื่องมือช่วยจัดการคิวและบันทึกผลเท่านั้น **ไม่ใช่ระบบโพสต์อัตโนมัติ**
>
> ผู้ใช้ต้องเป็นผู้กดโพสต์/แชร์เองทุกครั้ง · ควรอ่านกฎของแต่ละกลุ่มก่อนโพสต์

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 📊 **Dashboard** | ภาพรวมสถิติทั้งหมด |
| 🔍 **Group Finder** | ค้นหาและบันทึกกลุ่ม Facebook |
| 📚 **Group Library** | จัดการกลุ่มทั้งหมด + Search/Filter |
| 🚀 **Campaign Builder** | สร้างและจัดการแคมเปญ |
| ✍️ **Caption Studio** | เขียนแคปชั่น + Variant Generator |
| ☑️ **Group Selector** | เลือกหลายกลุ่มพร้อมกัน |
| 📅 **Schedule Queue** | ตั้งคิวและจัดการเวลาแชร์ |
| ▶️ **Share Session** | แชร์ทีละกลุ่ม Manual |
| ⏳ **Pending Approval** | ติดตามกลุ่มที่รอแอดมิน |
| 📈 **Reports** | รายงาน + Export CSV/JSON |
| ⚙️ **Settings** | ตั้งค่าธีม/หมวดหมู่/Export |

---

## 🚀 วิธีรันโปรเจกต์

### ความต้องการ
- Node.js 18+ 
- npm 9+

### ติดตั้งและรัน

```bash
# ติดตั้ง dependencies
npm install

# รันเซิร์ฟเวอร์พัฒนา
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:5173`

### Build สำหรับ Production

```bash
npm run build
```

ไฟล์ที่ build แล้วจะอยู่ใน `dist/`

---

## 🌐 Deploy บน GitHub Pages

### วิธีที่ 1 — GitHub Actions (แนะนำ)

1. Push โค้ดขึ้น GitHub repository
2. ไปที่ **Settings > Pages**
3. เลือก **Source: GitHub Actions**
4. GitHub Actions จะ build และ deploy อัตโนมัติเมื่อ push ขึ้น `main`

ไฟล์ Workflow: `.github/workflows/deploy.yml`

### วิธีที่ 2 — Manual Deploy

```bash
# Build
npm run build

# Deploy โดยใช้ gh-pages (ต้องติดตั้งก่อน)
npx gh-pages -d dist
```

### การตั้งค่า Base Path

ไฟล์ `vite.config.ts` ตั้งค่า `base` เป็น `/PepsGroup-Share-Command/`

```ts
export default defineConfig({
  plugins: [react()],
  base: '/PepsGroup-Share-Command/',  // ← ชื่อ Repository
})
```

> **หมายเหตุ:** เปลี่ยน `base` ให้ตรงกับชื่อ GitHub Repository ของคุณ

---

## 📁 โครงสร้างไฟล์

```
src/
├── types.ts              # TypeScript type definitions
├── App.tsx               # Main app component + routing
├── main.tsx              # Entry point
├── styles/
│   ├── global.css        # Global styles + components
│   └── theme.css         # Theme variables
├── lib/
│   ├── storage.ts        # localStorage data management
│   ├── exporters.ts      # CSV/JSON export utilities
│   ├── date.ts           # Date formatting utilities
│   ├── facebook.ts       # Facebook URL helpers
│   ├── summary.ts        # Report summary helpers
│   └── seedData.ts       # Sample data
├── components/
│   ├── NotificationCenter.tsx  # Toast + notification bell
│   ├── Modal.tsx               # Modal + ConfirmModal
│   ├── Sidebar.tsx             # Navigation sidebar
│   ├── Header.tsx              # Top header
│   └── Badge.tsx               # Status badges
└── pages/
    ├── Dashboard.tsx
    ├── GroupFinder.tsx
    ├── GroupLibrary.tsx
    ├── CampaignBuilder.tsx
    ├── CaptionStudio.tsx
    ├── GroupSelector.tsx
    ├── ScheduleQueue.tsx
    ├── ShareSession.tsx
    ├── PendingApproval.tsx
    ├── Reports.tsx
    └── Settings.tsx
```

---

## 💾 การเก็บข้อมูล

ข้อมูลทั้งหมดเก็บใน **localStorage** ของเบราว์เซอร์:

| Key | ข้อมูล |
|-----|--------|
| `pgsc_groups` | กลุ่ม Facebook ทั้งหมด |
| `pgsc_posts` | แคปชั่น/โพสต์ |
| `pgsc_campaigns` | แคมเปญ |
| `pgsc_queue` | คิวการแชร์ |
| `pgsc_notifications` | ประวัติการแจ้งเตือน |
| `pgsc_settings` | การตั้งค่า |

**Export/Import:** ไปที่ Settings → จัดการข้อมูล เพื่อ Export หรือ Import JSON

---

## 🛡️ ข้อจำกัด

- ✅ เว็บนี้ **ไม่** auto-post ลง Facebook
- ✅ เว็บนี้ **ไม่** ใช้ Facebook token หรือ API
- ✅ เว็บนี้ **ไม่** scrape Facebook
- ✅ เว็บนี้ **ไม่** auto-click
- ✅ เว็บนี้เป็นเพียง **Manual Share Planner** เท่านั้น
- ✅ ข้อมูลทั้งหมดอยู่ใน Browser ของคุณ ไม่มีเซิร์ฟเวอร์

---

## 🎨 ธีม

| ธีม | รายละเอียด |
|-----|-----------|
| 🔶 Dark Orange | ธีมหลัก (default) |
| 🥇 Dark Gold | ดำ + ทอง |
| 💡 High Contrast | คอนทราสต์สูง |

---

Made with ❤️ by **PepsGroup** · ใช้สำหรับ Manual Share Planner เท่านั้น
