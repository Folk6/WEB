// ============================================================
// script.js — ตรรกะทั้งหมดของ MoneyFlow
// ตอนนี้ทำได้: (1) เปิด/ปิด modal เพิ่ม/แก้ไขรายการ
//             (2) บันทึก/แก้ไข/ลบรายการใน localStorage
//             (3) แสดง "รายการล่าสุด" ที่หน้าแรก และ "รายการทั้งหมด" แยกกลุ่มตามวันที่
//             (4) ตั้งงบประมาณรายเดือน + คำนวณการ์ดสรุปจากข้อมูลจริงทั้งหมด
//             (5) กราฟโดนัทสัดส่วนรายจ่ายที่หน้าแรก + หน้า "รายงาน" กราฟแท่งเทียบรายรับ-รายจ่าย
// ต้องโหลด colors.js ก่อนไฟล์นี้เสมอ (ใช้ getCategoryColor() จากไฟล์นั้น)
// ============================================================

// ชื่อ key ที่ใช้เก็บข้อมูลใน localStorage (ใช้ตัวแปรกลางกันพิมพ์ผิด)
const STORAGE_KEY = "moneyflow_transactions";

// key ที่ใช้เก็บ "งบประมาณ" แยกตามเดือน เช่น { "2026-08": 1200000 } (หน่วยสตางค์)
const BUDGET_STORAGE_KEY = "moneyflow_budget";

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

// ถ้าเป็น null แปลว่ากำลัง "เพิ่มรายการใหม่"
// ถ้ามีค่า (เท่ากับ id ของรายการ) แปลว่ากำลัง "แก้ไขรายการเดิม"
let editingId = null;

// ช่วงเวลาที่กำลังเลือกอยู่ในหน้ารายงาน ("month" | "3m" | "6m" | "year")
let currentReportRange = "month";

// เก็บ instance ของกราฟ Chart.js ไว้ เพื่อ destroy ของเดิมก่อนวาดใหม่ทุกครั้ง
// (ถ้าไม่ destroy ก่อน Chart.js จะวาดกราฟซ้อนทับกันเละ)
let expenseDoughnutChart = null;
let reportBarChart = null;

// ดึง element ต่าง ๆ ที่ต้องใช้บ่อยมาเก็บไว้ในตัวแปรก่อน (กันเขียนซ้ำ)
const fabButton = document.getElementById("fab-button");
const modalOverlay = document.getElementById("modal-overlay");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalTitle = document.getElementById("modal-title");
const transactionForm = document.getElementById("transaction-form");

const typeExpenseBtn = document.getElementById("type-expense-btn");
const typeIncomeBtn = document.getElementById("type-income-btn");

const amountInput = document.getElementById("amount-input");
const categoryGrid = document.getElementById("category-grid");
const dateInput = document.getElementById("date-input");
const noteInput = document.getElementById("note-input");

const recentListEl = document.getElementById("recent-list");

// element ของ 2 หน้าจอหลัก (หน้าแรก / รายการทั้งหมด) และแถบเมนูล่าง
const viewHome = document.getElementById("view-home");
const viewTransactions = document.getElementById("view-transactions");
const navHomeBtn = document.getElementById("nav-home-btn");
const navListBtn = document.getElementById("nav-list-btn");
const allTransactionsListEl = document.getElementById("all-transactions-list");

// element ของการ์ดสรุปงบประมาณที่หน้าแรก
const budgetRemainingTextEl = document.getElementById("budget-remaining-text");
const budgetProgressBarEl = document.getElementById("budget-progress-bar");
const dailyAllowanceTextEl = document.getElementById("daily-allowance-text");
const editBudgetBtn = document.getElementById("edit-budget-btn");
const incomeTotalEl = document.getElementById("income-total");
const expenseTotalEl = document.getElementById("expense-total");

// element ของกราฟโดนัทที่หน้าแรก
const expenseChartCanvas = document.getElementById("expense-doughnut-chart");
const expenseChartEmptyEl = document.getElementById("expense-chart-empty");
const expenseChartWrapperEl = document.getElementById("expense-chart-wrapper");
const expenseChartLegendEl = document.getElementById("expense-chart-legend");
const expenseChartSummaryEl = document.getElementById("expense-chart-summary");

