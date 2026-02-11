const API = 'http://localhost:5000/api';

const state = {
    expenses: [],
    charts: {},
    selectedMonth: null,
    viewingDaily: false
};

// holds expense waiting for confirmation from chat
let pendingExpense = null;
const chatHistory = []; // Stores {role: 'user'/'assistant', content: '...'}

const DOM = {
    navItems: document.querySelectorAll('.nav-item'),
    pages: document.querySelectorAll('.page-section'),
    form: document.getElementById('expenseForm'),
    dateInput: document.getElementById('date'),
    amountInput: document.getElementById('amount'),

    thisMonth: document.getElementById('thisMonth'),
    totalCount: document.getElementById('totalCount'),
    dailyAvg: document.getElementById('dailyAvg'),
    topCat: document.getElementById('topCat'),

    categoryChart: document.getElementById('categoryChart'),
    monthlyChart: document.getElementById('monthlyChart'),

    monthChartTitle: document.getElementById('monthChartTitle'),
    monthChartDesc: document.getElementById('monthChartDesc'),
    backFromDaily: document.getElementById('backFromDaily'),

    monthsGrid: document.getElementById('monthsGrid'),
    daysGrid: document.getElementById('daysGrid'),
    transactionsGrid: document.getElementById('transactionsGrid'),

    monthsView: document.getElementById('monthsView'),
    daysView: document.getElementById('daysView'),
    transactionsView: document.getElementById('transactionsView'),

    navTotal: document.getElementById('navTotal'),
    toast: document.getElementById('toast'),
    loadingSpinner: document.getElementById('loadingSpinner')
};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    await loadExpenses(); // Load FIRST
    showLoading(false);
    initApp();
    // Animate the welcome message
    const initialMsg = document.querySelector('.ai-message');
    if (initialMsg) {
        const text = initialMsg.innerText.trim();
        initialMsg.innerText = ''; // Clear it
        setTimeout(() => typeText(initialMsg, text), 500); // Start typing after 0.5s
    }
});
let myObject; // Initially undefined
async function loadExpenses() {
    try {
        const result = await apiCall('GET', '/expenses');
        state.expenses = result.data || [];
        updateNav();
        // ✅ NEW: Update dropdown whenever we load data
        updateCategoryDropdown();
    } catch (e) {
        console.error('Load failed:', e);
    }
}

/**
 * FIX 1: Initialize app with null check for dateInput
 * Check if dateInput exists before setting its value
 */
function initApp() {
    // Only set date if element exists (it's hidden in hybrid layout)
    if (DOM.dateInput) {
        DOM.dateInput.valueAsDate = new Date();
    }
    attachEvents();

    initHistoryView();  //Enable the Search Toggle

    renderDashboard(); // Render AFTER data loaded
}

/**
 * FIX 2: Attach events with comprehensive null checks
 * Check all elements before attaching listeners
 */
function attachEvents() {
    // Dashboard always visible - no navigation needed

    // Form submission (if form exists in layout)
    if (DOM.form) {
        DOM.form.addEventListener('submit', addExpense);
    }

    // Back button listeners (for transactions view if used)
    const backToMonths = document.getElementById('backToMonths');
    if (backToMonths) {
        backToMonths.addEventListener('click', () => {
            if (DOM.monthsView) DOM.monthsView.style.display = 'block';
            if (DOM.daysView) DOM.daysView.style.display = 'none';
        });
    }

    const backToDays = document.getElementById('backToDays');
    if (backToDays) {
        backToDays.addEventListener('click', () => {
            if (DOM.daysView) DOM.daysView.style.display = 'block';
            if (DOM.transactionsView) DOM.transactionsView.style.display = 'none';
        });
    }

    // Back from daily breakdown (for charts)
    if (DOM.backFromDaily) {
        DOM.backFromDaily.addEventListener('click', goBackToMonthlyChart);
    }

    // Chat form submission
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
}

/**
 * FIX 3: Update stats with null checks
 * Verify all stat elements exist before updating
 */
