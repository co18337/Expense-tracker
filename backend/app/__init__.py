"""
Flask Application Initialization
This file sets up the Flask app and database connection
"""

from flask import Flask
from flask_cors import CORS
from app.models import db


def create_app():
    """
    What is this function?
    Creates and configures the Flask application.
    
    Why a function instead of just creating the app directly?
    - Allows creating multiple app instances (useful for testing)
    - Keeps configuration in one place
    - Professional best practice
    
    Returns: A configured Flask application
    """
    
    # Create Flask app instance
    # __name__ tells Flask where this app is located
    app = Flask(__name__)
    
    # ===== Configuration =====
    
    # SQLALCHEMY_DATABASE_URI
    # What: Tells SQLAlchemy where the database file is located
    # Why: SQLAlchemy needs to know what database to connect to
    # 'sqlite:///expense_tracker.db' means:
    #   - sqlite: Use SQLite (not PostgreSQL or MySQL)
    #   - :/// Three slashes because it's a local file path
    #   - expense_tracker.db: Name of the database file
    # This file will be created automatically in the backend folder
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expense_tracker.db'
    
    # SQLALCHEMY_TRACK_MODIFICATIONS
    # What: Tells SQLAlchemy whether to track object modifications
    # Why: False is better for performance (we don't need this feature for our app)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # ===== Database Initialization =====
    
    # Initialize the database with this app
    # This connects our db object (from models.py) to this Flask app
    db.init_app(app)
    
    # ===== CORS Configuration =====
    
    # CORS = Cross-Origin Resource Sharing
    # What: Allows your frontend (browser) to make requests to your backend
    # Why: Without this, browsers block requests between different URLs
    # In our case:
    #   - Frontend: http://localhost:3000 or file://index.html
    #   - Backend: http://localhost:5000
    # These are different "origins", so without CORS, communication fails
    CORS(app)
    
    # ===== Database Table Creation =====
    
    # Create app context
    # What: A context tells Flask what app we're working with
    # Why: Some operations (like creating tables) need to know which app to use
    with app.app_context():
        # Create all tables defined in models.py
        # If tables don't exist, create them
        # If they already exist, do nothing (won't overwrite)
        db.create_all()
    
    # ===== Register Routes =====
    
    # Import routes after db initialization to avoid circular imports
    # What is circular import? When File A imports File B, and File B imports File A
    # Why avoid it? Creates infinite loop that crashes the app
    # By importing routes here (after db is ready), we avoid this problem
    from app.routes import api_bp
    app.register_blueprint(api_bp)
    
    return app