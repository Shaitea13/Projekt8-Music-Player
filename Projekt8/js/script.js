// Audio-Elemente und Variablen
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volumeSlider');
const volumeBtn = document.getElementById('volumeBtn');
const songTitle = document.getElementById('songTitle');
const artistName = document.getElementById('artistName');
const playlist = document.getElementById('playlist');
const albumArt = document.getElementById('albumArt');
const fileInput = document.getElementById('fileInput');
const addSongBtn = document.getElementById('addSongBtn');

// Visualizer
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let audioContext;
let analyser;
let source;
let dataArray;
let animationId;

// Player State
let isPlaying = false;
let currentSongIndex = 0;
let isShuffling = false;
let isRepeating = false;
let songs = [];
let visualizerMode = 'bars';

// Canvas Setup
function setupCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// Audio Context Setup
function setupAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
    }
}

// Initialize
function init() {
    // Lade gespeicherte Playlist wenn vorhanden
    loadSavedPlaylist();
    
    // Sammle alle Songs aus der Playlist
    updateSongsFromPlaylist();
    
    // Lade ersten Song
    if (songs.length > 0) {
        loadSong(0);
    }
    
    // Event Listener für Löschen-Buttons
    setupDeleteButtons();
}

// Update songs array from playlist DOM
function updateSongsFromPlaylist() {
    songs = [];
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        songs.push({
            src: item.dataset.src,
            title: item.dataset.title,
            artist: item.dataset.artist,
            element: item
        });
        
        // Click event für Song
        item.addEventListener('click', (e) => {
            // Nicht bei Klick auf Löschen-Button
            if (!e.target.closest('.delete-btn')) {
                currentSongIndex = index;
                loadSong(currentSongIndex);
                playSong();
            }
        });
    });
}

// Setup delete buttons
function setupDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const playlistItem = e.target.closest('.playlist-item');
            const index = Array.from(playlist.children).indexOf(playlistItem);
            
            // Wenn der gelöschte Song gerade spielt
            if (index === currentSongIndex) {
                pauseSong();
                if (songs.length > 1) {
                    currentSongIndex = index < songs.length - 1 ? index : index - 1;
                    loadSong(currentSongIndex);
                } else {
                    songTitle.textContent = 'Wähle einen Song';
                    artistName.textContent = 'Keine Musik geladen';
                }
            } else if (index < currentSongIndex) {
                currentSongIndex--;
            }
            
            // Entferne aus DOM
            playlistItem.remove();
            
            // Update songs array
            updateSongsFromPlaylist();
            updatePlaylistNumbers();
            savePlaylistToLocalStorage();
        });
    });
}

// Update playlist numbers
function updatePlaylistNumbers() {
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        item.querySelector('.item-number').textContent = index + 1;
    });
}

// Save playlist to localStorage
function savePlaylistToLocalStorage() {
    const playlistData = songs.map(song => ({
        title: song.title,
        artist: song.artist,
        src: song.src,
        duration: song.element.querySelector('.item-duration').textContent
    }));
    
    localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlistData));
    
    // Zeige Speicher-Bestätigung
    showNotification('Playlist gespeichert!');
}

// Load saved playlist
function loadSavedPlaylist() {
    const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
    if (savedPlaylist) {
        const playlistData = JSON.parse(savedPlaylist);
        
        // Lösche aktuelle Playlist
        playlist.innerHTML = '';
        
        // Füge gespeicherte Songs hinzu
        playlistData.forEach((song, index) => {
            const playlistItem = createPlaylistItem(song.title, song.artist, song.src, song.duration, index + 1);
            playlist.appendChild(playlistItem);
        });
    }
}

// Save playlist button
document.getElementById('savePlaylistBtn').addEventListener('click', () => {
    savePlaylistToLocalStorage();
});

// Load playlist button
document.getElementById('loadPlaylistBtn').addEventListener('click', () => {
    if (confirm('Aktuelle Playlist wird überschrieben. Fortfahren?')) {
        loadSavedPlaylist();
        updateSongsFromPlaylist();
        setupDeleteButtons();
        
        if (songs.length > 0) {
            currentSongIndex = 0;
            loadSong(0);
        }
        
        showNotification('Playlist geladen!');
    }
});

