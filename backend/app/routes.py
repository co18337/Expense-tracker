"""
API Routes - Define all endpoints for the expense tracker
These are the URLs that the frontend will call
"""

from flask import Blueprint, request, jsonify
from app.models import db, Expense
from datetime import datetime, date

from app.ai_service import create_expense_extractor

# Create a Blueprint
# What: Groups related routes together
# Why: Keeps code organized as app grows
# 'api' = blueprint name, url_prefix='/api' = all routes start with /api
api_bp = Blueprint("api", __name__, url_prefix="/api")

from app.decorators import login_required
from flask import g

# Add @login_required to ALL endpoints:


# ===== GET ENDPOINTS (Retrieve Data) =====


@api_bp.route("/expenses", methods=["GET"])
@login_required  # ADD THIS
def get_all_expenses():
    """
    GET /api/expenses

    What: Retrieves ALL expenses for the current user
    Why: Frontend needs to display user's expenses on page load

    Returns: JSON list of user's expenses
    Status: 200 (Success)
    """
    try:
        user_id = g.current_user["user_id"]

        # Query database: get user's expenses, ordered by date (newest first)
        expenses = (
            Expense.query.filter_by(user_id=user_id).order_by(Expense.date.desc()).all()
        )

        # Convert list of Expense objects to list of dictionaries
        expenses_data = [expense.to_dict() for expense in expenses]

        # Return successful response
        return (
            jsonify(
                {
                    "success": True,
                    "message": "Expenses retrieved successfully",
                    "data": expenses_data,
                    "count": len(expenses_data),
                }
            ),
            200,
        )

    except Exception as e:
        # If any error occurs, return error response
        return (
            jsonify(
                {"success": False, "message": f"Error retrieving expenses: {str(e)}"}
            ),
            500,
        )


@api_bp.route("/expenses/monthly", methods=["GET"])
@login_required
def get_monthly_expenses():
    """
    GET /api/expenses/monthly?year=2025&month=12

    What: Retrieves expenses for a specific month and year for current user
    Why: Frontend needs to filter by month for "View December" feature

    Query Parameters:
    - year: Year (2025)
    - month: Month (1-12)

    Returns: JSON list of expenses for that month
    Status: 200 (Success) or 400 (Bad Request)
    """
    try:
        user_id = g.current_user["user_id"]

        # Get year and month from URL parameters
        year = request.args.get("year", type=int)
        month = request.args.get("month", type=int)

        # Validate that year and month were provided
        if not year or not month:
            return (
                jsonify({"success": False, "message": "Year and month are required"}),
                400,
            )

        # Query expenses matching the month and year for this user
        expenses = (
            Expense.query.filter(
                Expense.user_id == user_id,
                Expense.date >= date(year, month, 1),
                (
                    Expense.date < date(year, month + 1, 1)
                    if month < 12
                    else date(year + 1, 1, 1)
                ),
            )
            .order_by(Expense.date.desc())
            .all()
        )

        expenses_data = [expense.to_dict() for expense in expenses]

        # Calculate total spending for the month
        total_amount = sum(expense["amount"] for expense in expenses_data)

        return (
            jsonify(
                {
                    "success": True,
                    "message": f"Expenses for {month}/{year} retrieved",
                    "data": expenses_data,
                    "count": len(expenses_data),
                    "total": total_amount,
                }
            ),
            200,
        )

    except ValueError:
        return (
            jsonify({"success": False, "message": "Invalid year or month format"}),
            400,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error retrieving monthly expenses: {str(e)}",
                }
            ),
            500,
        )


