// ============================================================
// colors.js — สีประจำแต่ละหมวดหมู่ กำหนดไว้ที่เดียวในไฟล์นี้
// ทั้งกราฟ (Chart.js) และหน้ารายการต่าง ๆ เรียกใช้ค่าจากที่นี่ทั้งหมด
// เพื่อให้สีของหมวดหมู่เดียวกันตรงกันทุกที่ในแอป
//
// สำคัญ: ไฟล์นี้ต้องถูกโหลดก่อน script.js เสมอ (ดูลำดับ <script> ใน index.html)
// ============================================================

// key = categoryId (ต้องตรงกับ id ใน CATEGORIES ของ script.js), value = สี hex
const CATEGORY_COLORS = {
  // หมวดรายจ่าย
  food: "#f97316", // ส้ม
  transport: "#3b82f6", // ฟ้า
  housing: "#8b5cf6", // ม่วง
  education: "#06b6d4", // ฟ้าอมเขียว
  entertainment: "#ec4899", // ชมพู
  other_expense: "#6b7280", // เทา

  // หมวดรายรับ
  salary: "#22c55e", // เขียว
  family: "#eab308", // เหลือง
  freelance: "#14b8a6", // เขียวอมฟ้า
  other_income: "#94a3b8", // เทาอมฟ้า
};

// คืนสีของหมวดหมู่ตาม id ถ้าไม่เจอ (เช่น หมวดใหม่ที่ลืมใส่สี) ใช้สีเทาเป็นค่า default กันโค้ดพัง
function getCategoryColor(categoryId) {
  return CATEGORY_COLORS[categoryId] || "#9ca3af";
}