// element ของหน้า "รายงาน"
const viewReports = document.getElementById("view-reports");
const navReportBtn = document.getElementById("nav-report-btn");
const reportRangeButtons = document.querySelectorAll(".report-range-btn");
const reportChartCanvas = document.getElementById("report-bar-chart");
const reportChartEmptyEl = document.getElementById("report-chart-empty");
const reportChartSummaryEl = document.getElementById("report-chart-summary");

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

// คืนค่า "เดือนปัจจุบัน" ในรูปแบบ "YYYY-MM" เช่น "2026-08" ใช้เป็น key ของงบประมาณ
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

// อ่านงบประมาณของทุกเดือนจาก localStorage (คืนค่าเป็น object เสมอ)
// รูปแบบ: { "2026-08": 1200000, "2026-09": 1000000 }
function getAllBudgets() {
  const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
  if (!raw) return {};
  return JSON.parse(raw);
}

// อ่านงบประมาณของเดือนที่ระบุ (หน่วยสตางค์) ถ้ายังไม่เคยตั้งไว้จะได้ 0
function getBudgetForMonth(monthKey) {
  const budgets = getAllBudgets();
  return budgets[monthKey] || 0;
}

// บันทึกงบประมาณของเดือนที่ระบุ โดยไม่ทับงบของเดือนอื่น
function saveBudgetForMonth(monthKey, amountSatang) {
  const budgets = getAllBudgets();
  budgets[monthKey] = amountSatang;
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
}

// ------------------------------------------------------------
// การเปิด / ปิด modal
// ------------------------------------------------------------

// เปิด modal สำหรับ "เพิ่มรายการใหม่" (กดจากปุ่ม + ลอย)
function openModal() {
  editingId = null; // ไม่ได้แก้ไขรายการไหนอยู่ = โหมดเพิ่มใหม่
  modalTitle.textContent = "เพิ่มรายการ";
  resetForm();
  modalOverlay.classList.remove("hidden");
}

