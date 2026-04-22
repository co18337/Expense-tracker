"""
Utility Functions - Phase 0
Helper functions for authentication including validation, token generation, and email

Functions:
  validate_email() - Validate email format and uniqueness
  validate_password() - Check password strength requirements
  generate_tokens() - Create access and refresh JWT tokens
  verify_token() - Validate token and extract payload
  send_password_reset_email() - Send password reset email via Gmail
"""

import re
import jwt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import os


def validate_email(email):
    """
    Validate email format and basic checks.
    
    Args:
        email (str): Email to validate
    
    Returns:
        tuple: (is_valid: bool, error_message: str)
        
    Checks:
      - Email not empty
      - Valid email format (RFC 5322 simplified)
      - Minimum length
    
    Examples:
      validate_email('user@example.com') → (True, '')
      validate_email('invalid-email') → (False, 'Invalid email format')
    """
    
    if not email or not isinstance(email, str):
        return False, 'Email is required'
    
    email = email.strip().lower()
    
    # Check length
    if len(email) < 5:
        return False, 'Email too short'
    
    if len(email) > 120:
        return False, 'Email too long'
    
    # Check format using regex (simplified RFC 5322)
    # Pattern: word characters@domain.extension
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False, 'Invalid email format'
    
    return True, ''


def validate_password(password):
    """
    Validate password strength.
    
    Args:
        password (str): Password to validate
    
    Returns:
        tuple: (is_valid: bool, error_message: str)
    
    Requirements:
      - Minimum 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one number
    
    Examples:
      validate_password('SecurePass123') → (True, '')
      validate_password('weak') → (False, 'Password too short')
    """
    
    if not password or not isinstance(password, str):
        return False, 'Password is required'
    
    # Check minimum length
    if len(password) < 8:
        return False, 'Password must be at least 8 characters'
    
    # Check maximum length (security best practice)
    if len(password) > 128:
        return False, 'Password too long'
    
    # Check for uppercase
    if not any(c.isupper() for c in password):
        return False, 'Password must contain uppercase letter (A-Z)'
    
    # Check for lowercase
    if not any(c.islower() for c in password):
        return False, 'Password must contain lowercase letter (a-z)'
    
    # Check for number
    if not any(c.isdigit() for c in password):
        return False, 'Password must contain number (0-9)'
    
    return True, ''


def generate_tokens(user_id, email):
    """
    Generate JWT access and refresh tokens.
    
    Args:
        user_id (int): User ID to embed in token
        email (str): User email to embed in token
    
    Returns:
        tuple: (access_token, refresh_token, expires_in_seconds)
    
    Tokens:
      - Access token: Short-lived (15 min), used for API calls
      - Refresh token: Long-lived (7 days), used to get new access token
    
    Both tokens are JWT with HMAC-SHA256 signature.
    
    Example:
      access_token, refresh_token, expires = generate_tokens(1, 'user@example.com')
      # access_token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
      # refresh_token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
      # expires: 900 (15 minutes in seconds)
    """
    
    secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
    algorithm = 'HS256'
    
    # Access token expiry (default: 15 minutes)
    access_expiry_minutes = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '15'))
    access_expiry = access_expiry_minutes * 60  # Convert to seconds
    
    # Refresh token expiry (default: 7 days)
    refresh_expiry_days = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7'))
    refresh_expiry = refresh_expiry_days * 24 * 60 * 60  # Convert to seconds
    
    now = datetime.utcnow()
    
    # Access token payload
    # type: 'access' distinguishes from refresh token
    access_payload = {
        'user_id': user_id,
        'email': email,
        'type': 'access',
        'exp': now + timedelta(seconds=access_expiry),  # Expires in 15 min
        'iat': now  # Issued at
    }
    
    # Refresh token payload
    # type: 'refresh' distinguishes from access token
    refresh_payload = {
        'user_id': user_id,
        'email': email,
        'type': 'refresh',
        'exp': now + timedelta(seconds=refresh_expiry),  # Expires in 7 days
        'iat': now
    }
    
    # Encode tokens
    access_token = jwt.encode(access_payload, secret_key, algorithm=algorithm)
    refresh_token = jwt.encode(refresh_payload, secret_key, algorithm=algorithm)
    
    return access_token, refresh_token, access_expiry


