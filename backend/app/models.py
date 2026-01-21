"""
Database Models - Define the structure of tables
This file defines what the expenses table looks like
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Create database instance
# This is the connection to your SQLite database
db = SQLAlchemy()


class Expense(db.Model):
    """
    Expense Model - Represents one expense in the database
    
    Each attribute below becomes a column in the expenses table:
    - id: Unique identifier for each expense
    - amount: How much money was spent
    - category: What type of expense (Food, Transport, etc.)
    - description: Details about the expense
    - date: The date the expense occurred
    - created_at: When the record was created in the system
    """
    
    # Table name in database (SQLite will create a table called "expense")
    __tablename__ = 'expense'
    
    # ===== Column Definitions =====
    
    # id: Primary key (unique identifier)
    # integer: Whole numbers only (1, 2, 3, etc.)
    # primary_key=True: This is the unique identifier
    # autoincrement=True: Database auto-generates 1, 2, 3, etc.
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    
    # amount: How much money spent
    # Float: Decimal numbers (500.50, 200.25, etc.)
    # nullable=False: Must always have a value (cannot be empty)
    amount = db.Column(db.Float, nullable=False)
    
    # category: Type of expense
    # String(50): Text up to 50 characters ('Food', 'Transport', etc.)
    # nullable=False: Cannot be empty
    category = db.Column(db.String(50), nullable=False)
    
    # description: Details about what was spent on
    # String(200): Text up to 200 characters
    # nullable=True: Optional (you might not always enter description)
    description = db.Column(db.String(200), nullable=True)
    
    # date: When the expense happened
    # Date: Stores dates in YYYY-MM-DD format
    # nullable=False: Must always have a date
    date = db.Column(db.Date, nullable=False)
    
    # created_at: When this record was created in system
    # DateTime: Stores both date and time (2025-12-27 15:30:45)
    # default=datetime.utcnow: Automatically set to current time when created
    # nullable=False: Cannot be empty
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # ===== Methods =====
    
    def to_dict(self):
        """
        What is this method?
        Converts the Expense object to a Python dictionary.
        Why? API responses need JSON, and dictionaries convert to JSON easily.
        
        Example:
        expense_object = Expense(id=1, amount=500, category='Food')
        expense_dict = expense_object.to_dict()
        # Returns: {'id': 1, 'amount': 500, 'category': 'Food', ...}
        """
        return {
            'id': self.id,
            'amount': self.amount,
            'category': self.category,
            'description': self.description,
            'date': self.date.strftime('%Y-%m-%d'),  # Convert date to string
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')  # Convert datetime to string
        }
    
    def __repr__(self):
        """
        What is this?
        Makes the object readable when printed in console.
        Why? For debugging - helps you see what object you're looking at.
        
        Example output: <Expense 1: 500 on Food>
        """
        return f'<Expense {self.id}: {self.amount} on {self.category}>'