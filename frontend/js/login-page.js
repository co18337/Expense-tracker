/**
 * Login Page UI Handlers
 * Phase 0: Handles form interactions, validation, and submission
 */

// ===== FORM SWITCHING =====

/**
 * Switch to login form
 */
function switchToLogin(event) {
    event.preventDefault();
    
    // Hide all forms
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('forgotPasswordForm').classList.remove('active');
    
    // Show login form
    document.getElementById('loginForm').classList.add('active');
    
    // Clear form
    document.getElementById('loginFormElement').reset();
    clearErrors('login');
    
    console.log('[LoginPage] Switched to login form');
}

/**
 * Switch to register form
 */
function switchToRegister(event) {
    event.preventDefault();
    
    // Hide all forms
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('forgotPasswordForm').classList.remove('active');
    
    // Show register form
    document.getElementById('registerForm').classList.add('active');
    
    // Clear form
    document.getElementById('registerFormElement').reset();
    clearErrors('register');
    
    console.log('[LoginPage] Switched to register form');
}

/**
 * Show forgot password form
 */
function showForgotPassword(event) {
    event.preventDefault();
    
    // Hide all forms
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('forgotPasswordForm').classList.remove('active');
    
    // Show forgot password form
    document.getElementById('forgotPasswordForm').classList.add('active');
    
    // Clear form
    document.getElementById('forgotPasswordFormElement').reset();
    clearErrors('forgot');
    
    console.log('[LoginPage] Switched to forgot password form');
}

// ===== FORM SUBMISSION =====

/**
 * Handle login form submission
 */
document.getElementById('loginFormElement')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    console.log('[LoginPage] Login form submitted');
    
    // Get form data
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Validate
    if (!validateLoginForm()) {
        return;
    }
    
    // Show loading
    setButtonLoading('loginBtn', true);
    clearError('login');
    
    try {
        // Call auth manager
        await auth.login(email, password, rememberMe);
        
        // Redirect to dashboard
        console.log('[LoginPage] Login successful, redirecting to dashboard');
        window.location.href = CONFIG.ROUTES.DASHBOARD;
    } catch (error) {
        // Show error
        showError('login', error.message);
        setButtonLoading('loginBtn', false);
    }
});

/**
 * Handle register form submission
 */
document.getElementById('registerFormElement')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    console.log('[LoginPage] Register form submitted');
    
    // Get form data
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('confirmPassword').value;
    
    // Validate
    if (!validateRegisterForm(email, password, passwordConfirm)) {
        return;
    }
    
    // Show loading
    setButtonLoading('registerBtn', true);
    clearError('register');
    
    try {   
        // Call auth manager
        await auth.register(email, password, passwordConfirm);
        
        // Redirect to dashboard
        console.log('[LoginPage] Registration successful, redirecting to dashboard');
        window.location.href = CONFIG.ROUTES.DASHBOARD;
    } catch (error) {
        // Show error
        showError('register', error.message);
        setButtonLoading('registerBtn', false);
    }
});

/**
 * Handle forgot password form submission
 */
document.getElementById('forgotPasswordFormElement')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    console.log('[LoginPage] Forgot password form submitted');
    
    // Get email
    const email = document.getElementById('forgotEmail').value.trim();
    
    // Validate email
    if (!email) {
        showFieldError('forgotEmailError', 'Email is required');
        return;
    }
    
    // Show loading
    setButtonLoading('forgotBtn', true);
    clearError('forgot');
    
    try {
        // Request password reset
        await auth.requestPasswordReset(email);
        
        // Show success message
        showSuccessMessage('forgot');
        document.getElementById('forgotPasswordFormElement').reset();
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
            switchToLogin({ preventDefault: () => {} });
        }, 3000);
    } catch (error) {
        // Show error
        showError('forgot', error.message);
        setButtonLoading('forgotBtn', false);
    }
});

// ===== VALIDATION =====

/**
 * Validate login form
 */
function validateLoginForm() {
    let isValid = true;
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Email validation
    if (!email) {
        showFieldError('loginEmailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('loginEmailError', 'Please enter a valid email');
        isValid = false;
    }
    
    // Password validation
    if (!password) {
        showFieldError('loginPasswordError', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

/**
 * Validate register form
 */
function validateRegisterForm(email, password, passwordConfirm) {
    let isValid = true;
    
    // Email validation
    if (!email) {
        showFieldError('registerEmailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('registerEmailError', 'Please enter a valid email');
        isValid = false;
    }
    
    // Password validation
    if (!password) {
        showFieldError('registerPasswordError', 'Password is required');
        isValid = false;
    } else if (password.length < CONFIG.PASSWORD_MIN_LENGTH) {
        showFieldError('registerPasswordError', `Password must be at least ${CONFIG.PASSWORD_MIN_LENGTH} characters`);
        isValid = false;
    } else if (!isStrongPassword(password)) {
        showFieldError('registerPasswordError', 'Password must contain uppercase, lowercase, and number');
        isValid = false;
    }
    
    // Confirm password validation
    if (!passwordConfirm) {
        showFieldError('confirmPasswordError', 'Please confirm your password');
        isValid = false;
    } else if (password !== passwordConfirm) {
        showFieldError('confirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    
    return isValid;
}

/**
 * Check if email is valid format
 */
function isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
}

/**
 * Check if password is strong
 */
function isStrongPassword(password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasUppercase && hasLowercase && hasNumber;
}

// ===== ERROR HANDLING =====

/**
 * Show field-level error
 */
function showFieldError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

/**
 * Clear field-level errors
 */
function clearErrors(formType) {
    const errorElements = document.querySelectorAll(`#${formType}Form .error-text`);
    errorElements.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
}

/**
 * Show form-level error alert
 */
function showError(formType, message) {
    const errorDiv = document.getElementById(`${formType}Error`);
    const errorText = document.getElementById(`${formType}ErrorText`);
    
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('d-none');
    }
}

/**
 * Clear form-level error
 */
function clearError(formType) {
    const errorDiv = document.getElementById(`${formType}Error`);
    if (errorDiv) {
        errorDiv.classList.add('d-none');
    }
}

/**
 * Show success message
 */
function showSuccessMessage(formType) {
    const messageDiv = document.getElementById(`${formType}Message`);
    const errorDiv = document.getElementById(`${formType}Error`);
    
    if (messageDiv) {
        messageDiv.classList.remove('d-none');
    }
    if (errorDiv) {
        errorDiv.classList.add('d-none');
    }
}

// ===== UI UTILITIES =====

/**
 * Toggle password visibility
 */
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    
    input.type = isPassword ? 'text' : 'password';
    
    console.log(`[LoginPage] Password visibility toggled for ${inputId}`);
}

/**
 * Set button loading state
 */
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = isLoading;
    
    const spinner = button.querySelector('.spinner-border');
    const text = button.querySelector('.btn-text');
    
    if (isLoading) {
        spinner?.classList.remove('d-none');
        text.style.display = 'none';
    } else {
        spinner?.classList.add('d-none');
        text.style.display = 'inline';
    }
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    console.log('[LoginPage] Page loaded');
    
    // If already logged in, redirect to dashboard
    if (auth.isLoggedIn()) {
        console.log('[LoginPage] User already logged in, redirecting to dashboard');
        window.location.href = CONFIG.ROUTES.DASHBOARD;
    }
    
    // Show login form by default
    switchToLogin({ preventDefault: () => {} });
});