function updateStats() {
    // Check if stat elements exist
    if (!DOM.thisMonth || !DOM.totalCount || !DOM.dailyAvg || !DOM.topCat) {
        console.warn('Some stat elements not found');
        return;
    }

    const now = new Date();
    const thisMonthExp = state.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const thisMonthTotal = thisMonthExp.reduce((s, e) => s + e.amount, 0);
    DOM.thisMonth.textContent = `₹${thisMonthTotal.toFixed(2)}`;
    DOM.totalCount.textContent = state.expenses.length;

    let dailyAvgVal = 0;
    if (state.expenses.length > 0) {
        const days = new Set(state.expenses.map(e => e.date)).size;
        const total = state.expenses.reduce((s, e) => s + e.amount, 0);
        dailyAvgVal = total / days;
    }
    DOM.dailyAvg.textContent = `₹${dailyAvgVal.toFixed(2)}`;

    const cats = {};
    state.expenses.forEach(e => {
        cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    DOM.topCat.textContent = top ? top[0] : '-';
}

/**
 * Dashboard always visible - no page switching needed
 * Just update the data when user interacts
 */
function updateDashboard() {
    /**
     * What: Updates dashboard with latest data
     * Why: Called when data changes (expense added via chat)
     */
    updateStats();
    renderCategoryChart();
    renderMonthlyChart();
}

function refreshDashboardData() {
    /**
     * What: Refreshes dashboard data
     * Why: Called after chat interaction changes expenses
     */
    updateDashboard();
}

/**
 * FIX 4: Render dashboard with chart existence checks
 */
function renderDashboard() {
    if (state.viewingDaily) {
        goBackToMonthlyChart();
    }

    // Update dashboard data
    updateStats();

    // Render charts only if they exist
    if (DOM.categoryChart) {
        renderCategoryChart();
    }
    if (DOM.monthlyChart) {
        renderMonthlyChart();
    }
}

/**
 * FIX 5: Render category chart with element existence check
 */
function renderCategoryChart() {
    // Check if chart element exists
    if (!DOM.categoryChart) {
        console.warn('Category chart element not found');
        return;
    }

    const cats = {};
    state.expenses.forEach(e => {
        cats[e.category] = (cats[e.category] || 0) + e.amount;
    });

    if (state.charts.category) state.charts.category.destroy();

    const colors = ['#FF6B6B', '#4ECDC4', '#FFB84D', '#A78BFA', '#FF85A1', '#00D4FF', '#6BCB77', '#FFD93D'];

    state.charts.category = new Chart(DOM.categoryChart, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: colors.slice(0, Object.keys(cats).length),
                borderColor: '#1A1F2E',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,   // 🔥 THIS FIXES OVERFLOW
            layout: {
                padding: 10
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#B0B9C3',
                        font: { size: 11, weight: 600 },
                        boxWidth: 12
                    }
                }
            }
        }

    });
}

/**
 * FIX 6: Render monthly chart with element existence check
 */
