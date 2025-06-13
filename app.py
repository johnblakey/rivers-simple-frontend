"""
Main Flask application for the Rivers Backend API.
Handles river data, user preferences, and authentication.
"""
import os
import logging
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import datastore, exceptions as google_cloud_exceptions
from pythonjsonlogger import jsonlogger # For structured logging
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin.exceptions import FirebaseError

# Environment variables (from your README context)
ENVIRONMENT= os.environ.get('ENVIRONMENT')
PROJECT_ID = os.environ.get('PROJECT_ID')
WATER_LEVEL_KIND = os.environ.get('WATER_LEVEL_KIND', 'riverTimeSeriesData')
RIVER_DETAILS_KIND = os.environ.get('RIVER_DETAILS_KIND', 'riverDetails')
USER_PREFERENCES_KIND = os.environ.get('USER_PREFERENCES_KIND', 'userPreferences')
DATASTORE_NAMESPACE = os.environ.get('DATASTORE_NAMESPACE')
USER_NOTES_KIND = os.environ.get('USER_NOTES_KIND', 'userNotes')

app = Flask(__name__)

# Initialize Firebase Admin SDK
try:
    firebase_admin.initialize_app()
    app.logger.info("Firebase Admin SDK initialized successfully")
except ValueError as e: # Specific for initialization config issues
    app.logger.error("Failed to initialize Firebase Admin SDK (ValueError): %s", e)
except FirebaseError as e: # Broader Firebase errors
    app.logger.error("Failed to initialize Firebase Admin SDK (FirebaseError): %s", e)


# Logging Configuration
if ENVIRONMENT == 'production':
    # For production, use JSON structured logging
    log_handler = logging.StreamHandler() # Logs to stdout/stderr
    formatter = jsonlogger.JsonFormatter(
        fmt='%(asctime)s %(levelname)s %(name)s %(module)s '
            '%(funcName)s %(lineno)d %(message)s'
    )
    log_handler.setFormatter(formatter)

    app.logger.handlers.clear() # Remove default Flask handler
    app.logger.addHandler(log_handler)
    app.logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO').upper())
    app.logger.info("JSON structured logging initialized for production.")
else:
    # For local development, Flask's default Werkzeug logger is often sufficient.
    # Flask's default logger is already set up.
    app.logger.setLevel(logging.DEBUG)
    app.logger.info("Default Flask logging initialized for development.")

# TODO - does not limit directly calling this backend, add Google IAM to prevent

# Define common CORS parameters.
COMMON_CORS_PARAMS = {
    "methods": ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "supports_credentials": True,  # Important for sending auth tokens/cookies
    "max_age": 86400  # Cache preflight response for 1 day
}
# Enable CORS based on environment
if ENVIRONMENT == 'production':
    allowed_origins = "https://rivers.johnblakey.org"
    CORS(app, origins=allowed_origins, **COMMON_CORS_PARAMS)
    app.logger.info("CORS configured for PRODUCTION, allowing origin: %s", allowed_origins)
elif ENVIRONMENT == 'development':
    # Allow all origins in development for simplicity.
    # For more specific control, you can list your dev origins:
    # allowed_origins = ["http://localhost:5173", "http://localhost:8080"]
    allowed_origins = "*"
    CORS(app, origins=allowed_origins, **COMMON_CORS_PARAMS)
    app.logger.info("CORS configured for DEVELOPMENT, allowing all origins.")
else:
    allowed_origins = "*" # Default to allow all if ENVIRONMENT is not set or unexpected
    if ENVIRONMENT is None:
        app.logger.error( # More severe logging for missing critical variable
            "CRITICAL: 'ENVIRONMENT' environment variable is not set. "
            "Applying default permissive CORS(app). THIS IS INSECURE FOR PRODUCTION."
        )
    else:
        app.logger.warning(
            "ENVIRONMENT variable has an unexpected value: '%s'. Expected 'production' or 'development'. "
            "Applying default permissive CORS(app). Review for security implications.", ENVIRONMENT
        )
    CORS(app, origins=allowed_origins, **COMMON_CORS_PARAMS)
    app.logger.info("CORS configured with default (allow all origins) due to ENVIRONMENT setting.")

