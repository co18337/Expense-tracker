const API = 'http://localhost:5000/api';

const state = {
    expenses: [],
    charts: {},
    selectedMonth: null,
    viewingDaily: false
};

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
});
let myObject; // Initially undefined
async function loadExpenses() {
    try {
        const result = await apiCall('GET', '/expenses');
        state.expenses = result.data || [];
        updateNav();
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
                <button class="btn-delete" onclick="deleteExpense(${t.id})"><i class="fas fa-trash"></i></button>
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
async function addExpense(e) {
    e.preventDefault();
    clearErrors();

    const cat = document.querySelector('input[name="category"]:checked');
    const data = {
        amount: parseFloat(DOM.amountInput.value),
        category: cat?.value,
        description: document.getElementById('description').value,
        date: DOM.dateInput.value
    };

    if (!validate(data)) return;

    try {
        showLoading(true);
        await apiCall('POST', '/expenses', data);
        toast('Expense added!', 'success');
        if (DOM.form) DOM.form.reset();
        if (DOM.dateInput) DOM.dateInput.valueAsDate = new Date();
        await loadExpenses();
        updateDashboard(); // Refresh dashboard
        showLoading(false);
    } catch (e) {
        showLoading(false);
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
async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    // Don't send empty messages
    if (!message) return;

    // Add user message to chat display
    addChatMessage(message, 'user');

    // Clear input and focus for next message
    input.value = '';
    input.focus();

    try {
        // Show loading state
        showLoading(true);

        // Send message to backend API
        const result = await apiCall('POST', '/chat', { message });

        // Hide loading
        showLoading(false);

        // Display bot response
        if (result.success) {
            if (result.message) {
                addChatMessage(result.message, 'ai');
            }

            // If expense was added, update dashboard
            if (result.needs_confirmation || result.needs_clarification) {
                await loadExpenses();
                updateDashboard();
            }
        } else {
            addChatMessage('Sorry, something went wrong. Please try again.', 'ai');
        }
    } catch (e) {
        showLoading(false);
        addChatMessage('Error: Unable to connect to server.', 'ai');
    }
}

/**
 * Adds a message to the chat display
 * sender: 'user' or 'ai'
 */
function addChatMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) {
        console.warn('Chat box element not found');
        return;
    }

    // Create message element
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}-message`;
    msgDiv.innerHTML = `<p>${escapeHtml(text)}</p>`;

    // Add to chat
    chatBox.appendChild(msgDiv);

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

/* =========================================================
   MODULE 1.2 – NAVIGATION CONTROLLER (ADD-ONLY)
   DOES NOT MODIFY EXISTING LOGIC
   ========================================================= */

(function () {
    // Guard: run only after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {

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