function renderMonthlyChart() {
    // Check if chart element exists
    if (!DOM.monthlyChart) {
        console.warn('Monthly chart element not found');
        return;
    }

    const months = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        months[key] = 0;
    }

    state.expenses.forEach(e => {
        const d = new Date(e.date);
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (key in months) months[key] += e.amount;
    });

    if (state.charts.monthly) state.charts.monthly.destroy();

    const ctx = DOM.monthlyChart.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(78, 205, 196, 0.4)');

    const monthKeys = Object.keys(months);

    state.charts.monthly = new Chart(DOM.monthlyChart, {
        type: 'bar',
        data: {
            labels: monthKeys,
            datasets: [{
                label: 'Monthly Spending (₹)',
                data: Object.values(months),
                backgroundColor: gradient,
                borderColor: '#00D4FF',
                borderWidth: 2,
                borderRadius: 8,
                barThickness: 'flex',
                maxBarThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const monthKey = monthKeys[idx];
                    showDailyBreakdown(monthKey);
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#B0B9C3', font: { size: 11, weight: 600 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => '₹' + v,
                        color: '#7A8593',
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(0, 212, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#7A8593', font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function showDailyBreakdown(monthKey) {
    const [month, year] = monthKey.split(' ');
    const monthNum = new Date(`${month} 1, ${year}`).getMonth();
    const yearNum = parseInt(year);

    const dayData = {};
    state.expenses.forEach(e => {
        const d = new Date(e.date);
        if (d.getMonth() === monthNum && d.getFullYear() === yearNum) {
            const day = d.getDate();
            dayData[day] = (dayData[day] || 0) + e.amount;
        }
    });

    state.selectedMonth = monthKey;
    const total = Object.values(dayData).reduce((a, b) => a + b, 0);

    // Update title immediately
    if (DOM.monthChartTitle) DOM.monthChartTitle.textContent = `Daily Breakdown - ${monthKey}`;
    if (DOM.monthChartDesc) DOM.monthChartDesc.textContent = `Total: ₹${total.toFixed(2)}`;
    if (DOM.backFromDaily) DOM.backFromDaily.style.display = 'inline-block';
    state.viewingDaily = true;

    // Destroy old chart properly
    if (state.charts.monthly) {
        state.charts.monthly.destroy();
        state.charts.monthly = null;
    }

    // Create new daily chart - fresh canvas
    if (!DOM.monthlyChart) {
        console.warn('Monthly chart element not found');
        return;
    }

    const ctx = DOM.monthlyChart.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 107, 107, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 133, 161, 0.4)');

    const days = Object.keys(dayData).sort((a, b) => parseInt(a) - parseInt(b));
    const values = days.map(d => dayData[d]);

    state.charts.monthly = new Chart(DOM.monthlyChart, {
        type: 'bar',
        data: {
            labels: days.map(d => `D${d}`),
            datasets: [{
                label: 'Daily Spending (₹)',
                data: values,
                backgroundColor: gradient,
                borderColor: '#FF6B6B',
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 'flex',
                maxBarThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    labels: { color: '#B0B9C3', font: { size: 10, weight: 600 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => '₹' + v,
                        color: '#7A8593',
                        font: { size: 9 }
                    },
                    grid: { color: 'rgba(0, 212, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#7A8593', font: { size: 9 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function goBackToMonthlyChart() {
    state.viewingDaily = false;
    if (DOM.backFromDaily) DOM.backFromDaily.style.display = 'none';

    // Fade out chart
    const chartCard = DOM.monthlyChart.closest('.chart-card');
    chartCard.style.opacity = '0';
    chartCard.style.transform = 'scale(0.95)';

    setTimeout(() => {
        if (DOM.monthChartTitle) DOM.monthChartTitle.textContent = 'Spending by Month';
        if (DOM.monthChartDesc) DOM.monthChartDesc.textContent = 'Click a bar to see daily breakdown';
        if (state.charts.monthly) {
            state.charts.monthly.destroy();
        }
        renderMonthlyChart();

        // Fade in
        chartCard.style.opacity = '1';
        chartCard.style.transform = 'scale(1)';
    }, 150);
}

// Filters for transactions hybrid view
/* =========================================
   PHASE 2.1: HYBRID VIEW CONTROLLER
   ========================================= */

let isSearchMode = false;

// Call this inside initApp()
function initHistoryView() {
    // 1. Toggle Button Logic
    const btn = document.getElementById('btnToggleSearch');
    if (btn) {
        btn.addEventListener('click', toggleHistoryView);
    }

    // 2. Search Apply Button
    const applyBtn = document.getElementById('btnApplySearch');
    if (applyBtn) {
        applyBtn.addEventListener('click', runAdvancedSearch);
    }

    // 3. Populate Search Dropdown
    populateSearchDropdown();
}

function toggleHistoryView() {
    isSearchMode = !isSearchMode;

    const defaultView = document.getElementById('defaultView');
    const filterView = document.getElementById('filterView');
    const btn = document.getElementById('btnToggleSearch');
    const title = document.getElementById('historyTitle');

    if (isSearchMode) {
        // SWITCH TO SEARCH
        defaultView.classList.add('d-none');
        filterView.classList.remove('d-none');

        btn.innerHTML = '<i class="fas fa-times"></i> Close Search';
        btn.classList.replace('btn-outline-cyan', 'btn-outline-danger');
        title.textContent = 'Search Expenses';

        // Auto-run search with defaults
        runAdvancedSearch();
    } else {
        // SWITCH BACK TO DEFAULT TILES
        defaultView.classList.remove('d-none');
        filterView.classList.add('d-none');

        btn.innerHTML = '<i class="fas fa-search"></i> Advanced Search';
        btn.classList.replace('btn-outline-danger', 'btn-outline-cyan');
        title.textContent = 'Expense History';

        // Reset to main month view
        renderTransactions();
    }
}

function populateSearchDropdown() {
    const select = document.getElementById('searchCategory');
    if (!select) return;

    const cats = new Set();
    state.expenses.forEach(e => cats.add(e.category));

    let html = '<option value="ALL">All Categories</option>';
    Array.from(cats).sort().forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    select.innerHTML = html;
}

function runAdvancedSearch() {
    const cat = document.getElementById('searchCategory').value;
    const from = document.getElementById('searchDateFrom').value;
    const to = document.getElementById('searchDateTo').value;
    const list = document.getElementById('searchResultsList');
    const totalBadge = document.getElementById('searchTotal');

    if (!list) return;
    list.innerHTML = '';

    // Filter Logic
    const results = state.expenses.filter(e => {
        if (cat !== 'ALL' && e.category !== cat) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        return true;
    });

    // Update Total
    const total = results.reduce((sum, e) => sum + e.amount, 0);
    if (totalBadge) totalBadge.textContent = `Total: ₹${total.toFixed(2)}`;

    if (results.length === 0) {
        list.innerHTML = '<div class="text-center text-muted p-5">No matches found.</div>';
        return;
    }

    // Render Flat List
    results.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        const div = document.createElement('div');
        div.className = 'transaction-card';
        div.innerHTML = `
               <div class="transaction-info">
                   <div class="justify-content-between">
                       <h6 class="mb-0 fw-bold text-light">${t.category}</h6>
                       <small class="text-secondary">${t.date}</small>
                   </div>
                   <p class="mb-0 text-muted small">${t.description || ''}</p>
               </div>
               <div class="transaction-amount text-end">
                   <div class="fw-bold fs-5">₹${t.amount.toFixed(2)}</div>
                   <button class="btn btn-sm btn-outline-danger border-0 mt-1" 
                           onclick="deleteExpense(${t.id})">
                       <i class="fas fa-trash"></i>
                   </button>
               </div>
           `;
        list.appendChild(div);
    });
}
// End

// ===== Transactions =====
function renderTransactions() {
    if (DOM.monthsView) DOM.monthsView.style.display = 'block';
    if (DOM.daysView) DOM.daysView.style.display = 'none';
    if (DOM.transactionsView) DOM.transactionsView.style.display = 'none';

    const months = {};
    state.expenses.forEach(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + e.amount;
    });

    if (DOM.monthsGrid) {
        DOM.monthsGrid.innerHTML = '';
        Object.entries(months).sort().reverse().forEach(([key, total]) => {
            const [year, month] = key.split('-');
            const name = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

            const div = document.createElement('div');
            div.className = 'month-card';
            div.innerHTML = `<div class="month-name">${name}</div><div class="month-amount">₹${total.toFixed(2)}</div>`;
            div.addEventListener('click', () => showDays(key));
            DOM.monthsGrid.appendChild(div);
        });
    }
}

function showDays(monthKey) {
    const [year, month] = monthKey.split('-');
    const days = {};

    state.expenses.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() == year && d.getMonth() + 1 == month) {
            const day = d.getDate();
            days[day] = (days[day] || 0) + e.amount;
        }
    });

    const name = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const total = Object.values(days).reduce((a, b) => a + b, 0);

    const selectedMonthTitle = document.getElementById('selectedMonthTitle');
    const selectedMonthTotal = document.getElementById('selectedMonthTotal');
    if (selectedMonthTitle) selectedMonthTitle.textContent = name;
    if (selectedMonthTotal) selectedMonthTotal.textContent = `Total: ₹${total.toFixed(2)}`;

    if (DOM.daysGrid) {
        DOM.daysGrid.innerHTML = '';
        Object.entries(days).sort((a, b) => b[0] - a[0]).forEach(([day, amt]) => {
            const div = document.createElement('div');
            div.className = 'day-card';
            div.innerHTML = `<div class="day-number">${day}</div><div class="day-amount">₹${amt.toFixed(2)}</div>`;
            div.addEventListener('click', () => showTransactions(monthKey, day));
            DOM.daysGrid.appendChild(div);
        });
    }

    if (DOM.monthsView) DOM.monthsView.style.display = 'none';
    if (DOM.daysView) DOM.daysView.style.display = 'block';
}

function showTransactions(monthKey, day) {
    const [year, month] = monthKey.split('-');
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;

    const trans = state.expenses.filter(e => e.date === dateStr);
    const total = trans.reduce((a, e) => a + e.amount, 0);

    const d = new Date(year, month - 1, day);
    const dateDisplay = d.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });

    const selectedDateTitle = document.getElementById('selectedDateTitle');
    const selectedDateTotal = document.getElementById('selectedDateTotal');
    if (selectedDateTitle) selectedDateTitle.textContent = dateDisplay;
    if (selectedDateTotal) selectedDateTotal.textContent = `Total: ₹${total.toFixed(2)}`;

    if (DOM.transactionsGrid) {
        DOM.transactionsGrid.innerHTML = '';
        trans.forEach(t => {
            const div = document.createElement('div');
            div.className = 'transaction-card';
            div.innerHTML = `
                <div class="transaction-info">
                    <h6>${esc(t.category)}</h6>
                    <p>${esc(t.description || 'No description')}</p>
                </div>
                <div class="transaction-amount">₹${t.amount.toFixed(2)}</div>
                <button style="background: var(--card-bg) class="btn-delete" onclick="deleteExpense(${t.id})"><i class="fas fa-trash"></i></button>
            `;
            DOM.transactionsGrid.appendChild(div);
        });
    }

    if (DOM.monthsView) DOM.monthsView.style.display = 'none';
    if (DOM.daysView) DOM.daysView.style.display = 'none';
    if (DOM.transactionsView) DOM.transactionsView.style.display = 'block';
}

// ===== Validation =====
function validate(data) {
    let valid = true;

    if (!data.amount || data.amount <= 0) {
        const amountErr = document.getElementById('amountErr');
        if (amountErr) {
            amountErr.textContent = 'Enter valid amount > 0';
            amountErr.classList.remove('d-none');
        }
        valid = false;
    }

    if (!data.category) {
        const categoryErr = document.getElementById('categoryErr');
        if (categoryErr) {
            categoryErr.textContent = 'Select a category';
            categoryErr.classList.remove('d-none');
        }
        valid = false;
    }

    const dateStr = data.date;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (dateStr > todayStr) {
        const dateErr = document.getElementById('dateErr');
        if (dateErr) {
            dateErr.textContent = 'Cannot be in future';
            dateErr.classList.remove('d-none');
        }
        valid = false;
    }

    return valid;
}

function clearErrors() {
    ['amountErr', 'categoryErr', 'dateErr'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.classList.add('d-none');
    });
}

// ===== UI =====
/**
 * FIX 7: Update navigation total with null check
 */
function updateNav() {
    if (DOM.navTotal) {
        const total = state.expenses.reduce((s, e) => s + e.amount, 0);
        DOM.navTotal.textContent = `₹${total.toFixed(2)}`;
    }
}

/**
 * FIX 8: Toast with null check
 */
function toast(msg, type = 'info') {
    // Check if toast element exists
    if (!DOM.toast) {
        console.warn('Toast element not found');
        return;
    }

    DOM.toast.innerHTML = `
        <div class="toast-body d-flex align-items-center gap-2">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${msg}</span>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    DOM.toast.classList.add(type);
    new bootstrap.Toast(DOM.toast).show();
}

/**
 * FIX 9: Loading spinner with null check
 */
function showLoading(show) {
    if (DOM.loadingSpinner) {
        DOM.loadingSpinner.classList.toggle('d-none', !show);
    }
}

function esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== API CALLS =====

async function apiCall(method, endpoint, data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);

    try {
        const res = await fetch(`${API}${endpoint}`, options);
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        return result;
    } catch (err) {
        toast(err.message, 'error');
        throw err;
    }
}

/**
 * FIX 10: Add expense with dashboard refresh
 */
/**
 * Title Case Helper
 * Converts "sports" -> "Sports" to prevent duplicate categories in charts
 */
function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function addExpense(e) {
    e.preventDefault();
    clearErrors();

    const select = document.getElementById('categorySelect');
    const customInput = document.getElementById('customCategoryInput');
    let finalCategory = null;

    // Logic: If "Create New" is picked, use input. Else use dropdown value.
    if (select.value === 'NEW_CATEGORY_TRIGGER') {
        const val = customInput.value.trim();
        finalCategory = val ? toTitleCase(val) : 'Miscellaneous';
    } else {
        finalCategory = select.value;
    }

    if (!finalCategory) {
        document.getElementById('categoryErr').textContent = 'Please select a category';
        document.getElementById('categoryErr').classList.remove('d-none');
        return;
    }

    const data = {
        amount: parseFloat(DOM.amountInput.value),
        category: finalCategory,
        description: document.getElementById('description').value,
        date: DOM.dateInput.value
    };

    if (!validate(data)) return;

    try {
        showLoading(true);
        await apiCall('POST', '/expenses', data);
        toast('Expense added!', 'success');

        if (DOM.form) DOM.form.reset();

        // Reset UI
        otherContainer.classList.add('d-none');
        select.value = ""; // Reset dropdown

        if (DOM.dateInput) DOM.dateInput.valueAsDate = new Date();

        await loadExpenses(); // This will auto-refresh the dropdown with the new category!
        updateDashboard();
        showLoading(false);
    } catch (e) {
        showLoading(false);
    }
}

/**
 * Populates dropdown with unique categories from existing expenses
 * + Adds standard defaults + "Create New" option
 */
function updateCategoryDropdown() {
    const select = document.getElementById('categorySelect');
    if (!select) return;

    // 1. Get unique categories from history
    const uniqueCats = new Set(['Food', 'Transport', 'Entertainment', 'Utilities']); // Defaults
    state.expenses.forEach(e => uniqueCats.add(e.category));

    // 2. Sort them
    const sortedCats = Array.from(uniqueCats).sort();

    // 3. Preserve current selection if possible, otherwise reset
    const currentVal = select.value;

    // 4. Build HTML
    let html = '<option value="" disabled selected>Select a category...</option>';

    sortedCats.forEach(cat => {
        // Skip 'Miscellaneous' to put it at the end if you want, or just list it
        html += `<option value="${cat}">${cat}</option>`;
    });

    // 5. Add "Create New" separator and option
    html += `
        <option disabled>──────────</option>
        <option value="NEW_CATEGORY_TRIGGER">+ Create New...</option>
    `;

    select.innerHTML = html;

    // Restore selection if it still exists
    if (currentVal && sortedCats.includes(currentVal)) {
        select.value = currentVal;
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    try {
        showLoading(true);
        await apiCall('DELETE', `/expenses/${id}`);
        toast('Deleted!', 'success');
        await loadExpenses();
        updateDashboard(); // Refresh dashboard
        showLoading(false);
    } catch (e) {
        showLoading(false);
    }
}

// ===== AI CHAT =====

const chatState = {
    currentExtraction: null,
    awaitingConfirmation: false
};

/**
 * Handles chat form submission
 * Sends message to backend, processes response
 */
/**
 * Handles chat form submission
 * Sends message to backend, processes response
 */
/**
 * Robust chat submit handler
 * - Handles pendingExpense confirmation locally (POST /api/chat/confirm)
 * - Handles normal AI flow (POST /api/chat) using apiCall()
 * - Disables input & button while requests run to avoid duplicates
 */
/**
 * Handles chat form submission
 * Sends message to backend, processes response
 */
// async function handleChatSubmit(e) {
//     if (e && typeof e.preventDefault === 'function') e.preventDefault();

//     const chatInput = document.getElementById('chatInput');
//     const message = chatInput.value.trim();
//     if (!message) return;

//     // Show user message
//     addChatMessage(message, 'user');
//     chatInput.value = '';

//     // Handle text-based confirmation (fallback if they type instead of click)
//     if (pendingExpense) {
//         if (/^(yes|y|save|confirm)$/i.test(message)) {
//             // Find the last disabled buttons and simulate a click, 
//             // OR just call the handler manually. 
//             // For simplicity, we just trigger the logic directly:
//             await handleConfirmation('yes', { closest: () => ({ querySelectorAll: () => [] }) });
//             return;
//         }
//         if (/^(no|n|cancel)$/i.test(message)) {
//             pendingExpense = null;
//             addChatMessage('❎ Expense cancelled.', 'ai');
//             return;
//         }
//     }

//     try {
//         showLoading(true);
//         const result = await apiCall('POST', '/chat', { message });
//         showLoading(false);

//         if (!result.success) {
//             addChatMessage(result.message || 'Error processing request', 'ai');
//             return;
//         }

//         // ✅ HERE IS THE CHANGE: Use buttons for confirmation
//         if (result.needs_confirmation && result.extracted) {
//             pendingExpense = result.extracted;
//             addConfirmationMessage(result.message, result.extracted); // <--- Uses new button function
//         } else {
//             addChatMessage(result.message, 'ai');
//         }

//     } catch (err) {
//         showLoading(false);
//         addChatMessage('🚨 Error reaching AI service.', 'ai');
//     }
// }

// async function handleChatSubmit(e) {
//     if (e && typeof e.preventDefault === 'function') e.preventDefault();

//     const chatInput = document.getElementById('chatInput');
//     const message = chatInput.value.trim();
//     if (!message) return;

//     // 1. Show User Message (Instant, no animation)
//     addChatMessage(message, 'user');
//     chatInput.value = '';

//     // ============================================================
//     // LOGIC RESTORED: Handle text-based confirmation (Fallback)
//     // ============================================================
//     if (pendingExpense) {
//         // If user types "yes", "save", etc. instead of clicking button
//         if (/^(yes|y|save|confirm)$/i.test(message)) {
//             // Simulate button click logic
//             await handleConfirmation('yes', { closest: () => ({ querySelectorAll: () => [] }) });
//             return;
//         }
//         // If user types "no", "cancel", etc.
//         if (/^(no|n|cancel)$/i.test(message)) {
//             pendingExpense = null;
//             addChatMessage('❎ Expense cancelled.', 'ai', true); // Animate this too
//             return;
//         }
//     }

//     // ============================================================
//     // NEW: Animation Flow
//     // ============================================================

//     // 2. Show Typing Indicator (The bouncing dots)
//     showTypingIndicator();

//     try {
//         // 3. API Call
//         const result = await apiCall('POST', '/chat', { message });

//         // 4. Remove Indicator immediately after data arrives
//         removeTypingIndicator();

//         if (!result.success) {
//             addChatMessage(result.message || 'Error processing request', 'ai', true);
//             return;
//         }

//         // 5. Handle Response
//         if (result.needs_confirmation && result.extracted) {
//             pendingExpense = result.extracted;
//             // We pass the extracted data to the button renderer
//             addConfirmationMessage(result.message, result.extracted);
//         } else {
//             // Standard response -> Animate it!
//             addChatMessage(result.message, 'ai', true);
//         }

//     } catch (err) {
//         removeTypingIndicator(); // Ensure dots are gone if it crashes
//         addChatMessage('🚨 Error reaching AI service.', 'ai', true);
//     }
// }

async function handleChatSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (!message) return;

    // 1. Show User Message (Instant, no animation)
    addChatMessage(message, 'user');
    chatInput.value = '';

    // ============================================================
    // LOGIC RESTORED: Handle text-based confirmation (Fallback)
    // ============================================================
    if (pendingExpense) {
        if (/^(yes|y|save|confirm)$/i.test(message)) {
            // Simulate button click logic
            await handleConfirmation('yes', { closest: () => ({ querySelectorAll: () => [] }) });
            return;
        }
        if (/^(no|n|cancel)$/i.test(message)) {
            pendingExpense = null;
            addChatMessage('❎ Expense cancelled.', 'ai', true);
            return;
        }
    }

    // ============================================================
    // NEW: History & API Flow
    // ============================================================

    // 2. Add to History (Limit to last 6 turns / 3 exchanges)
    chatHistory.push({ role: 'user', content: message });
    if (chatHistory.length > 6) chatHistory.shift();

    // 3. Show Typing Indicator
    showTypingIndicator();

    try {
        // 4. API Call (NOW SENDING HISTORY)
        const result = await apiCall('POST', '/chat', {
            message: message,
            history: chatHistory // <--- Pass context to backend
        });

        // 5. Remove Indicator
        removeTypingIndicator();

        if (!result.success) {
            addChatMessage(result.message || 'Error processing request', 'ai', true);
            return;
        }

        // 6. Add AI Response to History
        chatHistory.push({ role: 'assistant', content: result.message });

        // 7. Handle Response UI

        if (result.needs_confirmation && result.extracted) {

            // ✅ CHECK THIS BLOCK
            if (result.potential_duplicate) {
                console.log("Duplicate detected, showing options..."); // Debug log
                addDuplicateDecisionMessage(result.message, result.extracted, result.potential_duplicate.id);
            } else {
                pendingExpense = result.extracted;
                addConfirmationMessage(result.message, result.extracted);
            }

        } else {
            addChatMessage(result.message, 'ai', true);
        }

    } catch (err) {
        removeTypingIndicator();
        addChatMessage('🚨 Error reaching AI service.', 'ai', true);
    }
}


/**
 * Shows buttons for "Update vs Create New"
 */
function addDuplicateDecisionMessage(text, newExpenseData, existingId) {
    const chatBox = document.getElementById('chatBox');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message ai-message';

    msgDiv.innerHTML = `
        <p>${escapeHtml(text)}</p>
        <div class="chat-actions">
            <button class="btn-chat yes" onclick="handleUpdateExisting(${existingId}, ${JSON.stringify(newExpenseData).replace(/"/g, '&quot;')}, this)">
                <i class="fas fa-edit"></i> Update
            </button>
            <button class="btn-chat no" onclick="handleConfirmation('yes', this)">
                <i class="fas fa-plus"></i> Create New
            </button>
        </div>
    `;

    // Store pending data just in case they click "Create New"
    pendingExpense = newExpenseData;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Handles the "Update Existing" click
 */
async function handleUpdateExisting(id, newData, btnElement) {
    const container = btnElement.closest('.chat-actions');
    const allBtns = container.querySelectorAll('button');
    allBtns.forEach(btn => btn.disabled = true); // Lock UI

    addChatMessage(`Update previous entry to ₹${newData.amount}.`, 'user');

    try {
        showLoading(true);
        // Call the PUT endpoint we already have in routes.py
        const result = await apiCall('PUT', `/expenses/${id}`, newData);
        showLoading(false);

        addChatMessage(`✅ Updated! New amount is ₹${result.data.amount}.`, 'ai', true);
        pendingExpense = null;
        await loadExpenses();
        updateDashboard();

    } catch (err) {
        showLoading(false);
        addChatMessage('🚨 Update failed.', 'ai', true);
        allBtns.forEach(btn => btn.disabled = false); // Unlock
    }
}


/**
 * Adds a message to the chat display
 * sender: 'user' or 'ai'
 */
/**
 * Adds a message to the chat display
 * animate: boolean (true for AI, false for user)
 */
async function addChatMessage(text, sender, animate = false) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    // Create message bubble
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}-message`;

    // Insert into DOM first (empty if animating)
    chatBox.appendChild(msgDiv);

    if (animate && sender === 'ai') {
        // Run Typewriter Effect
        await typeText(msgDiv, text);

        // If the text contains HTML (like bolding), we might want to 
        // inject it normally after typing completes to render formatting properly.
        // For simple Phase 1 text, the typeText function above is sufficient.
        // If we have "<b>Bold</b>", simple typing will show the tags. 
        // Simple Fix: Just set innerHTML at end to be safe.
        msgDiv.innerHTML = text;
    } else {
        // Instant render (User messages)
        msgDiv.innerHTML = text;
    }

    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/* =========================================
   PHASE 2.1: ANIMATION HELPERS
   ========================================= */

/**
 * 1. SHOW TYPING INDICATOR
 * Creates a temporary bubble with bouncing dots
 */
function showTypingIndicator() {
    const chatBox = document.getElementById('chatBox');

    // Check if already exists
    if (document.getElementById('typing-indicator')) return;

    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'typing-indicator';
    div.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * 2. HIDE TYPING INDICATOR
 * Removes the bubble
 */
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * 3. TYPEWRITER EFFECT
 * types text char-by-char into an element
 */
function typeText(element, text, speed = 20) {
    return new Promise((resolve) => {
        let i = 0;
        element.innerHTML = ''; // Clear initial
        element.classList.add('typing-cursor'); // Add cursor

        function type() {
            if (i < text.length) {
                // Handle HTML entities safely or simple text
                // For simple text, this is fine:
                element.textContent += text.charAt(i);
                i++;
                chatBox.scrollTop = chatBox.scrollHeight; // Auto scroll
                setTimeout(type, speed);
            } else {
                element.classList.remove('typing-cursor'); // Remove cursor
                resolve(); // Done
            }
        }
        type();
    });
}

/* =========================================================
   MODULE 1.2 – NAVIGATION CONTROLLER (ADD-ONLY)
   DOES NOT MODIFY EXISTING LOGIC
   ========================================================= */

(function () {
    // Guard: run only after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Function to handle "Other" category toggle
        // Dropdown change listener
        const categorySelect = document.getElementById('categorySelect');
        const otherContainer = document.getElementById('otherCategoryContainer');
        const customInput = document.getElementById('customCategoryInput');

        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                if (e.target.value === 'NEW_CATEGORY_TRIGGER') {
                    otherContainer.classList.remove('d-none');
                    customInput.focus();
                } else {
                    otherContainer.classList.add('d-none');
                    customInput.value = ''; // Clear custom input
                }
            });
        }
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');

        if (!navItems.length || !sections.length) {
            console.warn('Navigation elements not found – skipping tab logic');
            return;
        }

        function activateSection(targetId) {
            // Toggle nav active state
            navItems.forEach(item => {
                item.classList.toggle(
                    'active',
                    item.getAttribute('data-page') === targetId
                );
            });

            // Toggle section visibility
            sections.forEach(section => {
                section.classList.toggle(
                    'active',
                    section.id === targetId
                );
            });

            // Call existing functions safely (if they exist)
            if (targetId === 'dashboard' && typeof renderDashboard === 'function') {
                renderDashboard();
            }

            if (targetId === 'transactions' && typeof renderTransactions === 'function') {
                renderTransactions();
            }
        }

        // Attach click listeners
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.getAttribute('data-page');
                if (!target) return;
                activateSection(target);
            });
        });

        // Ensure initial state is correct
        const initial =
            document.querySelector('.nav-item.active')?.getAttribute('data-page')
            || 'dashboard';

        activateSection(initial);
    });
})();

