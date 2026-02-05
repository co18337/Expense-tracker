"""
API Routes - Define all endpoints for the expense tracker
These are the URLs that the frontend will call
"""

from flask import Blueprint, request, jsonify
from app.models import db, Expense
from datetime import datetime, date

# Create a Blueprint
# What: Groups related routes together
# Why: Keeps code organized as app grows
# 'api' = blueprint name, url_prefix='/api' = all routes start with /api
api_bp = Blueprint('api', __name__, url_prefix='/api')


# ===== GET ENDPOINTS (Retrieve Data) =====

@api_bp.route('/expenses', methods=['GET'])
def get_all_expenses():
    """
    GET /api/expenses
    
    What: Retrieves ALL expenses from the database
    Why: Frontend needs to display all expenses on page load
    
    Returns: JSON list of all expenses
    Status: 200 (Success)
    """
    try:
        # Query database: get all expenses, ordered by date (newest first)
        # What is query()? Database command to retrieve records
        # Why .all()? Returns all matching records as a list
        # Why order_by(Expense.date.desc())? Newest expenses appear first
        expenses = Expense.query.order_by(Expense.date.desc()).all()
        
        # Convert list of Expense objects to list of dictionaries
        # Why? API responses must be JSON, and to_dict() converts to dictionary
        # which Flask automatically converts to JSON
        expenses_data = [expense.to_dict() for expense in expenses]
        
        # Return successful response
        return jsonify({
            'success': True,
            'message': 'Expenses retrieved successfully',
            'data': expenses_data,
            'count': len(expenses_data)
        }), 200
    
    except Exception as e:
        # If any error occurs, return error response
        return jsonify({
            'success': False,
            'message': f'Error retrieving expenses: {str(e)}'
        }), 500


@api_bp.route('/expenses/monthly', methods=['GET'])
def get_monthly_expenses():
    """
    GET /api/expenses/monthly?year=2025&month=12
    
    What: Retrieves expenses for a specific month and year
    Why: Frontend needs to filter by month for "View December" feature
    
    Query Parameters:
    - year: Year (2025)
    - month: Month (1-12)
    
    Returns: JSON list of expenses for that month
    Status: 200 (Success) or 400 (Bad Request)
    """
    try:
        # Get year and month from URL parameters
        # What is request.args.get()? Gets values from URL query string
        # Example: /api/expenses/monthly?year=2025&month=12
        # request.args.get('year') returns '2025'
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        # Validate that year and month were provided
        if not year or not month:
            return jsonify({
                'success': False,
                'message': 'Year and month are required'
            }), 400
        
        # Query expenses matching the month and year
        # Expense.date >= start_date filters for dates on or after start
        # Expense.date < end_date filters for dates before end
        expenses = Expense.query.filter(
            Expense.date >= date(year, month, 1),
            Expense.date < date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)
        ).order_by(Expense.date.desc()).all()
        
        expenses_data = [expense.to_dict() for expense in expenses]
        
        # Calculate total spending for the month
        total_amount = sum(expense['amount'] for expense in expenses_data)
        
        return jsonify({
            'success': True,
            'message': f'Expenses for {month}/{year} retrieved',
            'data': expenses_data,
            'count': len(expenses_data),
            'total': total_amount
        }), 200
    
    except ValueError:
        return jsonify({
            'success': False,
            'message': 'Invalid year or month format'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving monthly expenses: {str(e)}'
        }), 500


@api_bp.route('/expenses/<int:expense_id>', methods=['GET'])
def get_expense(expense_id):
    """
    GET /api/expenses/5
    
    What: Retrieves ONE specific expense by its ID
    Why: Frontend might need details of a single expense
    
    URL Parameter:
    - expense_id: The ID of the expense (5 in example above)
    
    Returns: JSON object of the expense
    Status: 200 (Success) or 404 (Not Found)
    """
    try:
        # Query for expense with specific ID
        # What is .first()? Returns only the first match (usually just 1 record)
        # If not found, returns None
        expense = Expense.query.filter_by(id=expense_id).first()
        
        # Check if expense exists
        if not expense:
            return jsonify({
                'success': False,
                'message': f'Expense with ID {expense_id} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': expense.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving expense: {str(e)}'
        }), 500


