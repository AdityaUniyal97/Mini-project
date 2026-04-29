// Global API Key - Replace with your actual TMDB API key
const API_KEY = '99134078b2f14cae69a98ffb4884afed';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

/* SETUP STEPS:
1. Go to firebase.google.com
2. Click Get Started — it is free
3. Create new project — name it CineMatch
4. Go to Realtime Database — create database
5. Set rules to public for now (for student project)
6. Copy your config and paste it above
7. Done!

Firebase Database Rules to Set
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
*/

// Firebase Config
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNhTPANQvIYIO5RsmKucbSNpiLLAYt1o4",
  authDomain: "gen-lang-client-0934972792.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0934972792-default-rtdb.firebaseio.com/",
  projectId: "gen-lang-client-0934972792",
  storageBucket: "gen-lang-client-0934972792.firebasestorage.app",
  messagingSenderId: "319110590864",
  appId: "1:319110590864:web:c8af07d71683bfa6808315"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // Using Realtime Database

// Global state for watched movies
let watchedMovies = [];

function generateFourDigitCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Genre mapping for TMDB
const genreMap = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western"
};

// Helper to get a safe discover URL with strict adult filters
function getSafeDiscoverUrl(randomizePage = false) {
    // Only randomize page for broad queries (like trending) to avoid empty pages on strict filters
    const page = randomizePage ? Math.floor(Math.random() * 3) + 1 : 1;
    // include_adult=false removes explicit content
    // primary_release_date.gte=2022-01-01 to only show recent movies
    return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi&include_adult=false&primary_release_date.gte=2022-01-01&language=en-US&certification_country=IN&certification.lte=UA&page=${page}`;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadTopCharts();
    loadTrending();
    setupEventListeners();
    loadSavedFilters();
    initWatchHistory();
});

// Initialize Watch History from localStorage and Firebase
async function initWatchHistory() {
    // Read from local storage first for speed
    const localHistory = JSON.parse(localStorage.getItem('watchedMovies') || '[]');
    if (localHistory.length > 0) {
        watchedMovies = localHistory;
        renderWatchedMovies();
        loadBecauseYouWatched();
    }

    // Sync from Firebase Realtime Database (Global Shared Watch History)
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `watchHistory`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            const fbMovies = Object.values(data);
            if (fbMovies.length > 0) {
                // Sort by watchedAt timestamp just in case
                fbMovies.sort((a, b) => b.watchedAt - a.watchedAt);
                watchedMovies = fbMovies;
                localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
                renderWatchedMovies();
                loadBecauseYouWatched();
            }
        }
    } catch(err) {
        console.error("Firebase watchHistory fetch error:", err);
    }
}

// Load saved filters on page refresh
function loadSavedFilters() {
    // 1. Load saved time filter
    const savedMinTime = localStorage.getItem('selectedMinTime');
    const savedMaxTime = localStorage.getItem('selectedMaxTime');
    
    if (savedMinTime !== null || savedMaxTime !== null) {
        document.querySelectorAll('.time-btn').forEach(btn => {
            if ((btn.dataset.min || "") === (savedMinTime || "") && 
                (btn.dataset.max || "") === (savedMaxTime || "")) {
                btn.classList.add('active');
            }
        });
        filterByTime(savedMinTime, savedMaxTime);
    }

    // 2. Load saved genre filter
    const savedGenre = localStorage.getItem('selectedGenre');
    if (savedGenre) {
        document.querySelectorAll('.genre-btn').forEach(btn => {
            if (btn.dataset.id === savedGenre) {
                btn.classList.add('active');
            }
        });
        filterByGenre(savedGenre);
    }

    // 3. Load saved rating filter
    const savedRating = localStorage.getItem('selectedRating');
    if (savedRating) {
        const ratingSlider = document.getElementById('rating-slider');
        const ratingValue = document.getElementById('rating-value');
        
        ratingSlider.value = savedRating;
        ratingValue.textContent = savedRating;
        filterByRating(savedRating);
    } else {
        // Fetch default rating on load to populate the section
        filterByRating(document.getElementById('rating-slider').value);
    }
}

// Setup all event listeners
function setupEventListeners() {
    // 1. Search
    document.getElementById('search-btn').addEventListener('click', () => {
        const query = document.getElementById('search-input').value;
        if (query) searchMovies(query);
    });

    // 2. Time-Based
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const maxTime = e.target.dataset.max || "";
            const minTime = e.target.dataset.min || "";
            
            // Save to localStorage
            localStorage.setItem('selectedMinTime', minTime);
            localStorage.setItem('selectedMaxTime', maxTime);
            
            filterByTime(minTime, maxTime);
        });
    });

    // 3. Genre-Based
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const genreId = e.target.dataset.id;
            // Save to localStorage
            localStorage.setItem('selectedGenre', genreId);
            filterByGenre(genreId);
        });
    });

    // 4. Rating-Based
    const ratingSlider = document.getElementById('rating-slider');
    const ratingValue = document.getElementById('rating-value');
    
    ratingSlider.addEventListener('input', (e) => {
        ratingValue.textContent = e.target.value;
    });
    
    ratingSlider.addEventListener('change', (e) => {
        const rating = e.target.value;
        // Save to localStorage
        localStorage.setItem('selectedRating', rating);
        filterByRating(rating);
    });

    // 6. Friends Feature
    document.getElementById('generate-code-btn').addEventListener('click', generateFriendCode);
    document.getElementById('use-code-btn').addEventListener('click', useFriendCode);
}

// Helper to show loading state
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Loading...</div>';
}

// Helper to show no results
function showNoResults(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="no-results">No movies found.</div>';
}

// 1. Search Movies
function searchMovies(query) {
    showLoading('search-results');
    // Added include_adult=false to search
    fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&with_original_language=hi&language=en-US&certification_country=IN`)
        .then(response => response.json())
        .then(data => {
            if (data.results) {
                const hindiMovies = data.results.filter(movie => movie.original_language === 'hi');
                displayMovies(hindiMovies, 'search-results');
            } else {
                showNoResults('search-results');
            }
        })
        .catch(error => {
            console.error('Error searching movies:', error);
            showNoResults('search-results');
        });
}

