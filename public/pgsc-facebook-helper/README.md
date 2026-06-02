# PGSC Facebook Helper

ตัวช่วยนี้เป็น Chrome/Edge extension สำหรับ PepsGroup Share Command

เมื่อกดปุ่ม `เปิดกลุ่ม & คัดลอกแคปชั่น (ใช้แท็บเดิม)` ใน Share Session:

- เว็บหลักจะเปิดกลุ่ม Facebook ในแท็บเดิมที่จำไว้
- extension จะรับแคปชั่นล่าสุดจากเว็บหลัก
- extension จะจำแท็บ Facebook ด้วย tab id และเปิดกลุ่มถัดไปในแท็บเดิมเสมอ
- บนหน้า Facebook extension จะคลิกช่องเขียนโพสต์ เช่น `เขียนอะไรสักหน่อย...`
- extension จะวางแคปชั่นให้ในช่องโพสต์
- extension จะไม่กดปุ่มโพสต์หรือแชร์ให้เอง

## วิธีติดตั้ง

1. เปิด Chrome หรือ Edge แล้วเข้า `chrome://extensions`
2. เปิด `Developer mode`
3. กด `Load unpacked`
4. เลือกโฟลเดอร์นี้: `public/pgsc-facebook-helper`
5. เปิด PepsGroup Share Command แล้วใช้งาน Share Session ได้เลย

## หมายเหตุ

- ต้องติดตั้ง extension นี้ก่อน ระบบถึงจะคลิกช่องเขียนโพสต์และวางข้อความบน Facebook ให้ได้
- ถ้าไม่ได้ติดตั้ง extension ปุ่มยังเปิดแท็บเดิมและคัดลอกแคปชั่นลง clipboard ตามปกติ
- extension เก็บเฉพาะคำสั่งล่าสุดใน storage ของ browser และลบออกหลังวางข้อความสำเร็จ
