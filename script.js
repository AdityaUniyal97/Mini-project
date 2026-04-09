// Global API Key - Replace with your actual TMDB API key
const API_KEY = '99134078b2f14cae69a98ffb4884afed';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

// Global state for watched movies (session only)
let watchedMovies = [];

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

// Helper to get a safe discover URL with random pages and strict adult filters
function getSafeDiscoverUrl() {
    // Randomize page (1 to 3) so movies change on refresh
    const randomPage = Math.floor(Math.random() * 3) + 1;
    // include_adult=false removes explicit content
    // certification_country=IN & certification.lte=UA filters out 'A' (Adult) rated Indian movies
    return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi&include_adult=false&certification_country=IN&certification.lte=UA&page=${randomPage}`;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    setupEventListeners();
});

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
            const maxTime = e.target.dataset.max;
            const minTime = e.target.dataset.min;
            filterByTime(minTime, maxTime);
        });
    });

    // 3. Genre-Based
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const genreId = e.target.dataset.id;
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
        filterByRating(e.target.value);
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
    fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`)
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
    let url = `${getSafeDiscoverUrl()}&sort_by=popularity.desc`;
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
    fetch(`${getSafeDiscoverUrl()}&with_genres=${genreId}&sort_by=popularity.desc`)
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
    fetch(`${getSafeDiscoverUrl()}&vote_average.gte=${minRating}&vote_count.gte=50&sort_by=vote_average.desc`)
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
    fetch(`${getSafeDiscoverUrl()}&sort_by=popularity.desc`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, 'trending-results');
        })
        .catch(error => {
            console.error('Error loading trending:', error);
            showNoResults('trending-results');
        });
}

// 6a. Generate Friend Code
function generateFriendCode() {
    const checkboxes = document.querySelectorAll('.genre-checkbox:checked');
    const selectedGenres = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedGenres.length === 0) {
        alert('Please select at least one genre!');
        return;
    }

    const jsonString = JSON.stringify(selectedGenres);
    const base64Code = btoa(jsonString);
    
    document.getElementById('generated-code').textContent = base64Code;
}

// 6b. Use Friend Code
function useFriendCode() {
    const codeInput = document.getElementById('friend-code-input').value;
    if (!codeInput) return;

    try {
        const jsonString = atob(codeInput);
        const genreIds = JSON.parse(jsonString);
        
        if (Array.isArray(genreIds) && genreIds.length > 0) {
            const genresString = genreIds.join(',');
            showLoading('friends-results');
            
            fetch(`${getSafeDiscoverUrl()}&with_genres=${genresString}&sort_by=popularity.desc`)
                .then(response => response.json())
                .then(data => {
                    displayMovies(data.results, 'friends-results');
                })
                .catch(error => {
                    console.error('Error fetching friends movies:', error);
                    showNoResults('friends-results');
                });
        }
    } catch (error) {
        alert('Invalid code! Please check and try again.');
    }
}

// 7a. Mark as Watched
function markAsWatched(movie) {
    // Check if already watched
    if (!watchedMovies.find(m => m.id === movie.id)) {
        watchedMovies.push(movie);
        renderWatchedMovies();
        loadBecauseYouWatched();
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
        const genresToSearch = uniqueGenres.slice(0, 3).join(',');
        
        fetch(`${getSafeDiscoverUrl()}&with_genres=${genresToSearch}&sort_by=popularity.desc`)
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
    
    const posterPath = movie.poster_path 
        ? `${IMG_URL}${movie.poster_path}` 
        : 'https://via.placeholder.com/500x750?text=No+Poster';
        
    const year = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
    
    // Map genre IDs to names
    const genres = movie.genre_ids 
        ? movie.genre_ids.map(id => genreMap[id]).filter(Boolean).join(', ')
        : 'Unknown';

    card.innerHTML = `
        <img src="${posterPath}" alt="${movie.title}" class="movie-poster" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">
        <div class="movie-info">
            <div class="movie-title" onclick="window.open('https://www.themoviedb.org/movie/${movie.id}', '_blank')">${movie.title}</div>
            <div class="movie-meta">${year}</div>
            <div><span class="movie-rating">⭐ ${rating}</span></div>
            <div class="movie-genres">${genres}</div>
            ${!isWatchedList ? `<button class="watched-btn" data-id="${movie.id}">Mark as Watched</button>` : '<button class="watched-btn watched" disabled>Watched ✓</button>'}
        </div>
    `;

    if (!isWatchedList) {
        const watchBtn = card.querySelector('.watched-btn');
        watchBtn.addEventListener('click', () => {
            markAsWatched(movie);
            watchBtn.textContent = 'Watched ✓';
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