def verify_token(token):
    """
    Verify JWT token and extract payload.
    
    Args:
        token (str): JWT token to verify
    
    Returns:
        dict: Token payload if valid, None if invalid
    
    Exceptions:
      - jwt.ExpiredSignatureError: Token has expired
      - jwt.InvalidTokenError: Signature invalid or malformed
    
    Example:
      payload = verify_token(token_string)
      if payload:
          user_id = payload.get('user_id')
    """
    try:
        secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        return payload
    
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid signature or malformed


def send_password_reset_email(to_email, reset_url):
    """
    Send password reset email via Gmail SMTP.
    
    Args:
        to_email (str): Recipient email address
        reset_url (str): Full URL with reset token for email link
    
    Returns:
        bool: True if sent successfully, False otherwise
    
    Environment Variables Required:
      - MAIL_SERVER: Gmail SMTP server (smtp.gmail.com)
      - MAIL_PORT: SMTP port (587)
      - MAIL_USERNAME: Your Gmail email
      - MAIL_PASSWORD: Gmail App Password (16 chars, not regular password)
      - MAIL_FROM: "From" email address
    
    Gmail Setup:
      1. Enable 2FA on Gmail
      2. Go to: myaccount.google.com → Security → App passwords
      3. Select: Mail + Windows/Mac/Linux
      4. Copy 16-character password
      5. Put in .env: MAIL_PASSWORD=copied-password
    
    Example:
      reset_url = "http://localhost:3000/reset?token=eyJ..."
      send_password_reset_email('user@example.com', reset_url)
    """
    
    try:
        # Get email configuration from environment
        mail_server = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
        mail_port = int(os.getenv('MAIL_PORT', '587'))
        mail_username = os.getenv('MAIL_USERNAME')
        mail_password = os.getenv('MAIL_PASSWORD')
        mail_from = os.getenv('MAIL_FROM', 'noreply@expenseai.com')
        
        # Check if email config exists
        if not all([mail_username, mail_password]):
            print("⚠️ Email configuration incomplete (MAIL_USERNAME, MAIL_PASSWORD)")
            return False
        
        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'ExpenseAI - Password Reset Request'
        msg['From'] = mail_from
        msg['To'] = to_email
        
        # Plain text version
        text = f"""\
Hi,

You requested to reset your password. Click the link below:

{reset_url}

This link expires in 1 hour.

If you didn't request this, ignore this email.

Best regards,
ExpenseAI Team
"""
        
        # HTML version (prettier)
        html = f"""\
<html>
  <body>
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Reset Your ExpenseAI Password</h2>
      
      <p>You requested to reset your password. Click the button below:</p>
      
      <p style="margin: 30px 0;">
        <a href="{reset_url}" 
           style="background-color: #00D4FF; color: white; padding: 10px 20px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </p>
      
      <p style="color: #999; font-size: 12px;">
        Or copy this link: <code>{reset_url}</code>
      </p>
      
      <p style="color: #999; font-size: 12px;">
        This link expires in 1 hour.
      </p>
      
      <p style="color: #999; font-size: 12px;">
        If you didn't request this, please ignore this email.
      </p>
      
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        ExpenseAI - Smart Expense Tracker with AI
      </p>
    </div>
  </body>
</html>
"""
        
        # Attach both versions
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        # Connect to Gmail SMTP server and send
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()  # Secure connection
            server.login(mail_username, mail_password)
            server.send_message(msg)
        
        print(f"✅ Password reset email sent to {to_email}")
        return True
    
    except smtplib.SMTPAuthenticationError:
        print("❌ Email error: Invalid credentials (check MAIL_USERNAME, MAIL_PASSWORD)")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ Email error: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error sending email: {str(e)}")
        return False