/* =========================================================
   CHAT INPUT FIX — ensure Enter / button / form submit work
   Drop-in: paste at end of frontend/js/app.js (once)
   ========================================================= */

(function attachChatSubmitHandlers() {
    // Run after DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        // Expected IDs in your index.html — change these if your HTML uses different ids
        const formId = 'chatForm';
        const inputId = 'chatInput';
        const sendBtnId = 'chatSendBtn'; // optional — your current button element

        const chatForm = document.getElementById(formId);
        const chatInput = document.getElementById(inputId);
        const sendBtn = document.getElementById(sendBtnId) || document.querySelector('.chat-send-btn');

        // Debug helper
        function _dbg(msg, ...args) {
            // comment out next line to silence debug in production
            console.debug('[chat-fix]', msg, ...args);
        }

        if (!chatInput) {
            console.error('[chat-fix] chatInput not found. Expected id="' + inputId + '". Check index.html.');
            return;
        } else {
            _dbg('chatInput found');
        }

        // Attach submit listener on form (preferred)
        if (chatForm) {
            _dbg('chatForm found — attaching submit listener');
            // remove existing to avoid duplicate handlers if reloading code
            chatForm.removeEventListener('submit', handleChatSubmit);
            chatForm.addEventListener('submit', handleChatSubmit);
        } else {
            _dbg('chatForm not found. Will rely on Enter key and send button');
        }

        // Attach Enter handler on input so Enter submits but Shift+Enter creates newline
        chatInput.removeEventListener('keydown', _enterKeyHandler);
        chatInput.addEventListener('keydown', _enterKeyHandler);

        // Attach click on send button if present
        if (sendBtn) {
            _dbg('sendBtn found — attaching click listener');
            sendBtn.removeEventListener('click', _onSendClick);
            sendBtn.addEventListener('click', _onSendClick);
        } else {
            _dbg('sendBtn not found');
        }

        // Helper functions
        function _enterKeyHandler(e) {
            // If user presses Enter without Shift -> submit
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // prevent newline
                _dbg('Enter pressed — submitting chat');
                // If we have form, use submit so existing logic with form.submit works
                if (chatForm) {
                    chatForm.requestSubmit ? chatForm.requestSubmit() : chatForm.submit();
                } else {
                    // fallback: call handleChatSubmit manually with synthetic event
                    try {
                        handleChatSubmit(new Event('submit', { cancelable: true }));
                    } catch (err) {
                        console.error('[chat-fix] handleChatSubmit error', err);
                    }
                }
            }
        }

        function _onSendClick(e) {
            e.preventDefault();
            _dbg('Send button clicked');
            if (chatForm) {
                chatForm.requestSubmit ? chatForm.requestSubmit() : chatForm.submit();
            } else {
                try {
                    handleChatSubmit(new Event('submit', { cancelable: true }));
                } catch (err) {
                    console.error('[chat-fix] handleChatSubmit error on button click', err);
                }
            }
        }

        // Safety: if handleChatSubmit is not defined, warn
        if (typeof handleChatSubmit !== 'function') {
            console.error('[chat-fix] handleChatSubmit() not found in global scope. Ensure function name matches exactly.');
        } else {
            _dbg('handleChatSubmit() exists');
        }
    });
})();


