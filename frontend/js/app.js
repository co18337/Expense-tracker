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

async function loadExpenses() {
    try {
        const result = await apiCall('GET', '/expenses');
        state.expenses = result.data || [];
        updateNav();
    } catch (e) {
        console.error('Load failed:', e);
    }
}

function initApp() {
    DOM.dateInput.valueAsDate = new Date();
    attachEvents();
    renderDashboard(); // Render AFTER data loaded
}

function attachEvents() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute('data-page');
            switchPage(page);
        });
    });
    
    DOM.form.addEventListener('submit', addExpense);
    
    document.getElementById('backToMonths')?.addEventListener('click', () => {
        DOM.monthsView.style.display = 'block';
        DOM.daysView.style.display = 'none';
    });
    
    document.getElementById('backToDays')?.addEventListener('click', () => {
        DOM.daysView.style.display = 'block';
        DOM.transactionsView.style.display = 'none';
    });
    
    DOM.backFromDaily.addEventListener('click', goBackToMonthlyChart);
}

function switchPage(page) {
    DOM.pages.forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    DOM.navItems.forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    if (page === 'dashboard') {
        renderDashboard();
    } else if (page === 'transactions') {
        renderTransactions();
    }
}

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
        DOM.form.reset();
        DOM.dateInput.valueAsDate = new Date();
        await loadExpenses();
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
        showLoading(false);
    } catch (e) {
        showLoading(false);
    }
}

// ===== Dashboard =====
function renderDashboard() {
    if (state.viewingDaily) {
        goBackToMonthlyChart();
    }
    updateStats();
    renderCategoryChart();
    renderMonthlyChart();
}

function updateStats() {
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

function renderCategoryChart() {
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

function renderMonthlyChart() {
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
    DOM.monthChartTitle.textContent = `Daily Breakdown - ${monthKey}`;
    DOM.monthChartDesc.textContent = `Total: ₹${total.toFixed(2)}`;
    DOM.backFromDaily.style.display = 'inline-block';
    state.viewingDaily = true;
    
    // Destroy old chart properly
    if (state.charts.monthly) {
        state.charts.monthly.destroy();
        state.charts.monthly = null;
    }
    
    
    // Create new daily chart - fresh canvas
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
    DOM.backFromDaily.style.display = 'none';
    
    // Fade out chart
    const chartCard = DOM.monthlyChart.closest('.chart-card');
    chartCard.style.opacity = '0';
    chartCard.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        DOM.monthChartTitle.textContent = 'Spending by Month';
        DOM.monthChartDesc.textContent = 'Click a bar to see daily breakdown';
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
    DOM.monthsView.style.display = 'block';
    DOM.daysView.style.display = 'none';
    DOM.transactionsView.style.display = 'none';
    
    const months = {};
    state.expenses.forEach(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + e.amount;
    });
    
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
    
    document.getElementById('selectedMonthTitle').textContent = name;
    document.getElementById('selectedMonthTotal').textContent = `Total: ₹${total.toFixed(2)}`;
    
    DOM.daysGrid.innerHTML = '';
    Object.entries(days).sort((a, b) => b[0] - a[0]).forEach(([day, amt]) => {
        const div = document.createElement('div');
        div.className = 'day-card';
        div.innerHTML = `<div class="day-number">${day}</div><div class="day-amount">₹${amt.toFixed(2)}</div>`;
        div.addEventListener('click', () => showTransactions(monthKey, day));
        DOM.daysGrid.appendChild(div);
    });
    
    DOM.monthsView.style.display = 'none';
    DOM.daysView.style.display = 'block';
}

function showTransactions(monthKey, day) {
    const [year, month] = monthKey.split('-');
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
    
    const trans = state.expenses.filter(e => e.date === dateStr);
    const total = trans.reduce((a, e) => a + e.amount, 0);
    
    const d = new Date(year, month - 1, day);
    const dateDisplay = d.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
    
    document.getElementById('selectedDateTitle').textContent = dateDisplay;
    document.getElementById('selectedDateTotal').textContent = `Total: ₹${total.toFixed(2)}`;
    
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
    
    DOM.daysView.style.display = 'none';
    DOM.transactionsView.style.display = 'block';
}

// ===== Validation =====
function validate(data) {
    let valid = true;
    
    if (!data.amount || data.amount <= 0) {
        document.getElementById('amountErr').textContent = 'Enter valid amount > 0';
        document.getElementById('amountErr').classList.remove('d-none');
        valid = false;
    }
    
    if (!data.category) {
        document.getElementById('categoryErr').textContent = 'Select a category';
        document.getElementById('categoryErr').classList.remove('d-none');
        valid = false;
    }
    
    const dateStr = data.date;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (dateStr > todayStr) {
        document.getElementById('dateErr').textContent = 'Cannot be in future';
        document.getElementById('dateErr').classList.remove('d-none');
        valid = false;
    }
    
    return valid;
}

function clearErrors() {
    ['amountErr', 'categoryErr', 'dateErr'].forEach(id => {
        document.getElementById(id).classList.add('d-none');
    });
}

// ===== UI =====
function updateNav() {
    const total = state.expenses.reduce((s, e) => s + e.amount, 0);
    DOM.navTotal.textContent = `₹${total.toFixed(2)}`;
}

function toast(msg, type = 'info') {
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

function showLoading(show) {
    DOM.loadingSpinner.classList.toggle('d-none', !show);
}

function esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}