@api_bp.route("/expenses/<int:expense_id>", methods=["GET"])
@login_required
def get_expense(expense_id):
    """
    GET /api/expenses/5

    What: Retrieves ONE specific expense by its ID for current user
    Why: Frontend might need details of a single expense

    URL Parameter:
    - expense_id: The ID of the expense (5 in example above)

    Returns: JSON object of the expense
    Status: 200 (Success) or 404 (Not Found)
    """
    try:
        user_id = g.current_user["user_id"]

        # Query for expense with specific ID belonging to user
        expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()

        # Check if expense exists
        if not expense:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": f"Expense with ID {expense_id} not found",
                    }
                ),
                404,
            )

        return jsonify({"success": True, "data": expense.to_dict()}), 200

    except Exception as e:
        return (
            jsonify(
                {"success": False, "message": f"Error retrieving expense: {str(e)}"}
            ),
            500,
        )


# ===== POST ENDPOINTS (Create Data) =====


@api_bp.route("/expenses", methods=["POST"])
@login_required
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
        user_id = g.current_user["user_id"]

        # Get JSON data from request
        # What is request.get_json()? Extracts JSON from request body
        data = request.get_json()

        # Validate required fields
        # Why validate? Prevent invalid data from entering database
        if not data or not all(k in data for k in ["amount", "category", "date"]):
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Missing required fields: amount, category, date",
                    }
                ),
                400,
            )

        # Validate amount
        # Why? Amount must be positive number
        try:
            amount = float(data["amount"])
            if amount <= 0:
                return (
                    jsonify(
                        {"success": False, "message": "Amount must be greater than 0"}
                    ),
                    400,
                )
        except (ValueError, TypeError):
            return (
                jsonify({"success": False, "message": "Amount must be a valid number"}),
                400,
            )

        # Validate date format
        # Why? Must be in YYYY-MM-DD format
        try:
            expense_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            # Also check date is not in future
            if expense_date > date.today():
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "Expense date cannot be in the future",
                        }
                    ),
                    400,
                )
        except ValueError:
            return (
                jsonify(
                    {"success": False, "message": "Date must be in YYYY-MM-DD format"}
                ),
                400,
            )

        # Create new Expense object
        # This doesn't save to database yet, just creates the object in memory
        new_expense = Expense(
            amount=amount,
            category=data["category"],
            description=data.get("description", ""),  # Optional field
            date=expense_date,
            user_id=user_id,
        )

        # Save to database
        # What is db.session.add()? Marks object to be added to database
        # What is db.session.commit()? Actually saves to database
        # Why two steps? Allows multiple additions before saving (transaction)
        db.session.add(new_expense)
        db.session.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Expense created successfully",
                    "data": new_expense.to_dict(),
                }
            ),
            201,
        )

    except Exception as e:
        # Rollback if error occurs
        # What is rollback? Cancels the transaction, prevents partial saves
        db.session.rollback()
        return (
            jsonify({"success": False, "message": f"Error creating expense: {str(e)}"}),
            500,
        )


# ===== PUT ENDPOINTS (Update Data) =====


