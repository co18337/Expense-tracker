"""
Main Entry Point - Run this file to start the Flask server
This is what you execute from terminal: python run.py
"""

from app import create_app

# What is this?
# create_app() is a function that creates and configures the Flask application
# We defined it in app/__init__.py
# It sets up the database, CORS, routes, everything needed
app = create_app()

# Run the Flask development server
# What does this do?
# Starts a web server on your computer that listens for requests
if __name__ == '__main__':
    # What is __name__?
    # Python special variable that equals '__main__' when file is run directly
    # (not when imported into another file)
    
    # host='0.0.0.0'
    # What: Listen on all network interfaces
    # Why: Allows access from other devices on your network
    # (though localhost is fine for development)
    
    # port=5000
    # What: The port number the server listens on
    # Why: Different services use different ports to avoid conflicts
    # Your server will be at: http://localhost:5000
    
    # debug=True
    # What: Enables debug mode
    # Why: Restarts server automatically when you save changes
    # Why2: Shows detailed error messages when something breaks
    # NOTE: Only use debug=True in development, NOT in production
    
    app.run(host='0.0.0.0', port=5000, debug=True)