// 2. Filter by Time (Runtime)
function filterByTime(minTime, maxTime) {
    showLoading('time-results');
    let url = `${getSafeDiscoverUrl(false)}&sort_by=popularity.desc`;
    if (minTime) url += `&with_runtime.gte=${minTime}`;
    if (maxTime) url += `&with_runtime.lte=${maxTime}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, 'time-results');
        })
        .catch(error => {
            console.error('Error filtering by time:', error);
            showNoResults('time-results');
        });
}

// 3. Filter by Genre
function filterByGenre(genreId) {
    showLoading('genre-results');
    fetch(`${getSafeDiscoverUrl(false)}&with_genres=${genreId}&sort_by=popularity.desc`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, 'genre-results');
        })
        .catch(error => {
            console.error('Error filtering by genre:', error);
            showNoResults('genre-results');
        });
}

// 4. Filter by Rating
function filterByRating(minRating) {
    showLoading('rating-results');
    fetch(`${getSafeDiscoverUrl(false)}&vote_average.gte=${minRating}&vote_count.gte=50&sort_by=vote_average.desc`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, 'rating-results');
        })
        .catch(error => {
            console.error('Error filtering by rating:', error);
            showNoResults('rating-results');
        });
}

// 5. Load Trending Movies
function loadTrending() {
    showLoading('trending-results');
    fetch(`${getSafeDiscoverUrl(true)}&sort_by=popularity.desc`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, 'trending-results');
        })
        .catch(error => {
            console.error('Error loading trending:', error);
            showNoResults('trending-results');
        });
}

// 5b. Load Top Charts
function loadTopCharts() {
    showLoading('top-charts-results');
    // Top charts uses 2022-01-01 as minimum date, vote_count 300, Indian posters
    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi&include_adult=false&primary_release_date.gte=2022-01-01&vote_count.gte=300&sort_by=vote_average.desc&language=en-US&certification_country=IN&certification.lte=UA&page=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('top-charts-results');
            container.innerHTML = '';
            // Safe filter
            const safeMovies = data.results.filter(movie => {
                const title = (movie.title || '').toLowerCase();
                return !title.includes('mimi cucu') && 
                       !title.includes('ullu') && 
                       !title.includes('charmsukh') &&
                       !title.includes('palang tod');
            });

            if (safeMovies && safeMovies.length > 0) {
                const top10 = safeMovies.slice(0, 10);
                top10.forEach((movie, index) => {
                    const item = createChartItem(movie, index + 1);
                    container.appendChild(item);
                });
            } else {
                showNoResults('top-charts-results');
            }
        })
        .catch(error => {
            console.error('Error loading top charts:', error);
            showNoResults('top-charts-results');
        });
}

// Helper to create leaderboard item
function createChartItem(movie, rank) {
    const item = document.createElement('div');
    item.className = 'chart-item';
    
    const posterHTML = movie.poster_path 
        ? `<img src="${IMG_URL}${movie.poster_path}" alt="${movie.title}" class="chart-poster" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">`
        : `<div class="no-poster chart-no-poster" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">
              <p>${movie.title}</p>
           </div>`;
        
    const year = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
    
    item.innerHTML = `
        <div class="chart-rank">#${rank}</div>
        ${posterHTML}
        <div class="chart-details">
            <div class="chart-title" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">${movie.title}</div>
            <div class="chart-meta">${year} • ${rating}</div>
        </div>
    `;
    
    return item;
}