// Create playlist item element
function createPlaylistItem(title, artist, src, duration, number) {
    const playlistItem = document.createElement('div');
    playlistItem.className = 'playlist-item';
    playlistItem.dataset.src = src;
    playlistItem.dataset.title = title;
    playlistItem.dataset.artist = artist;
    
    playlistItem.innerHTML = `
        <div class="item-info">
            <span class="item-number">${number}</span>
            <div class="item-details">
                <h4>${title}</h4>
                <p>${artist}</p>
            </div>
        </div>
        <div class="item-actions">
            <span class="item-duration">${duration}</span>
            <button class="delete-btn" title="Entfernen">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    return playlistItem;
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Song laden
function loadSong(index) {
    if (songs[index]) {
        const song = songs[index];
        
        // Update UI
        songTitle.textContent = song.title;
        artistName.textContent = song.artist;
        
        // Update active state
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.remove('active');
        });
        song.element.classList.add('active');
        
        // Versuche Demo-Audio zu laden (in echtem Projekt würde hier die echte Datei geladen)
        // Für Demo-Zwecke verwenden wir einen Platzhalter
        audioPlayer.src = song.src || 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBxVos+3ttn0pBgY+l9j1x';
    }
}

// Play/Pause
function playSong() {
    isPlaying = true;
    audioPlayer.play();
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    albumArt.classList.add('playing');
    
    // Start visualizer
    setupAudioContext();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    visualize();
}

function pauseSong() {
    isPlaying = false;
    audioPlayer.pause();
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    albumArt.classList.remove('playing');
    cancelAnimationFrame(animationId);
}

// Event Listeners
playPauseBtn.addEventListener('click', () => {
    isPlaying ? pauseSong() : playSong();
});

prevBtn.addEventListener('click', () => {
    currentSongIndex = currentSongIndex > 0 ? currentSongIndex - 1 : songs.length - 1;
    loadSong(currentSongIndex);
    if (isPlaying) playSong();
});

nextBtn.addEventListener('click', () => {
    if (isShuffling) {
        currentSongIndex = Math.floor(Math.random() * songs.length);
    } else {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
    }
    loadSong(currentSongIndex);
    if (isPlaying) playSong();
});

shuffleBtn.addEventListener('click', () => {
    isShuffling = !isShuffling;
    shuffleBtn.classList.toggle('active');
});

repeatBtn.addEventListener('click', () => {
    isRepeating = !isRepeating;
    repeatBtn.classList.toggle('active');
});

// Progress Bar
audioPlayer.addEventListener('timeupdate', () => {
    const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = progressPercent + '%';
    
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    durationEl.textContent = formatTime(audioPlayer.duration);
});

progressBar.addEventListener('click', (e) => {
    const clickX = e.offsetX;
    const width = progressBar.offsetWidth;
    const duration = audioPlayer.duration;
    audioPlayer.currentTime = (clickX / width) * duration;
});

// Volume Control
volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    audioPlayer.volume = volume;
    
    // Update volume icon
    if (volume === 0) {
        volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else if (volume < 0.5) {
        volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
});

volumeBtn.addEventListener('click', () => {
    if (audioPlayer.volume > 0) {
        audioPlayer.volume = 0;
        volumeSlider.value = 0;
        volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else {
        audioPlayer.volume = 0.7;
        volumeSlider.value = 70;
        volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
});

// Song ended
audioPlayer.addEventListener('ended', () => {
    if (isRepeating) {
        audioPlayer.currentTime = 0;
        playSong();
    } else {
        nextBtn.click();
    }
});

// Add songs
addSongBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    
    for (let file of files) {
        const url = URL.createObjectURL(file);
        const title = file.name.replace(/\.[^/.]+$/, "");
        const number = songs.length + 1;
        
        // Create playlist item
        const playlistItem = createPlaylistItem(title, 'Unbekannter Künstler', url, '--:--', number);
        playlist.appendChild(playlistItem);
        
        // Add to songs array
        const newSong = {
            src: url,
            title: title,
            artist: 'Unbekannter Künstler',
            element: playlistItem
        };
        
        const songIndex = songs.length;
        playlistItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn')) {
                currentSongIndex = songIndex;
                loadSong(currentSongIndex);
                playSong();
            }
        });
        
        songs.push(newSong);
        
        // Setup delete button for new item
        const deleteBtn = playlistItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = Array.from(playlist.children).indexOf(playlistItem);
            
            if (index === currentSongIndex) {
                pauseSong();
                if (songs.length > 1) {
                    currentSongIndex = index < songs.length - 1 ? index : index - 1;
                    loadSong(currentSongIndex);
                } else {
                    songTitle.textContent = 'Wähle einen Song';
                    artistName.textContent = 'Keine Musik geladen';
                }
            } else if (index < currentSongIndex) {
                currentSongIndex--;
            }
            
            playlistItem.remove();
            updateSongsFromPlaylist();
            updatePlaylistNumbers();
            savePlaylistToLocalStorage();
        });
        
        // Try to get duration
        const tempAudio = new Audio(url);
        tempAudio.addEventListener('loadedmetadata', () => {
            playlistItem.querySelector('.item-duration').textContent = formatTime(tempAudio.duration);
            savePlaylistToLocalStorage();
        });
    }
    
    showNotification(`${files.length} Song(s) hinzugefügt!`);
    savePlaylistToLocalStorage();
});

// Visualizer
function visualize() {
    animationId = requestAnimationFrame(visualize);
    
    if (!analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    switch (visualizerMode) {
        case 'bars':
            drawBars();
            break;
        case 'wave':
            drawWave();
            break;
        case 'circle':
            drawCircle();
            break;
    }
}

function drawBars() {
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.7;
        
        const r = 45 + (dataArray[i] / 255) * 150;
        const g = 96 + (dataArray[i] / 255) * 150;
        const b = 92;
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
    }
}

function drawWave() {
    ctx.strokeStyle = 'rgba(195, 246, 234, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const y = (dataArray[i] / 255) * canvas.height;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.stroke();
}

function drawCircle() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    
    for (let i = 0; i < dataArray.length; i++) {
        const angle = (i / dataArray.length) * Math.PI * 2;
        const amp = (dataArray[i] / 255) * 100;
        
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + amp);
        const y2 = centerY + Math.sin(angle) * (radius + amp);
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, 'rgba(45, 96, 92, 0.8)');
        gradient.addColorStop(1, 'rgba(195, 246, 234, 0.8)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 96, 92, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Visualizer Mode Selection
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        visualizerMode = btn.dataset.mode;
    });
});

// Format time helper
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case ' ':
            e.preventDefault();
            playPauseBtn.click();
            break;
        case 'ArrowRight':
            audioPlayer.currentTime += 5;
            break;
        case 'ArrowLeft':
            audioPlayer.currentTime -= 5;
            break;
        case 'ArrowUp':
            volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
        case 'ArrowDown':
            volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
    }
});

// Initialize player
init();

// Set initial volume
audioPlayer.volume = 0.7;