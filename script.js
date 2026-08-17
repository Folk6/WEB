// ============================================================
// script.js — ตรรกะทั้งหมดของหน้า Dashboard ของ MoneyFlow
// ขั้นนี้ทำ 2 อย่าง: (1) เปิด/ปิด modal เพิ่มรายการ
//                     (2) บันทึกรายการลง localStorage แล้วแสดงในรายการล่าสุด
// ============================================================

// ชื่อ key ที่ใช้เก็บข้อมูลใน localStorage (ใช้ตัวแปรกลางกันพิมพ์ผิด)
const STORAGE_KEY = "moneyflow_transactions";

// รายการหมวดหมู่ตั้งต้น แยกตามประเภท "รายจ่าย" กับ "รายรับ"
// แต่ละหมวดมี id (ไว้อ้างอิงในข้อมูล), label (ข้อความที่แสดง), icon (อีโมจิ)
const CATEGORIES = {
  expense: [
    { id: "food", label: "อาหาร", icon: "🍔" },
    { id: "transport", label: "เดินทาง", icon: "🚌" },
    { id: "housing", label: "ที่พัก", icon: "🏠" },
    { id: "education", label: "การศึกษา", icon: "📚" },
    { id: "entertainment", label: "บันเทิง", icon: "🎬" },
    { id: "other_expense", label: "อื่นๆ", icon: "📦" },
  ],
  income: [
    { id: "salary", label: "เงินเดือน", icon: "💰" },
    { id: "family", label: "เงินจากที่บ้าน", icon: "👨‍👩‍👧" },
    { id: "freelance", label: "ฟรีแลนซ์", icon: "💻" },
    { id: "other_income", label: "อื่นๆ", icon: "📦" },
  ],
};

// เดือนภาษาไทยแบบย่อ ไว้ใช้แสดงวันที่ในรายการล่าสุด (index 0 = มกราคม)
const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// ตัวแปรเก็บ "สถานะฟอร์มปัจจุบัน" ที่ผู้ใช้กำลังเลือกอยู่ใน modal
let currentType = "expense"; // เริ่มต้นที่รายจ่าย
let currentCategoryId = null; // ยังไม่เลือกหมวดหมู่

// ดึง element ต่าง ๆ ที่ต้องใช้บ่อยมาเก็บไว้ในตัวแปรก่อน (กันเขียนซ้ำ)
const fabButton = document.getElementById("fab-button");
const modalOverlay = document.getElementById("modal-overlay");
const modalCloseBtn = document.getElementById("modal-close-btn");
const transactionForm = document.getElementById("transaction-form");

const typeExpenseBtn = document.getElementById("type-expense-btn");
const typeIncomeBtn = document.getElementById("type-income-btn");

const amountInput = document.getElementById("amount-input");
const categoryGrid = document.getElementById("category-grid");
const dateInput = document.getElementById("date-input");
const noteInput = document.getElementById("note-input");

const recentListEl = document.getElementById("recent-list");

// ------------------------------------------------------------
// ฟังก์ชันช่วยเหลือทั่วไป
// ------------------------------------------------------------