// 6a. Generate Friend Code
async function generateFriendCode() {
    const checkboxes = document.querySelectorAll('.genre-checkbox:checked');
    const selectedGenres = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedGenres.length === 0) {
        alert('Please select at least one genre!');
        return;
    }

    const codeSpan = document.getElementById('generated-code');
    codeSpan.textContent = "Generating...";

    const fourDigitCode = generateFourDigitCode();
    
    try {
        await set(ref(db, "friendCodes/" + fourDigitCode), {
            genres: selectedGenres,
            createdAt: Date.now()
        });
        codeSpan.textContent = fourDigitCode;
    } catch (error) {
        console.error("Firebase generateFriendCode error:", error);
        codeSpan.textContent = fourDigitCode + " (Local Only)";
        localStorage.setItem('local_friend_code_' + fourDigitCode, JSON.stringify(selectedGenres));
    }
}

// 6b. Use Friend Code
async function useFriendCode() {
    const codeInput = document.getElementById('friend-code-input').value.trim();
    if (!codeInput) return;

    showLoading('friends-results');

    let genreIds = null;
    
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `friendCodes/${codeInput}`));
        if (snapshot.exists()) {
            genreIds = snapshot.val().genres;
        } else {
            // Fallback local check
            const localData = localStorage.getItem('local_friend_code_' + codeInput);
            if (localData) {
                genreIds = JSON.parse(localData);
            }
        }
    } catch (error) {
        console.error("Firebase useFriendCode error:", error);
        const localData = localStorage.getItem('local_friend_code_' + codeInput);
        if (localData) {
            genreIds = JSON.parse(localData);
        }
    }

    if (Array.isArray(genreIds) && genreIds.length > 0) {
        const genresString = genreIds.join('|');
        fetch(`${getSafeDiscoverUrl(false)}&with_genres=${genresString}&sort_by=popularity.desc`)
            .then(response => response.json())
            .then(data => {
                displayMovies(data.results, 'friends-results');
            })
            .catch(error => {
                console.error('Error fetching friends movies:', error);
                showNoResults('friends-results');
            });
    } else {
        alert('Invalid or missing code! Please check and try again.');
        showNoResults('friends-results');
    }
}

// 7a. Mark as Watched
async function markAsWatched(movie) {
    // Check if already watched
    if (!watchedMovies.find(m => m.id === movie.id)) {
        watchedMovies.push(movie);
        
        // Save to local storage for instant sync on same device
        localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
        
        renderWatchedMovies();
        loadBecauseYouWatched();

        // Sync to Firebase for cross-device shared history
        try {
            await set(ref(db, "watchHistory/" + movie.id), {
                id: movie.id,
                title: movie.title,
                poster: movie.poster_path || "",
                genres: movie.genre_ids || [],
                watchedAt: Date.now()
            });
        } catch (error) {
            console.error("Firebase markAsWatched error:", error);
        }
    }
}

