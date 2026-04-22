"""
Authentication Decorators - Phase 0
Protects API endpoints and enforces JWT token validation

Decorators:
  @login_required - Check JWT token validity, add current_user to request context
  @token_required - Alias for @login_required

Usage:
  @api_bp.route('/api/expenses', methods=['GET'])
  @login_required
  def get_expenses():
      # current_user is available in request context
      user_id = g.current_user['user_id']
      expenses = Expense.query.filter_by(user_id=user_id).all()
      ...
"""

from functools import wraps
from flask import request, jsonify, g
import jwt
import os


def login_required(f):
    """
    Decorator to require valid JWT token for endpoint access.
    
    Behavior:
    1. Extract JWT token from Authorization header (Bearer <token>)
    2. Validate token signature and expiry
    3. Extract user_id and email from token payload
    4. Add to Flask g object (request-scoped) as current_user
    5. Pass to view function
    
    Returns:
      401 Unauthorized if:
        - Authorization header missing
        - Token format invalid
        - Token signature invalid (tampering)
        - Token expired
      200 OK if valid, executes decorated function
    
    Example:
      @app.route('/api/expenses')
      @login_required
      def get_expenses():
          user_id = g.current_user['user_id']  # Access current user
          ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Extract token from Authorization header
        # Expected format: "Authorization: Bearer <token>"
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            
            try:
                # Split "Bearer <token>" and extract token
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid token format'
                }), 401
        
        # Check if token exists
        if not token:
            return jsonify({
                'success': False,
                'message': 'Authorization token is missing'
            }), 401
        
        # Validate token
        try:
            # Get SECRET_KEY from environment
            secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
            
            # Decode and verify JWT
            # Raises exception if:
            #   - Signature is invalid (tampered token)
            #   - Token has expired
            #   - Algorithm is wrong
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            
            # Extract user info from token payload
            user_id = payload.get('user_id')
            email = payload.get('email')
            
            # Store in g object (request-scoped, available in view function)
            g.current_user = {
                'user_id': user_id,
                'email': email
            }
            
        except jwt.ExpiredSignatureError:
            # Token has expired (usually after 15 minutes for access token)
            return jsonify({
                'success': False,
                'message': 'Token has expired'
            }), 401
        
        except jwt.InvalidTokenError:
            # Token signature invalid or malformed
            return jsonify({
                'success': False,
                'message': 'Invalid token'
            }), 401
        
        except Exception as e:
            # Unexpected error
            return jsonify({
                'success': False,
                'message': 'Authentication failed'
            }), 401
        
        # Token is valid, proceed to view function
        return f(*args, **kwargs)
    
    return decorated_function


def token_required(f):
    """
    Alias for @login_required decorator.
    Same functionality, different name for readability.
    
    Can use interchangeably:
      @token_required
      @login_required
    
    Both do the same thing.
    """
    return login_required(f)