# ===== POST ENDPOINTS (Create Data) =====

@api_bp.route('/expenses', methods=['POST'])
def create_expense():
    """
    POST /api/expenses
    
    What: Creates a new expense
    Why: User fills form and clicks "Add Expense"
    
    Expected JSON in request body:
    {
        "amount": 500,
        "category": "Food",
        "description": "Lunch at restaurant",
        "date": "2025-12-27"
    }
    
    Returns: JSON object of created expense
    Status: 201 (Created) or 400 (Bad Request)
    """
    try:
        # Get JSON data from request
        # What is request.get_json()? Extracts JSON from request body
        data = request.get_json()
        
        # Validate required fields
        # Why validate? Prevent invalid data from entering database
        if not data or not all(k in data for k in ['amount', 'category', 'date']):
            return jsonify({
                'success': False,
                'message': 'Missing required fields: amount, category, date'
            }), 400
        
        # Validate amount
        # Why? Amount must be positive number
        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    'success': False,
                    'message': 'Amount must be greater than 0'
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'message': 'Amount must be a valid number'
            }), 400
        
        # Validate date format
        # Why? Must be in YYYY-MM-DD format
        try:
            expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            # Also check date is not in future
            if expense_date > date.today():
                return jsonify({
                    'success': False,
                    'message': 'Expense date cannot be in the future'
                }), 400
        except ValueError:
            return jsonify({
                'success': False,
                'message': 'Date must be in YYYY-MM-DD format'
            }), 400
        
        # Create new Expense object
        # This doesn't save to database yet, just creates the object in memory
        new_expense = Expense(
            amount=amount,
            category=data['category'],
            description=data.get('description', ''),  # Optional field
            date=expense_date
        )
        
        # Save to database
        # What is db.session.add()? Marks object to be added to database
        # What is db.session.commit()? Actually saves to database
        # Why two steps? Allows multiple additions before saving (transaction)
        db.session.add(new_expense)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense created successfully',
            'data': new_expense.to_dict()
        }), 201
    
    except Exception as e:
        # Rollback if error occurs
        # What is rollback? Cancels the transaction, prevents partial saves
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error creating expense: {str(e)}'
        }), 500


# ===== PUT ENDPOINTS (Update Data) =====

