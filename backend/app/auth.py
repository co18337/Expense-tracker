"""
Authentication Routes - Phase 0
Handles user registration, login, logout, token refresh, and password reset

Routes:
  POST /api/auth/register - Create new user account
  POST /api/auth/login - Login and get JWT tokens
  POST /api/auth/logout - Logout (client-side)
  POST /api/auth/refresh - Refresh access token
  POST /api/auth/forgot-password - Request password reset
  POST /api/auth/reset-password - Reset password with token
  GET /api/user/profile - Get current user profile
"""

from flask import Blueprint, request, jsonify, current_app
from app.models import db, User
from app.utils import (
    validate_email, 
    validate_password, 
    generate_tokens,
    send_password_reset_email
)
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps

# Create blueprint for auth routes
# url_prefix='/api/auth' means all routes start with /api/auth/
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register new user with email and password
    
    POST /api/auth/register
    
    Request body:
    {
        "email": "user@example.com",
        "password": "SecurePass123!",
        "password_confirm": "SecurePass123!"
    }
    
    Response (201 Created):
    {
        "success": true,
        "user_id": 1,
        "email": "user@example.com",
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "expires_in": 900
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        password_confirm = data.get('password_confirm', '')
        
        # Validate email format
        email_valid, email_error = validate_email(email)
        if not email_valid:
            return jsonify({'success': False, 'message': email_error}), 400
        
        # Check if email already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Validate passwords match
        if password != password_confirm:
            return jsonify({'success': False, 'message': 'Passwords do not match'}), 400
        
        # Validate password strength
        password_valid, password_error = validate_password(password)
        if not password_valid:
            return jsonify({'success': False, 'message': password_error}), 400
        
        # Create new user
        new_user = User(email=email)
        new_user.set_password(password)
        
        # Save to database
        db.session.add(new_user)
        db.session.commit()
        
        # Generate JWT tokens
        access_token, refresh_token, expires_in = generate_tokens(new_user.id, new_user.email)
        
        return jsonify({
            'success': True,
            'user_id': new_user.id,
            'email': new_user.email,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': expires_in
        }), 201
    
    except Exception as e:
        db.session.rollback()
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Registration failed'
        return jsonify({'success': False, 'message': error_msg}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login with email and password
    
    POST /api/auth/login
    
    Request body:
    {
        "email": "user@example.com",
        "password": "SecurePass123!"
    }
    
    Response (200 OK):
    {
        "success": true,
        "user_id": 1,
        "email": "user@example.com",
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "expires_in": 900
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No credentials provided'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password required'}), 400
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        # Verify credentials
        if not user or not user.check_password(password):
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        # Generate JWT tokens
        access_token, refresh_token, expires_in = generate_tokens(user.id, user.email)
        
        # Update last login time
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'user_id': user.id,
            'email': user.email,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': expires_in
        }), 200
    
    except Exception as e:
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Login failed'
        return jsonify({'success': False, 'message': error_msg}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Logout user (client-side token deletion)
    
    POST /api/auth/logout
    
    Note: JWT is stateless, so backend just confirms logout.
    Client deletes token from localStorage.
    
    Response (200 OK):
    {
        "success": true,
        "message": "Logged out successfully"
    }
    """
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """
    Refresh access token using refresh token
    Called when access_token expires (15 min) but refresh_token still valid (7 days)
    
    POST /api/auth/refresh
    
    Request body:
    {
        "refresh_token": "eyJ..."
    }
    
    Response (200 OK):
    {
        "success": true,
        "access_token": "eyJ...",
        "expires_in": 900
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'refresh_token' not in data:
            return jsonify({'success': False, 'message': 'Refresh token required'}), 400
        
        refresh_token_str = data.get('refresh_token')
        
        try:
            secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
            payload = jwt.decode(refresh_token_str, secret_key, algorithms=['HS256'])
            
            # Verify this is a refresh token
            if payload.get('type') != 'refresh':
                return jsonify({'success': False, 'message': 'Invalid token type'}), 401
            
            user_id = payload.get('user_id')
            
            # Get user and verify still exists
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': 'User not found'}), 401
            
            # Generate new access token only (refresh token stays same)
            algorithm = 'HS256'
            access_expiry = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '15')) * 60
            
            access_payload = {
                'user_id': user.id,
                'email': user.email,
                'type': 'access',
                'exp': datetime.utcnow() + timedelta(seconds=access_expiry),
                'iat': datetime.utcnow()
            }
            
            new_access_token = jwt.encode(access_payload, secret_key, algorithm=algorithm)
            
            return jsonify({
                'success': True,
                'access_token': new_access_token,
                'expires_in': access_expiry
            }), 200
        
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Refresh token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid refresh token'}), 401
    
    except Exception as e:
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Token refresh failed'
        return jsonify({'success': False, 'message': error_msg}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Request password reset email
    Sends reset link to user's email address
    
    POST /api/auth/forgot-password
    
    Request body:
    {
        "email": "user@example.com"
    }
    
    Response (200 OK):
    {
        "success": true,
        "message": "Password reset email sent"
    }
    
    Note: Returns success even if email doesn't exist (privacy protection)
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower() if data else ''
        
        if not email:
            # Still return success (don't leak if email exists)
            return jsonify({'success': True, 'message': 'If email exists, reset link has been sent'}), 200
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Generate reset token (valid for 1 hour)
            reset_token = user.generate_reset_token(expires_in=3600)
            
            # Send email with reset link
            reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset?token={reset_token}"
            send_password_reset_email(user.email, reset_url)
        
        # Always return success (privacy: don't confirm if email exists)
        return jsonify({
            'success': True,
            'message': 'If email exists, password reset link has been sent'
        }), 200
    
    except Exception as e:
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Password reset request failed'
        return jsonify({'success': False, 'message': error_msg}), 500


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password with reset token from email
    
    POST /api/auth/reset-password
    
    Request body:
    {
        "token": "reset-token-from-email",
        "password": "NewSecurePass123!",
        "password_confirm": "NewSecurePass123!"
    }
    
    Response (200 OK):
    {
        "success": true,
        "message": "Password reset successful"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        token = data.get('token', '')
        password = data.get('password', '')
        password_confirm = data.get('password_confirm', '')
        
        if not token:
            return jsonify({'success': False, 'message': 'Reset token required'}), 400
        
        # Verify reset token
        user_id = User.verify_reset_token(token)
        
        if not user_id:
            return jsonify({'success': False, 'message': 'Invalid or expired reset token'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Validate passwords match
        if password != password_confirm:
            return jsonify({'success': False, 'message': 'Passwords do not match'}), 400
        
        # Validate new password strength
        password_valid, password_error = validate_password(password)
        if not password_valid:
            return jsonify({'success': False, 'message': password_error}), 400
        
        # Update password
        user.set_password(password)
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Password reset successful'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Password reset failed'
        return jsonify({'success': False, 'message': error_msg}), 500


@auth_bp.route('/user/profile', methods=['GET'])
def get_profile():
    """
    Get current user's profile information
    Requires valid JWT token in Authorization header
    
    GET /api/auth/user/profile
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response (200 OK):
    {
        "success": true,
        "user_id": 1,
        "email": "user@example.com",
        "created_at": "2025-02-11 10:30:00",
        "total_expenses": 45,
        "total_spending": 15420.50
    }
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'message': 'Missing authorization token'}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            user_id = payload.get('user_id')
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token'}), 401
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            **user.to_dict()
        }), 200
    
    except Exception as e:
        error_msg = str(e) if os.getenv('FLASK_DEBUG') == 'True' else 'Failed to get profile'
        return jsonify({'success': False, 'message': error_msg}), 500