@api_bp.route("/expenses/<int:expense_id>", methods=["PUT"])
@login_required
def update_expense(expense_id):
    """
    PUT /api/expenses/5

    What: Updates an existing expense for current user
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
        user_id = g.current_user["user_id"]

        # Find the expense to update (belonging to user)
        expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()

        if not expense:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": f"Expense with ID {expense_id} not found",
                    }
                ),
                404,
            )

        # Get JSON data
        data = request.get_json()

        if not data:
            return (
                jsonify({"success": False, "message": "No data provided for update"}),
                400,
            )

        # Update fields if provided
        if "amount" in data:
            amount = float(data["amount"])
            if amount <= 0:
                return (
                    jsonify(
                        {"success": False, "message": "Amount must be greater than 0"}
                    ),
                    400,
                )
            expense.amount = amount

        if "category" in data:
            expense.category = data["category"]

        if "description" in data:
            expense.description = data["description"]

        if "date" in data:
            try:
                expense.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            except ValueError:
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "Date must be in YYYY-MM-DD format",
                        }
                    ),
                    400,
                )

        # Save changes
        db.session.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Expense updated successfully",
                    "data": expense.to_dict(),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return (
            jsonify({"success": False, "message": f"Error updating expense: {str(e)}"}),
            500,
        )


# ===== DELETE ENDPOINTS (Remove Data) =====


@api_bp.route("/expenses/<int:expense_id>", methods=["DELETE"])
@login_required
def delete_expense(expense_id):
    """
    DELETE /api/expenses/5

    What: Deletes an expense for current user
    Why: User clicks delete button to remove an expense

    URL Parameter:
    - expense_id: The ID of the expense to delete

    Returns: JSON confirmation
    Status: 200 (Success) or 404 (Not Found)
    """
    try:
        user_id = g.current_user["user_id"]

        # Find the expense to delete (belonging to user)
        expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()

        if not expense:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": f"Expense with ID {expense_id} not found",
                    }
                ),
                404,
            )

        # Delete the expense
        db.session.delete(expense)
        db.session.commit()

        return (
            jsonify({"success": True, "message": "Expense deleted successfully"}),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return (
            jsonify({"success": False, "message": f"Error deleting expense: {str(e)}"}),
            500,
        )


# ===== STATISTICS ENDPOINTS =====


@api_bp.route("/expenses/stats/categories", methods=["GET"])
@login_required
def get_category_stats():
    """
    GET /api/expenses/stats/categories

    What: Gets total spending by category for current user
    Why: Frontend needs this to show pie chart of spending by category

    Returns: JSON with category breakdown
    Status: 200 (Success)
    """
    try:
        user_id = g.current_user["user_id"]

        # Get user's expenses
        expenses = Expense.query.filter_by(user_id=user_id).all()

        # Group by category and sum amounts
        from collections import defaultdict

        category_totals = defaultdict(float)

        for expense in expenses:
            category_totals[expense.category] += expense.amount

        # Convert to list of dictionaries for JSON response
        stats = [
            {"category": cat, "total": total} for cat, total in category_totals.items()
        ]

        return jsonify({"success": True, "data": stats}), 200

    except Exception as e:
        return (
            jsonify(
                {"success": False, "message": f"Error retrieving statistics: {str(e)}"}
            ),
            500,
        )


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


@api_bp.route("/chat", methods=["POST"])
@login_required
def chat_with_ai():
    """Simple chat endpoint with History, Smart Search & Duplicate Detection"""
    try:
        user_id = g.current_user["user_id"]
        data = request.get_json()
        message_raw = data.get("message", "").strip()
        history = data.get("history", [])

        if not message_raw:
            return jsonify({"success": False, "message": "Say something!"}), 400

        # Categories - only for this user
        existing_cats = (
            db.session.query(Expense.category)
            .filter_by(user_id=user_id)
            .distinct()
            .all()
        )
        known_categories = [row[0] for row in existing_cats]

        # AI Process
        extractor = create_expense_extractor()
        result = extractor.process_message(message_raw, known_categories, history)
        intent = result.get("intent", "UNKNOWN")

        # ===== ADD_EXPENSE LOGIC =====
        if intent == "ADD_EXPENSE":
            is_complete = result.get("is_complete", False)
            extracted_data = result.get("data", {})

            if not is_complete:
                missing = result.get("missing_fields", [])
                return (
                    jsonify(
                        {
                            "success": True,
                            "intent": "ADD_EXPENSE",
                            "needs_clarification": True,
                            "missing_fields": missing,
                            "extracted": extracted_data,
                            "message": f"Missing: {', '.join(missing)}",
                        }
                    ),
                    200,
                )

            # ✅ ROBUST DUPLICATE CHECK (ID Based) - for this user only
            try:
                # 1. Parse date
                ex_date = datetime.strptime(extracted_data["date"], "%Y-%m-%d").date()

                # 2. Find the VERY LAST expense added by this user
                last_entry = (
                    Expense.query.filter_by(user_id=user_id)
                    .order_by(Expense.id.desc())
                    .first()
                )

                # 3. Compare
                if (
                    last_entry
                    and last_entry.category == extracted_data["category"]
                    and last_entry.date == ex_date
                ):
                    print(f"DEBUG: Potential Duplicate Found! ID: {last_entry.id}")

                    return (
                        jsonify(
                            {
                                "success": True,
                                "intent": "ADD_EXPENSE",
                                "needs_confirmation": True,
                                "extracted": extracted_data,
                                "potential_duplicate": {
                                    "id": last_entry.id,
                                    "amount": last_entry.amount,
                                    "category": last_entry.category,
                                },
                                "message": f"I noticed you just added {last_entry.category} for ₹{last_entry.amount}. Do you want to UPDATE that entry to ₹{extracted_data['amount']} or create a NEW one?",
                            }
                        ),
                        200,
                    )
                else:
                    print("DEBUG: No recent duplicate found.")

            except Exception as e:
                print(f"DEBUG: Duplicate check error: {e}")
                # Continue normally

            # Normal Confirmation
            return (
                jsonify(
                    {
                        "success": True,
                        "intent": "ADD_EXPENSE",
                        "needs_confirmation": True,
                        "extracted": extracted_data,
                        "message": f"Save ₹{extracted_data['amount']} on {extracted_data['category']}?",
                    }
                ),
                200,
            )

        # ===== QUERY =====
        elif intent == "QUERY":
            query_info = result.get("query_info", {})
            scope = query_info.get("scope", "TOTAL")
            category = query_info.get("category")
            search_term = query_info.get("search_term")

            expenses = extractor.search_expenses(scope, category, search_term)

            if not expenses:
                msg = "No expenses found."
                if search_term:
                    msg += f" matching '{search_term}'"
                return (
                    jsonify({"success": True, "intent": "QUERY", "message": msg}),
                    200,
                )

            total = sum(e.amount for e in expenses)
            msg = f"🔍 **Found {len(expenses)} expenses**"
            if search_term:
                msg += f" for '{search_term}'"
            msg += f":\n**Total: ₹{total:.2f}**\n\n"

            for e in expenses[:5]:
                desc = f"({e.description})" if e.description else ""
                msg += f"• {e.date.strftime('%d %b')}: ₹{e.amount} {desc}\n"

            return jsonify({"success": True, "intent": "QUERY", "message": msg}), 200

        elif intent == "HELP":
            return (
                jsonify(
                    {
                        "success": True,
                        "intent": "HELP",
                        "message": "Try 'Spent 500 on Food' or 'Update that to 600'.",
                    }
                ),
                200,
            )
        else:
            return (
                jsonify(
                    {
                        "success": True,
                        "intent": "UNKNOWN",
                        "message": result.get("response", "I didn't catch that."),
                    }
                ),
                200,
            )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@api_bp.route("/chat/confirm", methods=["POST"])
@login_required
def confirm_expense():
    """Save expense"""
    try:
        user_id = g.current_user["user_id"]
        data = request.get_json()

        if not all(k in data for k in ["amount", "category", "date"]):
            return jsonify({"success": False, "message": "Missing fields"}), 400

        expense_date = datetime.strptime(data["date"], "%Y-%m-%d").date()

        new_expense = Expense(
            amount=float(data["amount"]),
            category=data["category"],
            description=data.get("description", ""),
            date=expense_date,
            user_id=user_id,
        )

        db.session.add(new_expense)
        db.session.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": f"✅ Saved! ₹{data['amount']} on {data['category']}",
                    "data": new_expense.to_dict(),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        print(f"Chat confirm error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@api_bp.route("/chat/recurring", methods=["GET"])
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

        return (
            jsonify(
                {
                    "success": True,
                    "patterns": patterns,
                    "message": (
                        f"Found {len(patterns)} recurring patterns"
                        if patterns
                        else "No recurring patterns detected yet"
                    ),
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500


@api_bp.route("/chat/summary", methods=["GET"])
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

        return jsonify({"success": True, "summary": summary}), 200

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