@api_bp.route('/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    """
    PUT /api/expenses/5
    
    What: Updates an existing expense
    Why: User clicks edit, changes amount, saves it
    
    Expected JSON in request body (can include any field to update):
    {
        "amount": 600,
        "category": "Transport",
        "description": "Taxi ride"
    }
    
    Returns: JSON object of updated expense
    Status: 200 (Success), 404 (Not Found), or 400 (Bad Request)
    """
    try:
        # Find the expense to update
        expense = Expense.query.filter_by(id=expense_id).first()
        
        if not expense:
            return jsonify({
                'success': False,
                'message': f'Expense with ID {expense_id} not found'
            }), 404
        
        # Get JSON data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided for update'
            }), 400
        
        # Update fields if provided
        # Why check 'in data'? User might only update one field, not all
        if 'amount' in data:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    'success': False,
                    'message': 'Amount must be greater than 0'
                }), 400
            expense.amount = amount
        
        if 'category' in data:
            expense.category = data['category']
        
        if 'description' in data:
            expense.description = data['description']
        
        if 'date' in data:
            try:
                expense.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Date must be in YYYY-MM-DD format'
                }), 400
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense updated successfully',
            'data': expense.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error updating expense: {str(e)}'
        }), 500


# ===== DELETE ENDPOINTS (Remove Data) =====

@api_bp.route('/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """
    DELETE /api/expenses/5
    
    What: Deletes an expense
    Why: User clicks delete button to remove an expense
    
    URL Parameter:
    - expense_id: The ID of the expense to delete
    
    Returns: JSON confirmation
    Status: 200 (Success) or 404 (Not Found)
    """
    try:
        # Find the expense to delete
        expense = Expense.query.filter_by(id=expense_id).first()
        
        if not expense:
            return jsonify({
                'success': False,
                'message': f'Expense with ID {expense_id} not found'
            }), 404
        
        # Delete the expense
        # What is db.session.delete()? Marks for deletion
        # What is db.session.commit()? Actually performs the deletion
        db.session.delete(expense)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense deleted successfully'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error deleting expense: {str(e)}'
        }), 500


# ===== STATISTICS ENDPOINTS =====

@api_bp.route('/expenses/stats/categories', methods=['GET'])
def get_category_stats():
    """
    GET /api/expenses/stats/categories
    
    What: Gets total spending by category
    Why: Frontend needs this to show pie chart of spending by category
    
    Returns: JSON with category breakdown
    Status: 200 (Success)
    """
    try:
        # Get all expenses
        expenses = Expense.query.all()
        
        # Group by category and sum amounts
        # What is defaultdict? Dictionary that returns default value for missing keys
        from collections import defaultdict
        category_totals = defaultdict(float)
        
        for expense in expenses:
            category_totals[expense.category] += expense.amount
        
        # Convert to list of dictionaries for JSON response
        stats = [
            {'category': cat, 'total': total}
            for cat, total in category_totals.items()
        ]
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving statistics: {str(e)}'
        }), 500

# ===== AI CHAT ENDPOINTS =====

"""
Phase 1: Updated Chat Routes
Handles all intents: ADD_EXPENSE, QUERY, HELP, UNKNOWN
"""

# from flask import Blueprint, request, jsonify
# from app.models import db, Expense
# from datetime import datetime, date

# api_bp = Blueprint('api', __name__, url_prefix='/api')

# ... (Keep all existing GET, POST, PUT, DELETE endpoints as they are)
# ... (Paste them from your current routes.py)
# ... (I'm only showing the updated /chat endpoint below)

from app.ai_service import create_expense_extractor

@api_bp.route('/chat', methods=['POST'])
def chat_with_ai():
    """
    Phase 1: Intent-based chat handler
    - Detects intent (ADD_EXPENSE, QUERY, HELP, UNKNOWN)
    - Handles each intent differently
    """
    try:
        data = request.get_json()
        message_raw = data.get('message', '').strip()

        if not message_raw:
            return jsonify({
                'success': False,
                'message': 'Please say something!'
            }), 400

        # Get known categories from DB
        existing_cats_query = db.session.query(Expense.category).distinct().all()
        known_categories = [row[0] for row in existing_cats_query]

        # Process message with Phase 1
        extractor = create_expense_extractor()
        result = extractor.process_message(message_raw, known_categories)

        intent = result.get("intent", "UNKNOWN")
        confidence = result.get("confidence", 0)
        response_text = result.get("response", "")

        # ===== HANDLE INTENT: ADD_EXPENSE =====
        if intent == "ADD_EXPENSE":
            is_complete = result.get("is_complete", False)

            if not is_complete:
                missing = result.get("missing_fields", [])
                return jsonify({
                    'success': True,
                    'intent': 'ADD_EXPENSE',
                    'needs_clarification': True,
                    'missing_fields': missing,
                    'extracted': result.get("data", {}),
                    'message': f"Got it! Missing: {', '.join(missing)}. {response_text}"
                }), 200

            # All fields present - ask for confirmation
            return jsonify({
                'success': True,
                'intent': 'ADD_EXPENSE',
                'needs_confirmation': True,
                'extracted': result.get("data", {}),
                'message': f"✅ {response_text}\n\nShall I save this?"
            }), 200

        # ===== HANDLE INTENT: QUERY =====
        elif intent == "QUERY":
            query_topic = result.get("query_topic", "")

            if query_topic == "total":
                total = sum(e.amount for e in Expense.query.all())
                msg = f"💰 Total spent: ₹{total:.2f}"
            elif query_topic == "category":
                cats = {}
                for e in Expense.query.all():
                    cats[e.category] = cats.get(e.category, 0) + e.amount
                msg = "📊 By Category:\n" + "\n".join([f"• {k}: ₹{v:.2f}" for k, v in sorted(cats.items(), key=lambda x: x[1], reverse=True)])
            elif query_topic == "month":
                now = date.today()
                this_month = [e for e in Expense.query.all() if datetime.strptime(e.date, "%Y-%m-%d").month == now.month]
                total = sum(e.amount for e in this_month)
                msg = f"📈 This month: ₹{total:.2f} ({len(this_month)} expenses)"
            else:
                msg = response_text

            return jsonify({
                'success': True,
                'intent': 'QUERY',
                'message': msg
            }), 200

        # ===== HANDLE INTENT: HELP =====
        elif intent == "HELP":
            help_text = f"""{response_text}

Examples:
• "Spent 500 on lunch" → Add expense
• "How much on food?" → Query spending
• "Show total" → Total expenses
• "This month?" → Monthly total
• "Category breakdown" → Expenses by category"""
            
            return jsonify({
                'success': True,
                'intent': 'HELP',
                'message': help_text
            }), 200

        # ===== HANDLE INTENT: UNKNOWN =====
        else:
            return jsonify({
                'success': True,
                'intent': 'UNKNOWN',
                'message': f"🤔 {response_text}\n\nTry: 'Spent 500 on food' or 'Total expenses?'"
            }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500


@api_bp.route('/chat/confirm', methods=['POST'])
def confirm_expense():
    """Confirm and save extracted expense"""
    try:
        data = request.get_json()

        if not all(k in data for k in ['amount', 'category', 'date']):
            return jsonify({
                'success': False,
                'message': 'Missing required fields'
            }), 400

        expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

        new_expense = Expense(
            amount=float(data['amount']),
            category=data['category'],
            description=data.get('description', ''),
            date=expense_date
        )

        db.session.add(new_expense)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"✅ Saved! ₹{data['amount']} on {data['category']}",
            'data': new_expense.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error saving: {str(e)}'
        }), 500


# Keep all your existing endpoints:
# @api_bp.route('/expenses', methods=['GET'])
# @api_bp.route('/expenses', methods=['POST'])
# @api_bp.route('/expenses/<int:expense_id>', methods=['GET'])
# @api_bp.route('/expenses/<int:expense_id>', methods=['PUT'])
# @api_bp.route('/expenses/<int:expense_id>', methods=['DELETE'])
# @api_bp.route('/expenses/stats/categories', methods=['GET'])
# ... etc
    """
    POST /api/chat/confirm
    
    What: User confirms extracted expense and we save it
    Why: Final step before adding to database
    
    Expected JSON:
    {
        "amount": 500,
        "category": "Food",
        "description": "Pizza",
        "date": "2025-12-27"
    }
    
    Returns: Confirmation with saved expense
    Status: 201 or 400
    """
    try:
        data = request.get_json()
        
        # Validate
        if not all(k in data for k in ['amount', 'category', 'date']):
            return jsonify({
                'success': False,
                'message': 'Missing required fields'
            }), 400
        
        # Create and save expense
        expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

        new_expense = Expense(
            amount=float(data['amount']),
            category=data['category'],
            description=data.get('description', ''),
            date=expense_date   # ✅ Python date object
        )

        
        db.session.add(new_expense)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f"✅ Expense saved! ₹{data['amount']} added to {data['category']}",
            'data': new_expense.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error saving expense: {str(e)}'
        }), 500


@api_bp.route('/chat/recurring', methods=['GET'])
def get_recurring_suggestions():
    """
    GET /api/chat/recurring
    
    What: Detects recurring expense patterns
    Why: Suggest "You usually spend ~500 on food every Friday"
    
    Returns: List of recurring patterns
    Status: 200
    """
    try:
        extractor = create_expense_extractor()
        patterns = extractor.detect_recurring()
        
        return jsonify({
            'success': True,
            'patterns': patterns,
            'message': f'Found {len(patterns)} recurring patterns' if patterns else 'No recurring patterns detected yet'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500


@api_bp.route('/chat/summary', methods=['GET'])
def get_expense_summary():
    """
    GET /api/chat/summary
    
    What: Quick summary of today's expenses
    Why: Users want daily insight without opening dashboard
    
    Returns: Formatted summary text
    Status: 200
    """
    try:
        extractor = create_expense_extractor()
        summary = extractor.suggest_expense_summary()
        
        return jsonify({
            'success': True,
            'summary': summary
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500