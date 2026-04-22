"""
Flask Application Factory
Phase 0: Initialize Flask app with database and authentication
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Initialize database
db = SQLAlchemy()

# Initialize migrations
migrate = Migrate()


def create_app():
    """
    Application factory - creates and configures Flask app
    
    Returns:
        Flask: Configured Flask application
    """
    app = Flask(__name__)
    
    # ===== CONFIGURATION =====
    
    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'sqlite:////home/prince/Documents/My Projects/expense-tracker/backend/instance/expense_tracker.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # JWT Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JWT_SECRET_KEY'] = app.config['SECRET_KEY']
    
    # CORS Configuration
    app.config['CORS_HEADERS'] = 'Content-Type'
    
    # ===== INITIALIZE EXTENSIONS =====
    
    # Initialize database with app
    db.init_app(app)
    
    # Initialize migrations with app
    migrate.init_app(app, db)
    
    # Initialize CORS
    CORS(app)
    
    # ===== IMPORT MODELS (IMPORTANT for migrations!) =====
    # These imports MUST happen here so Alembic can see them
    from app.models import User, Expense
    
    # ===== REGISTER BLUEPRINTS =====
    
    # Import and register blueprints AFTER db initialization
    from app.routes import api_bp
    from app.auth import auth_bp
    
    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    
    print("✅ Flask app initialized successfully")
    print(f"📊 Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    return app