# Initialize Datastore client
if PROJECT_ID:
    datastore_client = datastore.Client(project=PROJECT_ID, namespace=DATASTORE_NAMESPACE)
else:
    # Fallback for local development if PROJECT_ID is not set (e.g. using Datastore emulator)
    # Ensure GOOGLE_CLOUD_PROJECT is set in your local env or Datastore emulator is configured.
    datastore_client = datastore.Client(namespace=DATASTORE_NAMESPACE)
    if not datastore_client.project and ENVIRONMENT != 'test': # Avoid log during tests
        app.logger.warning(
            "PROJECT_ID environment variable is not set. Datastore client may not "
            "work as expected without a project ID or emulator configuration."
        )

# Authentication decorator
def require_auth(f):
    """
    Decorator to ensure the request is authenticated with a valid Firebase ID token.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip authentication entirely for OPTIONS requests to allow CORS preflight
        if request.method == 'OPTIONS':
            # For OPTIONS requests, we should not execute the wrapped function's main logic,
            # especially if it relies on `request.user`.
            # Return a simple 200 OK response; Flask-CORS will add the necessary headers.
            return jsonify(message="CORS preflight check successful"), 200

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify(error="Missing or invalid authorization header"), 401

        id_token = auth_header.split('Bearer ')[1]

        try:
            # Verify the Firebase ID token
            decoded_token = firebase_auth.verify_id_token(id_token)
            request.user = decoded_token  # Add user info to request object
        except firebase_auth.AuthError as e: # pylint: disable=E1101
            app.logger.warning("Invalid token: %s", str(e))
            return jsonify(error="Invalid authentication token"), 401
        except Exception as e:  # Catch any other authentication errors
            app.logger.error("Authentication error: %s", str(e))
            return jsonify(error="Authentication failed"), 401

        return f(*args, **kwargs)
    return decorated_function

# Standardized Error Handlers
@app.errorhandler(404)
def not_found_error(error):
    """
    Handles 404 Not Found errors with a JSON response.
    """
    app.logger.info("Resource not found: %s", error)
    return jsonify(error="The requested resource was not found."), 404

@app.errorhandler(500)
def internal_server_error(error):
    """
    Handles 500 Internal Server errors with a JSON response and logs the error.
    """
    app.logger.error("An internal server error occurred: %s", error, exc_info=True)
    return jsonify(error="An internal server error occurred. Please try again later."), 500

@app.route('/')
def home():
    """
    Serves a welcome message for the API root.
    """
    return jsonify(message="Welcome to the Rivers Backend API!"), 200

@app.route('/riverdetails', methods=['GET'])
def get_river_details():
    """
    Fetches all river details from Google Cloud Datastore.
    """
    try:
        query = datastore_client.query(kind=RIVER_DETAILS_KIND)
        results = list(query.fetch())
        # Add ID to each entity for the response
        for entity in results:
            entity['id'] = entity.key.id_or_name
        return jsonify(results), 200
    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error("Datastore error fetching river details: %s", e, exc_info=True)
        return jsonify(error="A datastore error occurred while fetching river details."), 500

@app.route('/riverlevels', methods=['GET'])
def list_river_level_data():
    """
    Lists all river level time series data from Datastore.
    Datastore is configured to only save the past 7 days of data.
    Timestamps are ordered descending (most recent first).
    """
    try:
        query = datastore_client.query(kind=WATER_LEVEL_KIND)
        # Timestamps are still assumed to be ISO 8601 strings for ordering.

        # Order by timestamp, most recent first
        query.order = ['-timestamp']

        # Fetch all entities of the kind WATER_LEVEL_KIND
        results = list(query.fetch())

        # Add ID to each entity for the response
        for entity in results:
            entity['id'] = entity.key.id_or_name
        return jsonify(results), 200
    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error("Datastore error listing all river level data: %s", e, exc_info=True)
        return jsonify(error="A datastore error occurred while fetching river levels."), 500

@app.route('/riverlevels/sitecode/<string:site_code>', methods=['GET'])
def get_river_levels_by_site_code(site_code):
    """
    Fetches river level time series data for a specific siteCode from Datastore.
    Data is ordered by timestamp, most recent first.
    """
    app.logger.info("Received request for site_code (raw from path): '%s'", site_code)
    try:
        query = datastore_client.query(kind=WATER_LEVEL_KIND)
        # Filter by the provided by siteName
        query.add_filter('siteCode', '=', site_code)

        # Order by timestamp, most recent first
        query.order = ['-timestamp']

        results = list(query.fetch())

        # Add ID to each entity for the response
        for entity in results:
            entity['id'] = entity.key.id_or_name

        # If no results are found for the site_code, an empty list is appropriate with 200 OK.
        return jsonify(results), 200
    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error("Datastore error fetching river level data for site_code %s: %s", site_code, e, exc_info=True)
        return jsonify(error="A datastore error occurred while fetching river level data."), 500

# User Preferences Endpoints
@app.route('/user/preferences', methods=['GET', 'OPTIONS'])
@require_auth
def get_user_preferences():
    """
    Get user preferences for the authenticated user.
    """
    try:
        user_id = request.user['uid']
        user_email = request.user.get('email', '')

        # Use Firebase UID as the entity key
        key = datastore_client.key(USER_PREFERENCES_KIND, user_id)
        entity = datastore_client.get(key)

        if entity is None:
            return jsonify(error="User preferences not found"), 404

        # Convert entity to dict and add metadata
        preferences = dict(entity)
        preferences['userId'] = user_id

        return jsonify(preferences), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error fetching user preferences for user %s: %s",
            request.user.get('uid'),
            e,
            exc_info=True
        )
        return jsonify(error="A datastore error occurred while fetching user preferences."), 500
    except KeyError as e: # If 'uid' was unexpectedly missing from request.user
        app.logger.error(
            "Error fetching user preferences for user %s: %s",
            request.user.get('uid'), e, exc_info=True
        )
        return jsonify(error="An error occurred due to missing user information."), 500

@app.route('/user/preferences/favorites', methods=['POST', 'OPTIONS'])
@require_auth
def add_favorite_river():
    """
    Add a river to user's favorites.
    """
    try:
        user_id = request.user['uid']
        user_email = request.user.get('email', '')

        data = request.get_json()
        if not data or 'siteCode' not in data:
            return jsonify(error="Missing siteCode in request body"), 400

        site_code = data['siteCode']

        # Get or create user preferences
        key = datastore_client.key(USER_PREFERENCES_KIND, user_id)
        entity = datastore_client.get(key)

        if entity is None:
            # Create new preferences entity
            entity = datastore.Entity(key)
            entity.update({
                'userEmail': user_email,
                'favoriteRivers': [site_code],
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            })
        else:
            # Update existing preferences
            favorite_rivers = entity.get('favoriteRivers', [])
            if site_code not in favorite_rivers:
                favorite_rivers.append(site_code)
                entity['favoriteRivers'] = favorite_rivers
                entity['updatedAt'] = datetime.now(timezone.utc)

        datastore_client.put(entity)
        app.logger.info("Added favorite river %s for user %s", site_code, user_id)

        return jsonify(message="River added to favorites successfully"), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error adding favorite river for user %s: %s",
            request.user.get('uid'),
            e,
            exc_info=True
        )
        return jsonify(error="A datastore error occurred while adding favorite river."), 500
    except (KeyError, TypeError) as e: # For issues with request.user['uid'] or data handling
        app.logger.error(
            "Error adding favorite river for user %s: %s",
            request.user.get('uid'), e, exc_info=True
        )
        return jsonify(error="An error occurred processing the request data for adding favorite river."), 500

@app.route('/user/preferences/favorites', methods=['DELETE', 'OPTIONS'])
@require_auth
def remove_favorite_river():
    """
    Remove a river from user's favorites.
    """
    try:
        user_id = request.user['uid']

        data = request.get_json()
        if not data or 'siteCode' not in data:
            return jsonify(error="Missing siteCode in request body"), 400

        site_code = data['siteCode']

        # Get user preferences
        key = datastore_client.key(USER_PREFERENCES_KIND, user_id)
        entity = datastore_client.get(key)

        if entity is None:
            return jsonify(error="User preferences not found"), 404

        # Remove from favorites
        favorite_rivers = entity.get('favoriteRivers', [])
        if site_code in favorite_rivers:
            favorite_rivers.remove(site_code)
            entity['favoriteRivers'] = favorite_rivers
            entity['updatedAt'] = datetime.now(timezone.utc)
            datastore_client.put(entity)

        app.logger.info("Removed favorite river %s for user %s", site_code, user_id)

        return jsonify(message="River removed from favorites successfully"), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error removing favorite river for user %s: %s",
            request.user.get('uid'),
            e,
            exc_info=True
        )
        return jsonify(error="A datastore error occurred while removing favorite river."), 500
    except (KeyError, TypeError) as e: # For issues with request.user['uid'] or data handling
        app.logger.error(
            "Error removing favorite river for user %s: %s",
            request.user.get('uid'), e, exc_info=True
        )
        return jsonify(error="An error occurred processing the request data for removing favorite river."), 500

@app.route('/user/notes/<string:site_code>', methods=['GET', 'OPTIONS'])
@require_auth
def get_user_notes(site_code):
    """
    Get user notes for a specific river site.
    Returns the current note and version history (up to 3 previous versions).
    """
    try:
        user_id = request.user['uid']

        # Create composite key using user_id and site_code
        note_id = f"{user_id}_{site_code}"
        key = datastore_client.key(USER_NOTES_KIND, note_id)
        entity = datastore_client.get(key)

        if entity is None:
            return jsonify({
                'siteCode': site_code,
                'currentNote': '',
                'versions': [],
                'createdAt': None,
                'updatedAt': None
            }), 200

        # Convert entity to dict and add metadata
        notes_data = dict(entity)
        notes_data['siteCode'] = site_code
        notes_data['userId'] = user_id

        return jsonify(notes_data), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error fetching user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="A datastore error occurred while fetching user notes."), 500
    except KeyError as e:
        app.logger.error(
            "Error fetching user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="An error occurred due to missing user information."), 500

@app.route('/user/notes/<string:site_code>', methods=['POST', 'PUT', 'OPTIONS'])
@require_auth
def update_user_notes(site_code):
    """
    Create or update user notes for a specific river site.
    Maintains version history of the last 3 changes for undo functionality.
    """
    try:
        user_id = request.user['uid']
        user_email = request.user.get('email', '')

        data = request.get_json()
        if not data or 'note' not in data:
            return jsonify(error="Missing 'note' in request body"), 400

        new_note = data['note'].strip()

        # Create composite key using user_id and site_code
        note_id = f"{user_id}_{site_code}"
        key = datastore_client.key(USER_NOTES_KIND, note_id)
        entity = datastore_client.get(key)

        current_time = datetime.now(timezone.utc)

        if entity is None:
            # Create new notes entity
            entity = datastore.Entity(key)
            entity.update({
                'userId': user_id,
                'userEmail': user_email,
                'siteCode': site_code,
                'currentNote': new_note,
                'versions': [],  # Will store up to 3 previous versions
                'createdAt': current_time,
                'updatedAt': current_time
            })
            action_type = "created"
        else:
            # Update existing notes with versioning
            current_note = entity.get('currentNote', '')
            versions = entity.get('versions', [])

            # Only create a version if the note actually changed
            if current_note != new_note:
                # Add current note to versions list (with timestamp)
                if current_note:  # Don't version empty notes
                    version_entry = {
                        'note': current_note,
                        'timestamp': entity.get('updatedAt', current_time),
                        'version': len(versions) + 1
                    }
                    versions.append(version_entry)

                # Keep only the last 3 versions
                if len(versions) > 3:
                    versions = versions[-3:]

                # Update entity
                entity.update({
                    'currentNote': new_note,
                    'versions': versions,
                    'updatedAt': current_time
                })
                action_type = "updated"
            else:
                # Note hasn't changed, just return current state
                action_type = "unchanged"

        # Save to datastore (only if note changed or is new)
        if action_type != "unchanged":
            datastore_client.put(entity)
            app.logger.info("Notes %s for user %s, site %s", action_type, user_id, site_code)

        # Return the updated notes data
        response_data = dict(entity)
        response_data['siteCode'] = site_code
        response_data['userId'] = user_id

        return jsonify({
            'message': f"Notes {action_type} successfully",
            'data': response_data
        }), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error updating user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="A datastore error occurred while updating user notes."), 500
    except (KeyError, TypeError) as e:
        app.logger.error(
            "Error updating user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="An error occurred processing the request data for updating notes."), 500

@app.route('/user/notes/<string:site_code>/undo', methods=['POST', 'OPTIONS'])
@require_auth
def undo_user_notes(site_code):
    """
    Undo the last change to user notes for a specific river site.
    Restores the most recent version from the version history.
    """
    try:
        user_id = request.user['uid']

        # Create composite key using user_id and site_code
        note_id = f"{user_id}_{site_code}"
        key = datastore_client.key(USER_NOTES_KIND, note_id)
        entity = datastore_client.get(key)

        if entity is None:
            return jsonify(error="No notes found to undo"), 404

        versions = entity.get('versions', [])
        if not versions:
            return jsonify(error="No previous versions available to undo"), 400

        # Get the most recent version
        last_version = versions[-1]
        current_note = entity.get('currentNote', '')
        current_time = datetime.now(timezone.utc)

        # Move current note to versions (but don't exceed 3 versions total)
        if current_note:
            new_version_entry = {
                'note': current_note,
                'timestamp': entity.get('updatedAt', current_time),
                'version': len(versions) + 1
            }
            # Remove the version we're restoring and add current note
            remaining_versions = versions[:-1]
            remaining_versions.append(new_version_entry)

            # Keep only last 3 versions
            if len(remaining_versions) > 3:
                remaining_versions = remaining_versions[-3:]
        else:
            # If current note is empty, just remove the last version
            remaining_versions = versions[:-1]

        # Restore the last version as current
        entity.update({
            'currentNote': last_version['note'],
            'versions': remaining_versions,
            'updatedAt': current_time
        })

        datastore_client.put(entity)
        app.logger.info("Undid notes change for user %s, site %s", user_id, site_code)

        # Return the updated notes data
        response_data = dict(entity)
        response_data['siteCode'] = site_code
        response_data['userId'] = user_id

        return jsonify({
            'message': "Notes change undone successfully",
            'data': response_data
        }), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error undoing user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="A datastore error occurred while undoing notes change."), 500
    except (KeyError, TypeError) as e:
        app.logger.error(
            "Error undoing user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="An error occurred processing the undo request."), 500

@app.route('/user/notes/<string:site_code>', methods=['DELETE', 'OPTIONS'])
@require_auth
def delete_user_notes(site_code):
    """
    Delete all notes for a specific river site for the authenticated user.
    """
    try:
        user_id = request.user['uid']

        # Create composite key using user_id and site_code
        note_id = f"{user_id}_{site_code}"
        key = datastore_client.key(USER_NOTES_KIND, note_id)
        entity = datastore_client.get(key)

        if entity is None:
            return jsonify(error="No notes found to delete"), 404

        datastore_client.delete(key)
        app.logger.info("Deleted notes for user %s, site %s", user_id, site_code)

        return jsonify(message="Notes deleted successfully"), 200

    except google_cloud_exceptions.GoogleCloudError as e:
        app.logger.error(
            "Datastore error deleting user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="A datastore error occurred while deleting user notes."), 500
    except KeyError as e:
        app.logger.error(
            "Error deleting user notes for user %s, site %s: %s",
            request.user.get('uid'), site_code, e, exc_info=True
        )
        return jsonify(error="An error occurred due to missing user information."), 500

if __name__ == '__main__':
    # Port is set by Cloud Run, Gunicorn, or other WSGI servers.
    # For local development, Flask default is 5000.
    # Debug mode should be False in production.
    # Gunicorn will be used in production, so this app.run() is for local dev only.
    is_debug_mode = ENVIRONMENT != 'production'
    app.logger.info("Starting Flask development server (debug=%s)...", is_debug_mode)
    app.run(host='0.0.0.0',
            port=int(os.environ.get('PORT', 8080)),
            debug=is_debug_mode)