// คืนค่าวันที่วันนี้ในรูปแบบ "YYYY-MM-DD" (ตรงกับที่ <input type="date"> ต้องการ)
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// สร้าง id ที่ไม่ซ้ำกันแบบง่าย ๆ โดยรวมเวลาปัจจุบันกับตัวเลขสุ่ม
function generateId() {
  return "tx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// แปลงจำนวนเงินหน่วย "สตางค์" (จำนวนเต็ม) ให้เป็นข้อความ "บาท" พร้อมจุดทศนิยม 2 ตำแหน่ง
// เช่น 12550 -> "125.50"
function formatMoney(satang) {
  const baht = satang / 100;
  return baht.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// แปลงวันที่ "YYYY-MM-DD" ให้เป็นข้อความไทยอ่านง่าย เช่น "18 ส.ค. 2569" (ปี พ.ศ.)
function formatDateThai(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const buddhistYear = year + 543; // แปลงปี ค.ศ. เป็น พ.ศ. โดยบวก 543
  const monthName = THAI_MONTHS[month - 1];
  return `${day} ${monthName} ${buddhistYear}`;
}

// หาข้อมูลหมวดหมู่ (label, icon) จาก type และ categoryId ของรายการ
function getCategoryInfo(type, categoryId) {
  const list = CATEGORIES[type] || [];
  return list.find((cat) => cat.id === categoryId);
}

// ------------------------------------------------------------
// ฟังก์ชันจัดการข้อมูลใน localStorage
// ------------------------------------------------------------

// อ่านรายการ transaction ทั้งหมดจาก localStorage (คืนค่าเป็น array เสมอ)
function getTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

// บันทึก array ของ transaction ทั้งหมดกลับลง localStorage
function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ------------------------------------------------------------
// การเปิด / ปิด modal
// ------------------------------------------------------------

function openModal() {
  resetForm();
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

// เคลียร์ฟอร์มกลับไปเป็นค่าเริ่มต้น พร้อมสำหรับกรอกรายการถัดไป
function resetForm() {
  currentType = "expense";
  currentCategoryId = null;

  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = getTodayString();

  updateTypeButtons();
  renderCategoryGrid();
}

// ------------------------------------------------------------
// ปุ่มสลับ รายจ่าย / รายรับ
// ------------------------------------------------------------

function switchType(type) {
  currentType = type;
  currentCategoryId = null; // เปลี่ยนประเภทแล้วต้องเลือกหมวดหมู่ใหม่
  updateTypeButtons();
  renderCategoryGrid();
}

// อัปเดตสีปุ่ม รายจ่าย/รายรับ ให้ปุ่มที่ถูกเลือกเด่นกว่าอีกปุ่ม
function updateTypeButtons() {
  const activeClasses = "text-white";
  const inactiveClasses = "bg-gray-100 text-gray-500";

  if (currentType === "expense") {
    typeExpenseBtn.className = `py-2 rounded-xl font-semibold bg-red-500 ${activeClasses}`;
    typeIncomeBtn.className = `py-2 rounded-xl font-semibold ${inactiveClasses}`;
  } else {
    typeIncomeBtn.className = `py-2 rounded-xl font-semibold bg-green-600 ${activeClasses}`;
    typeExpenseBtn.className = `py-2 rounded-xl font-semibold ${inactiveClasses}`;
  }
}

// ------------------------------------------------------------
// กริดเลือกหมวดหมู่
// ------------------------------------------------------------

// สร้างปุ่มหมวดหมู่ทั้งหมดใหม่ตาม currentType ที่เลือกอยู่
function renderCategoryGrid() {
  const categories = CATEGORIES[currentType];

  // ล้างของเก่าในกริดก่อน แล้วค่อยสร้างใหม่ทั้งหมด
  categoryGrid.innerHTML = "";

  categories.forEach((cat) => {
    const isSelected = cat.id === currentCategoryId;

    const btn = document.createElement("button");
    btn.type = "button"; // สำคัญมาก: ป้องกันไม่ให้ปุ่มนี้ส่งฟอร์มทันทีที่กด
    btn.className = isSelected
      ? "flex flex-col items-center justify-center py-3 rounded-xl border-2 border-blue-500 bg-blue-50"
      : "flex flex-col items-center justify-center py-3 rounded-xl border-2 border-transparent bg-gray-50";

    btn.innerHTML = `
      <span class="text-2xl">${cat.icon}</span>
      <span class="text-xs text-gray-600 mt-1">${cat.label}</span>
    `;

    btn.addEventListener("click", () => {
      currentCategoryId = cat.id;
      renderCategoryGrid(); // สร้างกริดใหม่เพื่ออัปเดตว่าปุ่มไหนถูกเลือก
    });

    categoryGrid.appendChild(btn);
  });
}

// ------------------------------------------------------------
// แสดงรายการล่าสุดในหน้า Dashboard
// ------------------------------------------------------------

function renderRecentTransactions() {
  const transactions = getTransactions();

  // เรียงจากรายการที่สร้างล่าสุดไปเก่าสุด แล้วเอามาแสดงแค่ 3 รายการ
  const recent = [...transactions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  // ยังไม่มีรายการเลย ให้แสดงข้อความบอกผู้ใช้แทน
  if (recent.length === 0) {
    recentListEl.innerHTML = `
      <li class="py-6 text-center text-sm text-gray-400">
        ยังไม่มีรายการ ลองกดปุ่ม + เพื่อเพิ่มรายการแรกของคุณ
      </li>
    `;
    return;
  }

  recentListEl.innerHTML = recent
    .map((tx) => {
      const categoryInfo = getCategoryInfo(tx.type, tx.categoryId);
      const categoryLabel = categoryInfo ? categoryInfo.label : "อื่นๆ";

      // ถ้าผู้ใช้กรอกโน้ตไว้ ให้ใช้โน้ตเป็นชื่อรายการ ถ้าไม่กรอกให้ใช้ชื่อหมวดหมู่แทน
      const title = tx.note && tx.note.trim() !== "" ? tx.note : categoryLabel;

      const isIncome = tx.type === "income";
      const amountText = (isIncome ? "+" : "-") + formatMoney(tx.amount) + " ฿";
      const amountClass = isIncome ? "text-green-600" : "text-red-600";

      return `
        <li class="flex items-center justify-between py-3">
          <div>
            <p class="text-sm font-medium text-gray-800">${title}</p>
            <p class="text-xs text-gray-400">${formatDateThai(tx.date)} · ${categoryLabel}</p>
          </div>
          <p class="text-sm font-semibold ${amountClass}">${amountText}</p>
        </li>
      `;
    })
    .join("");
}

// ------------------------------------------------------------
// การบันทึกฟอร์ม
// ------------------------------------------------------------

function handleFormSubmit(event) {
  event.preventDefault(); // กันไม่ให้หน้าเว็บรีเฟรชแบบฟอร์ม HTML ปกติ

  // ตรวจสอบจำนวนเงินที่กรอก ต้องเป็นตัวเลขและมากกว่า 0
  const amountBaht = parseFloat(amountInput.value);
  if (isNaN(amountBaht) || amountBaht <= 0) {
    alert("กรุณากรอกจำนวนเงินให้ถูกต้อง");
    return;
  }

  // ต้องเลือกหมวดหมู่ก่อนถึงจะบันทึกได้
  if (!currentCategoryId) {
    alert("กรุณาเลือกหมวดหมู่");
    return;
  }

  // แปลงจำนวนเงินจาก "บาท" เป็น "สตางค์" แล้วปัดเศษเป็นจำนวนเต็ม
  // (ใช้ Math.round กันปัญหาทศนิยมของ JavaScript เช่น 125.5 * 100 อาจได้ 12549.999...)
  const amountSatang = Math.round(amountBaht * 100);

  // สร้าง object ตามโครงสร้าง transaction ที่ตกลงกันไว้
  const newTransaction = {
    id: generateId(),
    type: currentType,
    amount: amountSatang,
    categoryId: currentCategoryId,
    note: noteInput.value.trim(),
    date: dateInput.value || getTodayString(),
    createdAt: Date.now(),
  };

  // เอารายการเดิมทั้งหมดมา เพิ่มรายการใหม่เข้าไป แล้วบันทึกกลับ
  const transactions = getTransactions();
  transactions.push(newTransaction);
  saveTransactions(transactions);

  closeModal();
  renderRecentTransactions();
}

// ------------------------------------------------------------
// ผูก Event listener ทั้งหมดเข้ากับปุ่ม/ฟอร์ม
// ------------------------------------------------------------

fabButton.addEventListener("click", openModal);
modalCloseBtn.addEventListener("click", closeModal);

// กดที่ฉากหลังสีดำ (นอกกล่องฟอร์ม) ให้ปิด modal ด้วย
modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

typeExpenseBtn.addEventListener("click", () => switchType("expense"));
typeIncomeBtn.addEventListener("click", () => switchType("income"));

transactionForm.addEventListener("submit", handleFormSubmit);

// ------------------------------------------------------------
// สั่งทำงานทันทีที่โหลดหน้าเสร็จ
// ------------------------------------------------------------

updateTypeButtons();
renderCategoryGrid();
renderRecentTransactions();
