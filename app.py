from flask import Flask, render_template, request, jsonify
import pickle
import numpy as np
import sqlite3
import os

app = Flask(__name__)

# --- 1. SQLite Database Initialization (SOP Section 7.3 & 11) ---
DB_NAME = 'movies.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # Returns dict-like rows
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Create movies table with constraints
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL UNIQUE,
            genre TEXT NOT NULL,
            budget REAL NOT NULL,
            box_office REAL NOT NULL,
            release_year INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# Initialize database on start
init_db()

# --- 2. Load ML Model ---
with open('model.pkl', 'rb') as f:
    model = pickle.load(f)

# --- 3. Frontend Route ---
@app.route('/')
def index():
    return render_template('index.html')


# --- 4. CRUD REST API Endpoints (SOP Section 7.6 & 9) ---

# READ ALL: GET /api/movies
@app.route('/api/movies', methods=['GET'])
def get_all_movies():
    try:
        conn = get_db_connection()
        movies = conn.execute('SELECT * FROM movies ORDER BY id DESC').fetchall()
        conn.close()
        
        movie_list = [dict(row) for row in movies]
        return jsonify({'success': True, 'data': movie_list}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# READ ONE: GET /api/movies/<id>
@app.route('/api/movies/<int:movie_id>', methods=['GET'])
def get_movie(movie_id):
    try:
        conn = get_db_connection()
        movie = conn.execute('SELECT * FROM movies WHERE id = ?', (movie_id,)).fetchone()
        conn.close()
        
        if movie is None:
            return jsonify({'success': False, 'error': 'Movie not found'}), 404
            
        return jsonify({'success': True, 'data': dict(movie)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# CREATE: POST /api/movies
@app.route('/api/movies', methods=['POST'])
def create_movie():
    try:
        data = request.get_json()
        
        # Server-side Validation (SOP Section 9)
        title = data.get('title', '').strip()
        genre = data.get('genre', '').strip()
        budget = data.get('budget')
        box_office = data.get('box_office')
        release_year = data.get('release_year')

        if not title or not genre or budget is None or box_office is None or release_year is None:
            return jsonify({'success': False, 'error': 'All fields are mandatory!'}), 400

        try:
            budget = float(budget)
            box_office = float(box_office)
            release_year = int(release_year)
        except ValueError:
            return jsonify({'success': False, 'error': 'Budget, Collection, and Year must be valid numbers!'}), 400

        if budget < 0 or box_office < 0:
            return jsonify({'success': False, 'error': 'Budget and Box Office cannot be negative!'}), 400

        # Insert into Database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO movies (title, genre, budget, box_office, release_year) VALUES (?, ?, ?, ?, ?)',
            (title, genre, budget, box_office, release_year)
        )
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        return jsonify({'success': True, 'message': 'Movie record created successfully!', 'id': new_id}), 201

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'A movie with this title already exists!'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# UPDATE: PUT /api/movies/<id>
@app.route('/api/movies/<int:movie_id>', methods=['PUT'])
def update_movie(movie_id):
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        genre = data.get('genre', '').strip()
        budget = float(data.get('budget', 0))
        box_office = float(data.get('box_office', 0))
        release_year = int(data.get('release_year', 0))

        if not title or not genre:
            return jsonify({'success': False, 'error': 'Title and genre cannot be empty!'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if movie exists
        existing = cursor.execute('SELECT * FROM movies WHERE id = ?', (movie_id,)).fetchone()
        if existing is None:
            conn.close()
            return jsonify({'success': False, 'error': 'Movie not found'}), 404

        cursor.execute('''
            UPDATE movies 
            SET title = ?, genre = ?, budget = ?, box_office = ?, release_year = ?
            WHERE id = ?
        ''', (title, genre, budget, box_office, release_year, movie_id))
        
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Movie record updated successfully!'}), 200

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Another movie already uses this title!'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# DELETE: DELETE /api/movies/<id>
@app.route('/api/movies/<int:movie_id>', methods=['DELETE'])
def delete_movie(movie_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        existing = cursor.execute('SELECT * FROM movies WHERE id = ?', (movie_id,)).fetchone()
        if existing is None:
            conn.close()
            return jsonify({'success': False, 'error': 'Movie not found'}), 404

        cursor.execute('DELETE FROM movies WHERE id = ?', (movie_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Movie record deleted successfully!'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# --- 5. ML Prediction Feature (Your existing feature) ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        input_data = [
            float(data['budget']),
            float(data['popularity']),
            float(data['runtime']),
            float(data['vote_avg']),
            float(data['vote_count'])
        ]
        
        prediction = model.predict([input_data])[0]
        formatted_res = f"${prediction / 1_000_000:.2f} Million"
        raw_prediction = round(float(prediction), 2)
        
        return jsonify({
            'success': True, 
            'revenue': formatted_res, 
            'raw_revenue': raw_prediction
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


if __name__ == '__main__':
    app.run(debug=True)