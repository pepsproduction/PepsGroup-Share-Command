# PGSC Facebook Share Helper — Extension

> **เวอร์ชัน:** 1.1.0  
> **ใช้งานร่วมกับ:** [PepsGroup Share Command](https://pepsproduction.github.io/PepsGroup-Share-Command/)

---

## 📖 คืออะไร?

Extension นี้ช่วยให้ระบบ PepsGroup Share Command สามารถ **แชร์โพสต์ Facebook ไปยังหลายกลุ่มโดยอัตโนมัติ** ผ่าน Native Share Dialog ของ Facebook เอง โดยจำลอง flow แบบชัดเจน: เปิดโพสต์ → กดลูกศรแชร์ → เลือกกลุ่ม → ค้นหาชื่อกลุ่ม → เลือกผลลัพธ์แรก → วางแคปชั่น → โพสต์

---

## 🔧 ขั้นตอนติดตั้ง (Developer Mode)

### 1. สร้าง Icons (ถ้ายังไม่มี)
```bash
node create_icons.cjs
```

### 2. เปิด Chrome Extensions
- เปิด Chrome
- ไปที่ `chrome://extensions/`
- เปิด **Developer mode** (มุมขวาบน)

### 3. โหลด Extension
- คลิก **"Load unpacked"**
- เลือกโฟลเดอร์ `pgsc-extension/` (โฟลเดอร์ที่มี `manifest.json`)
- Extension จะปรากฏในรายการ

### 4. จดหมาย Extension ID
- Copy **Extension ID** จากหน้า Extensions (ตัวเลข/ตัวอักษร 32 ตัว)
- นำไปกรอกในเว็บ PepsGroup Share Command ที่ส่วน Settings หรือหน้า Auto Share

---

## 🚀 วิธีใช้งาน

1. **ไปที่เว็บ PepsGroup Share Command** → หน้า **Share Session**
2. ถ้า Extension ติดตั้งถูกต้อง จะมีปุ่ม **"🤖 Auto Share (Extension)"** ปรากฏขึ้น
3. กรอก **URL โพสต์ Facebook** ที่ต้องการแชร์
4. เลือกแคมเปญ (ระบบจะดึงกลุ่มที่อยู่ในคิว)
5. คลิก **"เริ่ม Auto Share"**
6. Extension จะเปิดแท็บ Facebook และเริ่มแชร์ให้อัตโนมัติ
7. ดูความคืบหน้าในหน้าเว็บและใน Popup ของ Extension

## 🔁 ลำดับ Auto Share

ต่อหนึ่งกลุ่ม ระบบจะทำงานตามลำดับนี้เสมอ:

1. เปิด/รีโหลดลิงก์โพสต์ที่กำหนดไว้
2. หาปุ่มลูกศรแชร์บนโพสต์และกด
3. เลือกเมนู **กลุ่ม / Share to a group**
4. พิมพ์ชื่อกลุ่มจากคิวลงช่องค้นหากลุ่ม
5. เลือกกลุ่มบรรทัดแรกที่ตรงกับชื่อ
6. วางแคปชั่นในช่องเขียนโพสต์
7. กด **โพสต์**
8. ถ้าเจอกล่องจำกัดจำนวนการโพสต์ ระบบจะกดปิด/ยกเลิก, บันทึกเป็น `skipped`, แล้วข้ามไปกลุ่มถัดไปทันที

---

## ⚠️ ข้อควรทราบ

- Facebook อาจเปลี่ยน DOM ทำให้ Extension ต้องอัปเดต
- ระบบจะหน่วงเวลา 4-9 วินาที ระหว่างแต่ละกลุ่ม เพื่อความปลอดภัย
- ถ้า Facebook แจ้งจำกัดจำนวนการโพสต์ ระบบจะหน่วงเพียงสั้น ๆ แล้วไปกลุ่มถัดไป
- หากกลุ่มต้องรอแอดมินอนุมัติ ระบบจะบันทึกเป็น `pending_admin`
- รองรับทั้ง `www.facebook.com` และ `web.facebook.com`
- ไม่ใช้ Facebook API หรือ Token ใดๆ ทั้งสิ้น

---

## 📁 โครงสร้างไฟล์

```
pgsc-extension/
├── manifest.json       # Extension config
├── background.js       # Service worker
├── fb_content.js       # Automation script (Facebook)
├── pgsc_bridge.js      # Bridge script (Web App)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── popup.css           # Popup styles
├── create_icons.cjs    # Icon generator
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