// 7b. Render Watched Movies
function renderWatchedMovies() {
    displayMovies(watchedMovies, 'watched-results', true);
}

// 7c. Load "Because You Watched"
function loadBecauseYouWatched() {
    if (watchedMovies.length === 0) return;
    
    showLoading('because-watched-results');
    
    // Collect all genres from watched movies
    let allGenreIds = [];
    watchedMovies.forEach(movie => {
        if (movie.genre_ids) {
            allGenreIds = allGenreIds.concat(movie.genre_ids);
        }
    });
    
    // Get unique genres
    const uniqueGenres = [...new Set(allGenreIds)];
    
    if (uniqueGenres.length > 0) {
        // Take top 3 genres to avoid overly restrictive queries
        const genresToSearch = uniqueGenres.slice(0, 3).join('|');
        
        fetch(`${getSafeDiscoverUrl(false)}&with_genres=${genresToSearch}&sort_by=popularity.desc`)
            .then(response => response.json())
            .then(data => {
                // Filter out movies already watched
                const recommended = data.results.filter(
                    recMovie => !watchedMovies.find(wMovie => wMovie.id === recMovie.id)
                );
                displayMovies(recommended, 'because-watched-results');
            })
            .catch(error => {
                console.error('Error loading recommendations:', error);
                showNoResults('because-watched-results');
            });
    }
}

// Reusable function to create a movie card HTML element
function createMovieCard(movie, isWatchedList = false) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    const posterHTML = movie.poster_path 
        ? `<img src="${IMG_URL}${movie.poster_path}" alt="${movie.title}" class="movie-poster" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">`
        : `<div class="no-poster" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">
              <p>${movie.title}</p>
           </div>`;
        
    const year = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
    
    // Map genre IDs to names
    const genres = movie.genre_ids 
        ? movie.genre_ids.map(id => genreMap[id]).filter(Boolean).join(', ')
        : 'Unknown';

    card.innerHTML = `
        ${posterHTML}
        <div class="movie-info">
            <div class="movie-title" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">${movie.title}</div>
            <div class="movie-meta">${year}</div>
            <div><span class="movie-rating">${rating}</span></div>
            <div class="movie-genres">${genres}</div>
            ${!isWatchedList ? `<button class="watched-btn" data-id="${movie.id}">Mark as Watched</button>` : '<button class="watched-btn watched" disabled>Watched</button>'}
        </div>
    `;

    if (!isWatchedList) {
        const watchBtn = card.querySelector('.watched-btn');
        watchBtn.addEventListener('click', () => {
            markAsWatched(movie);
            watchBtn.textContent = 'Watched';
            watchBtn.classList.add('watched');
            watchBtn.disabled = true;
        });
    }

    return card;
}

// Reusable function to display an array of movies in a specific container
function displayMovies(movies, containerId, isWatchedList = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!movies || movies.length === 0) {
        showNoResults(containerId);
        return;
    }
    
    // Manual safety filter to catch softcore titles that might bypass TMDB's adult filter
    const safeMovies = movies.filter(movie => {
        const title = (movie.title || '').toLowerCase();
        return !title.includes('mimi cucu') && 
               !title.includes('ullu') && 
               !title.includes('charmsukh') &&
               !title.includes('palang tod');
    });

    if (safeMovies.length === 0) {
        showNoResults(containerId);
        return;
    }
    
    // Shuffle the movies so they change on refresh (unless it's the watched list)
    const moviesToProcess = isWatchedList ? safeMovies : safeMovies.sort(() => 0.5 - Math.random());
    
    // Display up to 12 movies for better UI
    const moviesToShow = moviesToProcess.slice(0, 12);
    
    moviesToShow.forEach(movie => {
        const card = createMovieCard(movie, isWatchedList);
        container.appendChild(card);
    });
}
