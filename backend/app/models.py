"""
Database Models - Define the structure of tables
This file defines User and Expense models with authentication support

Phase 0: Added User model for multi-user authentication
"""

from app import db  # IMPORTANT: Import from app, not create new instance
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt
import os


class User(db.Model):
    """
    User Model - Represents a user account in the system
    
    Attributes:
        id: Unique identifier for user
        email: User's email (unique, used for login)
        password_hash: Hashed password (never store plaintext)
        created_at: When account was created
        updated_at: Last updated timestamp
        expenses: Relationship to user's expenses
    
    Phase 0: Core model for authentication system
    """
    
    __tablename__ = 'user'
    
    # Primary key
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    
    # Email (unique identifier for login)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    
    # Password (hashed with bcrypt, never plaintext)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to expenses (one user has many expenses)
    expenses = db.relationship('Expense', backref='owner', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """
        Hash password using werkzeug security.
        Never store plaintext passwords.
        
        Args:
            password (str): Plain text password from user input
        
        Returns:
            None (updates self.password_hash)
        """
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """
        Verify password against stored hash.
        Used during login to validate credentials.
        
        Args:
            password (str): Plain text password to verify
        
        Returns:
            bool: True if password matches, False otherwise
        """
        return check_password_hash(self.password_hash, password)
    
    def generate_reset_token(self, expires_in=3600):
        """
        Generate a JWT token for password reset.
        Token expires after 1 hour (default).
        
        Args:
            expires_in (int): Token expiry in seconds (default: 3600 = 1 hour)
        
        Returns:
            str: JWT reset token
        """
        payload = {
            'reset_user_id': self.id,
            'exp': datetime.utcnow() + timedelta(seconds=expires_in),
            'iat': datetime.utcnow(),
            'purpose': 'password_reset'
        }
        
        secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
        token = jwt.encode(payload, secret_key, algorithm='HS256')
        return token
    
    @staticmethod
    def verify_reset_token(token):
        """
        Verify a password reset token and extract user ID.
        
        Args:
            token (str): JWT reset token from email link
        
        Returns:
            int: User ID if valid, None if invalid/expired
        """
        try:
            secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            
            # Verify this is a reset token (not access token)
            if payload.get('purpose') != 'password_reset':
                return None
            
            return payload.get('reset_user_id')
        
        except jwt.ExpiredSignatureError:
            # Token expired
            return None
        except jwt.InvalidTokenError:
            # Invalid token signature
            return None
    
    def to_dict(self):
        """
        Convert User to dictionary (exclude password for API responses).
        Used when returning user data to frontend.
        
        Returns:
            dict: User info without password_hash
        """
        return {
            'user_id': self.id,
            'email': self.email,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'total_expenses': len(self.expenses),
            'total_spending': sum(e.amount for e in self.expenses)
        }
    
    def __repr__(self):
        """String representation for debugging"""
        return f'<User {self.id}: {self.email}>'


class Expense(db.Model):
    """
    Expense Model - Represents a user's expense transaction
    
    Attributes:
        id: Unique identifier for expense
        amount: Amount spent
        category: Category of expense
        description: Details about the expense
        date: Date of the expense
        user_id: Foreign key to User (who owns this expense)
        created_at: When record was created
    
    Phase 0: Modified to add user_id for multi-user support
    """
    
    __tablename__ = 'expense'
    
    # ===== Column Definitions =====
    
    # Primary key
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    
    # Amount spent (float for decimals: 500.50)
    amount = db.Column(db.Float, nullable=False)
    
    # Category (Food, Transport, etc.)
    category = db.Column(db.String(50), nullable=False)
    
    # Description (optional details)
    description = db.Column(db.String(200), nullable=True)
    
    # Date of expense (YYYY-MM-DD format)
    date = db.Column(db.Date, nullable=False)
    
    # Foreign key to User table (NEW in Phase 0)
    # Every expense must belong to a user
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    
    # Timestamp when record was created
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # ===== Methods =====
    
    def to_dict(self):
        """
        Convert Expense to dictionary for API responses.
        
        Returns:
            dict: Expense with all fields as JSON-serializable types
        """
        return {
            'id': self.id,
            'amount': self.amount,
            'category': self.category,
            'description': self.description,
            'date': self.date.strftime('%Y-%m-%d'),
            'user_id': self.user_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def __repr__(self):
        """String representation for debugging"""
        return f'<Expense {self.id}: {self.amount} on {self.category}>'