// เปิด modal สำหรับ "แก้ไขรายการเดิม" พร้อมเติมข้อมูลเดิมลงในฟอร์มให้
function openEditModal(tx) {
  editingId = tx.id;
  currentType = tx.type;
  currentCategoryId = tx.categoryId;

  // amount เก็บเป็นสตางค์ ต้องหาร 100 ก่อนใส่ในช่องกรอก (ช่องกรอกใช้หน่วยบาท)
  amountInput.value = (tx.amount / 100).toFixed(2);
  noteInput.value = tx.note;
  dateInput.value = tx.date;

  modalTitle.textContent = "แก้ไขรายการ";
  updateTypeButtons();
  renderCategoryGrid();

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

    // วงกลมพื้นหลังสีอ่อน ๆ ตามสีประจำหมวดหมู่ (มาจาก colors.js) ครอบไอคอนไว้
    btn.innerHTML = `
      <span
        class="w-9 h-9 rounded-full flex items-center justify-center text-lg"
        style="background-color: ${getCategoryColor(cat.id)}22"
      >
        ${cat.icon}
      </span>
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

      // จุดสีเล็ก ๆ หน้าชื่อหมวดหมู่ ใช้สีเดียวกับที่กราฟโดนัทใช้ (จาก colors.js)
      const dotColor = getCategoryColor(tx.categoryId);

      return `
        <li class="flex items-center justify-between py-3">
          <div>
            <p class="text-sm font-medium text-gray-800">${title}</p>
            <p class="text-xs text-gray-400 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${dotColor}"></span>
              ${formatDateThai(tx.date)} · ${categoryLabel}
            </p>
          </div>
          <p class="text-sm font-semibold ${amountClass}">${amountText}</p>
        </li>
      `;
    })
    .join("");
}

// ------------------------------------------------------------
// การ์ดสรุปงบประมาณที่หน้าแรก
// แยกเป็นฟังก์ชันคำนวณเล็ก ๆ หลายตัว เพื่อให้ทดสอบและอ่านทีละส่วนได้ง่าย
// ------------------------------------------------------------

// รวมยอด "รายรับ" เฉพาะของเดือนที่ระบุ (monthKey รูปแบบ "YYYY-MM") หน่วยสตางค์
// tx.date มีรูปแบบ "YYYY-MM-DD" อยู่แล้ว จึงเช็คแค่ว่าขึ้นต้นด้วย monthKey หรือไม่
function calculateMonthlyIncome(transactions, monthKey) {
  return transactions
    .filter((tx) => tx.type === "income" && tx.date.startsWith(monthKey))
    .reduce((sum, tx) => sum + tx.amount, 0);
}

// รวมยอด "รายจ่าย" เฉพาะของเดือนที่ระบุ หน่วยสตางค์
function calculateMonthlyExpense(transactions, monthKey) {
  return transactions
    .filter((tx) => tx.type === "expense" && tx.date.startsWith(monthKey))
    .reduce((sum, tx) => sum + tx.amount, 0);
}

// จำนวนวันที่เหลือในเดือนนี้ นับรวมวันนี้ด้วย
// เช่น วันนี้เป็นวันที่ 18 ของเดือนที่มี 31 วัน -> เหลืออีก 14 วัน (18, 19, ..., 31)
function calculateDaysLeftInMonth() {
  const now = new Date();
  // trick: new Date(ปี, เดือนถัดไป, 0) จะได้ "วันสุดท้ายของเดือนปัจจุบัน" พอดี
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  return totalDaysInMonth - today + 1;
}

// งบที่เหลือ = งบที่ตั้งไว้ - รายจ่ายรวมของเดือนนี้ (ค่าติดลบได้ ถ้าใช้เกินงบ)
function calculateBudgetRemaining(budget, monthlyExpense) {
  return budget - monthlyExpense;
}

// เปอร์เซ็นต์งบที่ใช้ไปแล้ว (อาจเกิน 100 ได้ถ้าใช้เกินงบจริง ๆ)
// ถ้ายังไม่ได้ตั้งงบ (budget = 0) ไม่มีฐานให้คิดเปอร์เซ็นต์ จึงคืนค่า 0 ไปก่อน
function calculateBudgetUsedPercent(budget, monthlyExpense) {
  if (budget <= 0) return 0;
  return (monthlyExpense / budget) * 100;
}

// งบที่เหลือหารด้วยจำนวนวันที่เหลือ = ใช้ได้อีกวันละเท่าไหร่ (หน่วยสตางค์)
function calculateDailyAllowance(budgetRemaining, daysLeftInMonth) {
  if (daysLeftInMonth <= 0) return budgetRemaining; // กันหารด้วย 0 (เผื่อกรณีขอบ ๆ)
  return budgetRemaining / daysLeftInMonth;
}

// วาดการ์ดสรุปงบประมาณทั้งการ์ดใหม่ จากข้อมูล transaction + งบประมาณจริงใน localStorage
function renderDashboardSummary() {
  const monthKey = getCurrentMonthKey();
  const transactions = getTransactions();

  const budget = getBudgetForMonth(monthKey);
  const monthlyIncome = calculateMonthlyIncome(transactions, monthKey);
  const monthlyExpense = calculateMonthlyExpense(transactions, monthKey);

  // อัปเดตการ์ดรายรับรวม / รายจ่ายรวมของเดือนนี้
  incomeTotalEl.textContent = "+" + formatMoney(monthlyIncome) + " ฿";
  expenseTotalEl.textContent = "-" + formatMoney(monthlyExpense) + " ฿";

  // กรณียังไม่เคยตั้งงบประมาณของเดือนนี้เลย ให้บอกผู้ใช้แทนการคำนวณ
  if (budget <= 0) {
    budgetRemainingTextEl.textContent = "ยังไม่ได้ตั้งงบ";
    budgetRemainingTextEl.className = "text-2xl font-bold text-gray-400 mt-1";
    budgetProgressBarEl.style.width = "0%";
    budgetProgressBarEl.className = "bg-gray-300 h-3 rounded-full";
    dailyAllowanceTextEl.textContent = "กดปุ่ม ✏️ เพื่อตั้งงบประมาณเดือนนี้";
    dailyAllowanceTextEl.className = "text-sm text-gray-400 mt-2";
    return;
  }

  const budgetRemaining = calculateBudgetRemaining(budget, monthlyExpense);
  const usedPercent = calculateBudgetUsedPercent(budget, monthlyExpense);
  const daysLeft = calculateDaysLeftInMonth();
  const dailyAllowance = calculateDailyAllowance(budgetRemaining, daysLeft);
  const isOverBudget = budgetRemaining < 0;

  // ตัวเลขงบที่เหลือ (สีแดงถ้าติดลบ)
  budgetRemainingTextEl.textContent =
    (isOverBudget ? "-" : "") + formatMoney(Math.abs(budgetRemaining)) + " ฿";
  budgetRemainingTextEl.className = isOverBudget
    ? "text-4xl font-bold text-red-600 mt-1"
    : "text-4xl font-bold text-gray-800 mt-1";

  // แถบ progress bar: ความกว้างไม่เกิน 100% (กันแถบล้นกล่องเวลาใช้เกินงบเยอะ ๆ)
  // สี: เขียวถ้า < 70%, เหลืองถ้า 70-100%, แดงถ้าเกิน 100%
  const barWidthPercent = Math.min(usedPercent, 100);
  let barColorClass = "bg-green-500";
  if (usedPercent > 100) {
    barColorClass = "bg-red-500";
  } else if (usedPercent >= 70) {
    barColorClass = "bg-yellow-500";
  }
  budgetProgressBarEl.style.width = `${barWidthPercent}%`;
  budgetProgressBarEl.className = `${barColorClass} h-3 rounded-full`;

  // ข้อความบรรทัดล่างสุด: ถ้าเกินงบแล้วให้เตือนแทนตัวเลขติดลบ
  if (isOverBudget) {
    dailyAllowanceTextEl.textContent = "เกินงบแล้ว";
    dailyAllowanceTextEl.className = "text-sm text-red-600 font-semibold mt-2";
  } else {
    dailyAllowanceTextEl.textContent = `ใช้ได้อีกวันละ ${formatMoney(dailyAllowance)} บาท`;
    dailyAllowanceTextEl.className = "text-sm text-gray-500 mt-2";
  }
}

// ผู้ใช้กดปุ่ม ✏️ เพื่อตั้ง/แก้ไขงบประมาณของเดือนปัจจุบัน
// ใช้ prompt() ซึ่งเป็นกล่องกรอกข้อความง่าย ๆ ของเบราว์เซอร์ ไม่ต้องสร้าง modal เพิ่ม
function handleEditBudgetClick() {
  const monthKey = getCurrentMonthKey();
  const currentBudget = getBudgetForMonth(monthKey);

  // ถ้าเคยตั้งงบไว้แล้ว ใช้ค่าที่เคยตั้งเป็นค่าเริ่มต้นในกล่องกรอก (แปลงสตางค์ -> บาท)
  const defaultValue = currentBudget > 0 ? (currentBudget / 100).toFixed(2) : "";

  const input = prompt("ตั้งงบประมาณเดือนนี้ (บาท):", defaultValue);
  if (input === null) return; // ผู้ใช้กด "ยกเลิก"

  const budgetBaht = parseFloat(input);
  if (isNaN(budgetBaht) || budgetBaht < 0) {
    alert("กรุณากรอกจำนวนเงินให้ถูกต้อง");
    return;
  }

  const budgetSatang = Math.round(budgetBaht * 100);
  saveBudgetForMonth(monthKey, budgetSatang);
  renderDashboardSummary();
}

// ------------------------------------------------------------
// กราฟโดนัท: สัดส่วนรายจ่ายตามหมวดหมู่ (เดือนนี้) ที่หน้าแรก
// ------------------------------------------------------------

// รวมยอดรายจ่ายของเดือนที่ระบุ แยกตามหมวดหมู่
// ผลลัพธ์: [ { categoryId, label, amount }, ... ] เรียงจากยอดมากไปน้อย
function calculateExpenseByCategory(transactions, monthKey) {
  const totals = {}; // { food: 15000, transport: 8000, ... } หน่วยสตางค์

  transactions
    .filter((tx) => tx.type === "expense" && tx.date.startsWith(monthKey))
    .forEach((tx) => {
      totals[tx.categoryId] = (totals[tx.categoryId] || 0) + tx.amount;
    });

  return Object.keys(totals)
    .map((categoryId) => {
      const info = getCategoryInfo("expense", categoryId);
      return {
        categoryId,
        label: info ? info.label : "อื่นๆ",
        amount: totals[categoryId],
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

// วาดกราฟโดนัท + legend + ประโยคสรุป จากข้อมูลรายจ่ายของเดือนนี้
function renderExpenseDoughnutChart() {
  const monthKey = getCurrentMonthKey();
  const transactions = getTransactions();
  const byCategory = calculateExpenseByCategory(transactions, monthKey);
  const totalExpense = byCategory.reduce((sum, item) => sum + item.amount, 0);

  // ยังไม่มีรายจ่ายเลยในเดือนนี้ -> ซ่อนกราฟ โชว์ข้อความแทน (วาดกราฟจากข้อมูลว่างไม่ได้)
  if (totalExpense === 0) {
    expenseChartWrapperEl.classList.add("hidden");
    expenseChartEmptyEl.classList.remove("hidden");
    expenseChartSummaryEl.textContent = "";
    return;
  }

  expenseChartWrapperEl.classList.remove("hidden");
  expenseChartEmptyEl.classList.add("hidden");

  const labels = byCategory.map((item) => item.label);
  const amounts = byCategory.map((item) => item.amount);
  const colors = byCategory.map((item) => getCategoryColor(item.categoryId));

  // มีกราฟเดิมอยู่แล้วต้อง destroy ก่อนวาดใหม่ ไม่งั้น Chart.js จะซ้อนกันเละ
  if (expenseDoughnutChart) {
    expenseDoughnutChart.destroy();
  }

  expenseDoughnutChart = new Chart(expenseChartCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: amounts, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      plugins: { legend: { display: false } }, // ปิด legend มาตรฐาน เพราะเราสร้าง legend เองด้านล่าง
      cutout: "65%",
    },
  });

  // สร้าง legend เอง โดยใช้สีจาก getCategoryColor ตัวเดียวกับที่ส่งเข้ากราฟ รับประกันว่าสีตรงกัน
  expenseChartLegendEl.innerHTML = byCategory
    .map((item) => {
      const percent = ((item.amount / totalExpense) * 100).toFixed(0);
      return `
        <li class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${getCategoryColor(item.categoryId)}"></span>
            ${item.label}
          </span>
          <span class="text-gray-500">${formatMoney(item.amount)} ฿ (${percent}%)</span>
        </li>
      `;
    })
    .join("");

  // ประโยคสรุป: หมวดที่ใช้จ่ายเยอะสุด (byCategory เรียงมากไปน้อยไว้แล้ว ตัวแรกคือหมวดสูงสุด)
  const topCategory = byCategory[0];
  const topPercent = ((topCategory.amount / totalExpense) * 100).toFixed(0);
  expenseChartSummaryEl.textContent = `เดือนนี้ "${topCategory.label}" มากที่สุด คิดเป็น ${topPercent}% ของรายจ่ายทั้งหมด`;
}

// ------------------------------------------------------------
// หน้า "รายงาน" — กราฟแท่งเปรียบเทียบรายรับ-รายจ่ายตามช่วงเวลาที่เลือก
// ------------------------------------------------------------

// คืน array ของ monthKey ("YYYY-MM") ตามช่วงเวลาที่เลือก เรียงจากเก่าไปใหม่ (เดือนปัจจุบันอยู่ท้ายสุดเสมอ)
function getMonthKeysForRange(range) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  let monthCount;
  if (range === "month") {
    monthCount = 1;
  } else if (range === "3m") {
    monthCount = 3;
  } else if (range === "6m") {
    monthCount = 6;
  } else if (range === "year") {
    monthCount = currentMonth + 1; // ตั้งแต่ ม.ค. ถึงเดือนปัจจุบัน
  }

  const monthKeys = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    // ใช้ Date คำนวณ "ย้อนไป i เดือน" ให้ JavaScript จัดการเรื่องข้ามปีให้เอง
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
  }
  return monthKeys;
}

// แปลง monthKey "YYYY-MM" เป็นข้อความไทยแบบย่อสำหรับติดป้ายกราฟ เช่น "ส.ค. 69"
function formatMonthKeyThai(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const buddhistYearShort = String(year + 543).slice(-2); // เอาแค่ 2 หลักท้าย กันป้ายกราฟยาวเกิน
  return `${THAI_MONTHS[month - 1]} ${buddhistYearShort}`;
}

// วาดกราฟแท่ง + ประโยคสรุป เปรียบเทียบรายรับ-รายจ่ายของแต่ละเดือนในช่วงที่เลือก
function renderIncomeExpenseBarChart(range) {
  const transactions = getTransactions();
  const monthKeys = getMonthKeysForRange(range);

  const incomeAmounts = monthKeys.map((key) => calculateMonthlyIncome(transactions, key));
  const expenseAmounts = monthKeys.map((key) => calculateMonthlyExpense(transactions, key));

  const hasAnyData = incomeAmounts.some((v) => v > 0) || expenseAmounts.some((v) => v > 0);

  if (!hasAnyData) {
    reportChartCanvas.classList.add("hidden");
    reportChartEmptyEl.classList.remove("hidden");
    reportChartSummaryEl.textContent = "";
    return;
  }

  reportChartCanvas.classList.remove("hidden");
  reportChartEmptyEl.classList.add("hidden");

  const labels = monthKeys.map(formatMonthKeyThai);

  // แปลงหน่วยจากสตางค์เป็นบาทก่อนส่งเข้ากราฟ เพื่อให้แกนตัวเลขอ่านง่าย
  const incomeBaht = incomeAmounts.map((satang) => satang / 100);
  const expenseBaht = expenseAmounts.map((satang) => satang / 100);

  if (reportBarChart) {
    reportBarChart.destroy();
  }

  reportBarChart = new Chart(reportChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "รายรับ", data: incomeBaht, backgroundColor: "#22c55e" },
        { label: "รายจ่าย", data: expenseBaht, backgroundColor: "#ef4444" },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } },
    },
  });

  // ประโยคสรุป: รวมรายรับ-รายจ่ายทั้งช่วงเวลา แล้วเทียบกันว่าฝั่งไหนมากกว่า
  const totalIncome = incomeAmounts.reduce((sum, v) => sum + v, 0);
  const totalExpense = expenseAmounts.reduce((sum, v) => sum + v, 0);
  const diff = totalIncome - totalExpense;

  if (diff >= 0) {
    reportChartSummaryEl.textContent = `ช่วงนี้รายรับมากกว่ารายจ่ายอยู่ ${formatMoney(diff)} บาท`;
  } else {
    reportChartSummaryEl.textContent = `ช่วงนี้รายจ่ายมากกว่ารายรับอยู่ ${formatMoney(Math.abs(diff))} บาท`;
  }
}

// ผู้ใช้กดปุ่มเลือกช่วงเวลาที่หน้ารายงาน (เดือนนี้ / 3 เดือน / 6 เดือน / ปีนี้)
function handleReportRangeClick(range) {
  currentReportRange = range;

  // เปลี่ยนสไตล์ปุ่มให้ปุ่มที่กำลังเลือกอยู่เด่นกว่าปุ่มอื่น
  reportRangeButtons.forEach((btn) => {
    const isActive = btn.dataset.range === range;
    btn.className = isActive
      ? "report-range-btn py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white"
      : "report-range-btn py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500";
  });

  renderIncomeExpenseBarChart(range);
}

// ------------------------------------------------------------
// หน้า "รายการทั้งหมด" — จัดกลุ่มรายการตามวันที่
// ------------------------------------------------------------

// จัดกลุ่ม array ของ transaction ให้เป็น array ของกลุ่มตามวันที่
// ผลลัพธ์: [ { date: "2026-08-18", items: [tx, tx, ...] }, ... ]
// เรียงกลุ่มจากวันที่ล่าสุดไปเก่าสุด และในแต่ละกลุ่มก็เรียงรายการล่าสุดไว้บนสุดเช่นกัน
function groupTransactionsByDate(transactions) {
  const groups = {}; // เก็บชั่วคราวแบบ { "2026-08-18": [tx, tx], "2026-08-17": [tx] }

  transactions.forEach((tx) => {
    if (!groups[tx.date]) {
      groups[tx.date] = [];
    }
    groups[tx.date].push(tx);
  });

  // รูปแบบวันที่ "YYYY-MM-DD" เปรียบเทียบด้วย string ได้ตรงตามลำดับเวลาเลย
  const dateKeysSortedDesc = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  return dateKeysSortedDesc.map((date) => {
    const items = [...groups[date]].sort((a, b) => b.createdAt - a.createdAt);
    return { date, items };
  });
}

// รวมยอดสุทธิ (รายรับ - รายจ่าย) ของรายการในกลุ่มเดียวกัน หน่วยเป็นสตางค์
function calcGroupTotal(items) {
  let total = 0;
  items.forEach((tx) => {
    total += tx.type === "income" ? tx.amount : -tx.amount;
  });
  return total;
}

// วาดหน้า "รายการทั้งหมด" ใหม่ทั้งหมดจากข้อมูลใน localStorage
function renderAllTransactions() {
  const transactions = getTransactions();

  if (transactions.length === 0) {
    allTransactionsListEl.innerHTML = `
      <p class="text-center text-sm text-gray-400 py-10">ยังไม่มีรายการ</p>
    `;
    return;
  }

  const groups = groupTransactionsByDate(transactions);

  allTransactionsListEl.innerHTML = groups
    .map((group) => {
      const groupTotal = calcGroupTotal(group.items);
      const totalClass = groupTotal >= 0 ? "text-green-600" : "text-red-600";
      const totalText =
        (groupTotal >= 0 ? "+" : "-") + formatMoney(Math.abs(groupTotal)) + " ฿";

      // ถ้าเป็นวันนี้ให้แสดงคำว่า "วันนี้" แทนวันที่ จะได้อ่านง่ายขึ้น
      const dateLabel =
        group.date === getTodayString() ? "วันนี้" : formatDateThai(group.date);

      const itemsHtml = group.items
        .map((tx) => {
          const categoryInfo = getCategoryInfo(tx.type, tx.categoryId);
          const categoryLabel = categoryInfo ? categoryInfo.label : "อื่นๆ";
          const icon = categoryInfo ? categoryInfo.icon : "📦";
          const title = tx.note && tx.note.trim() !== "" ? tx.note : categoryLabel;

          const isIncome = tx.type === "income";
          const amountText = (isIncome ? "+" : "-") + formatMoney(tx.amount) + " ฿";
          const amountClass = isIncome ? "text-green-600" : "text-red-600";

          // data-id ใช้เก็บ id ของรายการไว้บนปุ่ม เพื่อให้ event listener ข้างล่างรู้ว่ากดรายการไหน
          return `
            <li class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <button type="button" class="tx-item-btn flex items-center gap-3 flex-1 text-left" data-id="${tx.id}">
                <span
                  class="text-xl w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style="background-color: ${getCategoryColor(tx.categoryId)}22"
                >${icon}</span>
                <span>
                  <span class="block text-sm font-medium text-gray-800">${title}</span>
                  <span class="block text-xs text-gray-400">${categoryLabel}</span>
                </span>
              </button>
              <span class="text-sm font-semibold ${amountClass} mr-3">${amountText}</span>
              <button type="button" class="tx-delete-btn text-gray-300 hover:text-red-500 text-lg px-1" data-id="${tx.id}" aria-label="ลบรายการ">
                🗑️
              </button>
            </li>
          `;
        })
        .join("");

      return `
        <div class="mb-4">
          <div class="flex items-center justify-between px-1 mb-1">
            <p class="text-sm font-semibold text-gray-500">${dateLabel}</p>
            <p class="text-sm font-semibold ${totalClass}">${totalText}</p>
          </div>
          <ul class="bg-white rounded-2xl shadow-sm px-4">${itemsHtml}</ul>
        </div>
      `;
    })
    .join("");

  // HTML ทั้งหมดถูกสร้างใหม่ทุกครั้งด้วย innerHTML ปุ่มเก่าจึงหายไปพร้อม event เดิม
  // ต้องมาผูก event ให้ปุ่ม .tx-item-btn และ .tx-delete-btn ใหม่ทุกครั้งหลังวาดเสร็จ
  document.querySelectorAll(".tx-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tx = getTransactions().find((t) => t.id === btn.dataset.id);
      if (tx) openEditModal(tx);
    });
  });

  document.querySelectorAll(".tx-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleDeleteTransaction(btn.dataset.id);
    });
  });
}

// ลบรายการตาม id หลังจากผู้ใช้กดยืนยันใน confirm popup แล้วเท่านั้น
function handleDeleteTransaction(id) {
  const confirmed = confirm("ลบรายการนี้ใช่ไหม?");
  if (!confirmed) return;

  const transactions = getTransactions().filter((tx) => tx.id !== id);
  saveTransactions(transactions);

  renderRecentTransactions();
  renderAllTransactions();
  renderDashboardSummary();
  renderExpenseDoughnutChart();
}

// ------------------------------------------------------------
// สลับหน้าจอ "หน้าแรก" กับ "รายการทั้งหมด" ด้วยแถบเมนูล่าง
// ------------------------------------------------------------

function switchView(view) {
  // แสดง/ซ่อนแต่ละ view ด้วย class "hidden" ของ Tailwind (แสดงเฉพาะ view ที่ตรงกับ view ที่เลือก)
  viewHome.classList.toggle("hidden", view !== "home");
  viewTransactions.classList.toggle("hidden", view !== "transactions");
  viewReports.classList.toggle("hidden", view !== "reports");

  // เปลี่ยนสีปุ่มเมนูล่างให้ปุ่มที่กำลังเลือกอยู่เป็นสีฟ้า ปุ่มอื่นเป็นสีเทา
  navHomeBtn.classList.toggle("text-blue-600", view === "home");
  navHomeBtn.classList.toggle("text-gray-400", view !== "home");
  navListBtn.classList.toggle("text-blue-600", view === "transactions");
  navListBtn.classList.toggle("text-gray-400", view !== "transactions");
  navReportBtn.classList.toggle("text-blue-600", view === "reports");
  navReportBtn.classList.toggle("text-gray-400", view !== "reports");

  // วาดข้อมูลของ view นั้นใหม่ทุกครั้งที่เปิด กันกรณีข้อมูลเพิ่งเปลี่ยนตอนอยู่หน้าอื่น
  // (กราฟต้องรอให้ canvas ของ view นั้น "แสดงอยู่จริง" ก่อนค่อยวาด ไม่งั้น Chart.js จะคำนวณขนาดผิด)
  if (view === "transactions") {
    renderAllTransactions();
  } else if (view === "reports") {
    renderIncomeExpenseBarChart(currentReportRange);
  }
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

  const transactions = getTransactions();

  if (editingId) {
    // โหมดแก้ไข: หารายการเดิมด้วย id แล้วแทนที่ด้วยข้อมูลใหม่จากฟอร์ม
    const index = transactions.findIndex((tx) => tx.id === editingId);
    if (index !== -1) {
      transactions[index] = {
        ...transactions[index], // คง id และ createdAt เดิมไว้
        type: currentType,
        amount: amountSatang,
        categoryId: currentCategoryId,
        note: noteInput.value.trim(),
        date: dateInput.value || getTodayString(),
      };
    }
  } else {
    // โหมดเพิ่มใหม่: สร้าง object ตามโครงสร้าง transaction ที่ตกลงกันไว้
    transactions.push({
      id: generateId(),
      type: currentType,
      amount: amountSatang,
      categoryId: currentCategoryId,
      note: noteInput.value.trim(),
      date: dateInput.value || getTodayString(),
      createdAt: Date.now(),
    });
  }

  saveTransactions(transactions);

  closeModal();
  renderRecentTransactions();
  renderAllTransactions();
  renderDashboardSummary();
  renderExpenseDoughnutChart();

  // ถ้าตอนนี้เปิดหน้ารายงานค้างอยู่ (เพิ่ม/แก้รายการผ่านปุ่ม + ระหว่างดูรายงาน) ให้วาดกราฟรายงานใหม่ด้วย
  if (!viewReports.classList.contains("hidden")) {
    renderIncomeExpenseBarChart(currentReportRange);
  }
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

navHomeBtn.addEventListener("click", () => switchView("home"));
navListBtn.addEventListener("click", () => switchView("transactions"));
navReportBtn.addEventListener("click", () => switchView("reports"));

editBudgetBtn.addEventListener("click", handleEditBudgetClick);

reportRangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => handleReportRangeClick(btn.dataset.range));
});

// ------------------------------------------------------------
// สั่งทำงานทันทีที่โหลดหน้าเสร็จ
// ------------------------------------------------------------

updateTypeButtons();
renderCategoryGrid();
renderRecentTransactions();
renderDashboardSummary();
renderExpenseDoughnutChart();