/**
 * Adds a message with Yes/No buttons
 */
function addConfirmationMessage(text, expenseData) {
    const chatBox = document.getElementById('chatBox');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message ai-message';

    // Store data in the DOM element for easy access
    msgDiv.dataset.expense = JSON.stringify(expenseData);

    msgDiv.innerHTML = `
        <p>${escapeHtml(text)}</p>
        <div class="chat-actions">
            <button class="btn-chat yes" onclick="handleConfirmation('yes', this)">
                <i class="fas fa-check"></i> Yes
            </button>
            <button class="btn-chat no" onclick="handleConfirmation('no', this)">
                <i class="fas fa-times"></i> No
            </button>
        </div>
    `;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Handles Yes/No button clicks
 * Includes "Rollback" logic: Re-enables buttons if server fails
 */
async function handleConfirmation(action, btnElement) {
    if (!pendingExpense) return;

    const container = btnElement.closest('.chat-actions');
    const allBtns = container.querySelectorAll('button');

    // 1. LOCK UI: Disable buttons to prevent duplicates
    allBtns.forEach(btn => btn.disabled = true);

    // 2. Show user selection visually
    addChatMessage(action === 'yes' ? 'Yes, save it.' : 'No, cancel it.', 'user');

    if (action === 'no') {
        pendingExpense = null;
        addChatMessage('❎ Expense cancelled.', 'ai');
        return;
    }

    // 3. Process Save (Action = 'yes')
    try {
        showLoading(true);

        const payload = {
            amount: Number(pendingExpense.amount),
            category: pendingExpense.category,
            description: pendingExpense.description || '',
            date: pendingExpense.date
        };

        const result = await apiCall('POST', '/chat/confirm', payload);

        // Success!
        showLoading(false);
        addChatMessage(result.message, 'ai');
        pendingExpense = null;
        await loadExpenses();
        updateDashboard();

    } catch (err) {
        // 4. ROLLBACK ON FAILURE
        // If error, re-enable buttons so user can try again
        console.error(err);
        showLoading(false);
        addChatMessage('🚨 Save failed. Please try clicking Yes again.', 'ai');

        // UNLOCK UI
        allBtns.forEach(btn => btn.disabled = false);
    }
}


