// Global variable to hold loaded movies for client-side search
let allMovies = [];
let lastPredictedRevenue = 0;

// Load records when page opens
document.addEventListener("DOMContentLoaded", () => {
    fetchMovies();
});

// --- 1. READ: Fetch all movies (GET /api/movies) ---
function fetchMovies() {
    fetch('/api/movies')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allMovies = data.data;
                renderTable(allMovies);
            } else {
                showAlert('Error loading movies: ' + data.error, 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showAlert('Server connection error. Ensure backend is running.', 'error');
        });
}

// Render data into table
function renderTable(movies) {
    const tbody = document.getElementById('movieTableBody');
    tbody.innerHTML = '';

    if (movies.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No movie records found. Add a movie above!</td></tr>`;
        return;
    }

    movies.forEach(movie => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${movie.id}</td>
            <td><strong>${escapeHtml(movie.title)}</strong></td>
            <td><span class="badge">${escapeHtml(movie.genre)}</span></td>
            <td>$${Number(movie.budget).toLocaleString()}</td>
            <td>$${Number(movie.box_office).toLocaleString()}</td>
            <td>${movie.release_year}</td>
            <td class="action-cell">
                <button class="btn btn-edit" onclick="startEditMovie(${movie.id})">Edit</button>
                <button class="btn btn-delete" onclick="deleteMovie(${movie.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 2. CREATE & UPDATE: Submit Movie Form ---
function handleMovieSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('movieId').value;
    const title = document.getElementById('movieTitle').value.trim();
    const genre = document.getElementById('movieGenre').value.trim();
    const budget = parseFloat(document.getElementById('movieBudget').value);
    const box_office = parseFloat(document.getElementById('movieBoxOffice').value);
    const release_year = parseInt(document.getElementById('movieYear').value);

    // Client-side Validation (SOP Section 9)
    if (!title || !genre || isNaN(budget) || isNaN(box_office) || isNaN(release_year)) {
        showAlert('Please fill in all mandatory fields correctly.', 'error');
        return;
    }

    if (budget < 0 || box_office < 0) {
        showAlert('Budget and Collection cannot be negative numbers.', 'error');
        return;
    }

    const payload = { title, genre, budget, box_office, release_year };

    if (id) {
        // UPDATE (PUT /api/movies/<id>)
        fetch(`/api/movies/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Movie updated successfully!', 'success');
                resetForm();
                fetchMovies();
            } else {
                showAlert(data.error, 'error');
            }
        })
        .catch(err => showAlert('Update failed: ' + err, 'error'));
    } else {
        // CREATE (POST /api/movies)
        fetch('/api/movies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Movie record added successfully!', 'success');
                resetForm();
                fetchMovies();
            } else {
                showAlert(data.error, 'error');
            }
        })
        .catch(err => showAlert('Creation failed: ' + err, 'error'));
    }
}

// --- 3. Start Editing a Movie ---
function startEditMovie(id) {
    const movie = allMovies.find(m => m.id === id);
    if (!movie) return;

    document.getElementById('movieId').value = movie.id;
    document.getElementById('movieTitle').value = movie.title;
    document.getElementById('movieGenre').value = movie.genre;
    document.getElementById('movieBudget').value = movie.budget;
    document.getElementById('movieBoxOffice').value = movie.box_office;
    document.getElementById('movieYear').value = movie.release_year;

    document.getElementById('formTitle').innerText = `✏️ Edit Movie Record (#${movie.id})`;
    document.getElementById('saveBtn').innerText = 'Update Movie';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Reset Form
function resetForm() {
    document.getElementById('movieForm').reset();
    document.getElementById('movieId').value = '';
    document.getElementById('formTitle').innerText = '➕ Add New Movie Record';
    document.getElementById('saveBtn').innerText = 'Save Movie';
    document.getElementById('cancelBtn').style.display = 'none';
}

// --- 4. DELETE: Remove Movie (DELETE /api/movies/<id>) ---
function deleteMovie(id) {
    if (!confirm(`Are you sure you want to delete movie record #${id}?`)) {
        return;
    }

    fetch(`/api/movies/${id}`, {
        method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showAlert('Movie record removed successfully!', 'success');
            fetchMovies();
        } else {
            showAlert(data.error, 'error');
        }
    })
    .catch(err => showAlert('Delete failed: ' + err, 'error'));
}

// --- 5. SEARCH & FILTER ---
function filterMovies() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allMovies.filter(m => 
        m.title.toLowerCase().includes(query) || 
        m.genre.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

// --- 6. Notification System ---
function showAlert(message, type = 'success') {
    const box = document.getElementById('alertBox');
    box.innerText = message;
    box.className = `alert-box alert-${type}`;
    box.style.display = 'block';

    setTimeout(() => {
        box.style.display = 'none';
    }, 4000);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// --- 7. ML Prediction (Your original logic) ---
function getPrediction() {
    const budget = document.getElementById('budget').value;
    const popularity = document.getElementById('popularity').value;
    const runtime = document.getElementById('runtime').value;
    const vote_avg = document.getElementById('vote_avg').value;
    const vote_count = document.getElementById('vote_count').value;

    if (!budget || !popularity || !runtime || !vote_avg || !vote_count) {
        showAlert('Please fill in all prediction input fields', 'error');
        return;
    }

    document.getElementById('loader').style.display = 'block';
    document.getElementById('resultCard').style.display = 'none';

    fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, popularity, runtime, vote_avg, vote_count })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('loader').style.display = 'none';
        if (data.success) {
            document.getElementById('revenueValue').innerText = data.revenue;
            document.getElementById('resultCard').style.display = 'block';
            lastPredictedRevenue = data.raw_revenue;
        } else {
            showAlert(data.error, 'error');
        }
    })
    .catch(err => {
        document.getElementById('loader').style.display = 'none';
        showAlert('Prediction request failed: ' + err, 'error');
    });
}

function fillFormFromPrediction() {
    const budget = document.getElementById('budget').value;
    if (budget) document.getElementById('movieBudget').value = budget;
    if (lastPredictedRevenue) document.getElementById('movieBoxOffice').value = Math.round(lastPredictedRevenue);
    
    window.scrollTo({ top: 120, behavior: 'smooth' });
    showAlert('Budget and Predicted Box Office copied to CRUD form!', 'success');
}