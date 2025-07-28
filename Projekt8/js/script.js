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
const volumePercent = document.querySelector('.volume-percent');
const songTitle = document.getElementById('songTitle');
const artistName = document.getElementById('artistName');
const playlist = document.getElementById('playlist');
const albumArt = document.getElementById('albumArt');
const fileInput = document.getElementById('fileInput');
const addSongBtn = document.getElementById('addSongBtn');
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const importInput = document.getElementById('importInput');

// Visualizer
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let audioContext;
let analyser;
let source;
let dataArray;
let animationId;
let sourceConnected = false;

// Player State
let isPlaying = false;
let currentSongIndex = 0;
let isShuffling = false;
let isRepeating = false;
let songs = [];
let visualizerMode = 'bars';

// Object URLs verwalten
const objectURLs = new Map();

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
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        } catch (e) {
            console.error('Audio Context Error:', e);
        }
    }
    
    // Connect source if not already connected
    if (audioContext && !sourceConnected && audioPlayer.src) {
        try {
            source = audioContext.createMediaElementSource(audioPlayer);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            sourceConnected = true;
        } catch (e) {
            console.error('Source connection error:', e);
        }
    }
}

// Create Playlist Item
function createPlaylistItem(song, number) {
    const playlistItem = document.createElement('div');
    playlistItem.className = 'playlist-item';
    
    playlistItem.innerHTML = `
        <div class="item-info">
            <span class="item-number">${number}</span>
            <div class="item-details">
                <h4>${song.title}</h4>
                <p>${song.artist}</p>
            </div>
        </div>
        <div class="item-actions">
            <span class="item-duration">${song.duration || '--:--'}</span>
            <button class="delete-btn" title="Entfernen">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Click event
    playlistItem.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-btn')) {
            const index = Array.from(playlist.children).indexOf(playlistItem);
            currentSongIndex = index;
            loadSong(currentSongIndex);
            playSong();
        }
    });
    
    // Delete button
    const deleteBtn = playlistItem.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = Array.from(playlist.children).indexOf(playlistItem);
        deleteSong(index);
    });
    
    return playlistItem;
}

// Delete Song
function deleteSong(index) {
    // Pause if deleting current song
    if (index === currentSongIndex && isPlaying) {
        pauseSong();
    }
    
    // Clean up object URL if exists
    const song = songs[index];
    if (song && song.objectURL && objectURLs.has(song.objectURL)) {
        URL.revokeObjectURL(song.objectURL);
        objectURLs.delete(song.objectURL);
    }
    
    // Remove from array and DOM
    songs.splice(index, 1);
    playlist.children[index].remove();
    
    // Update numbers
    updatePlaylistNumbers();
    
    // Update current index
    if (songs.length === 0) {
        songTitle.textContent = 'Wähle einen Song';
        artistName.textContent = 'Keine Musik geladen';
        audioPlayer.src = '';
        currentSongIndex = 0;
    } else if (index === currentSongIndex) {
        currentSongIndex = Math.min(currentSongIndex, songs.length - 1);
        loadSong(currentSongIndex);
    } else if (index < currentSongIndex) {
        currentSongIndex--;
    }
    
    savePlaylistToLocalStorage();
}

// Update Playlist Numbers
function updatePlaylistNumbers() {
    document.querySelectorAll('.item-number').forEach((num, i) => {
        num.textContent = i + 1;
    });
}

// Load Song
function loadSong(index) {
    if (songs[index]) {
        const song = songs[index];
        songTitle.textContent = song.title;
        artistName.textContent = song.artist;
        
        // Update active state
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        
        // Check if song is imported (has no actual audio file)
        if (song.imported && !song.objectURL) {
            audioPlayer.src = '';
            showNotification('Dieser Song wurde importiert - bitte Datei hinzufügen');
            return;
        }
        
        // Load audio
        if (song.objectURL) {
            audioPlayer.src = song.objectURL;
        } else if (song.url && !song.url.startsWith('blob:')) {
            audioPlayer.src = song.url;
        }
        
        audioPlayer.load();
        
        // Setup audio context after loading
        audioPlayer.addEventListener('loadeddata', () => {
            setupAudioContext();
        }, { once: true });
    }
}

// Play Song
function playSong() {
    const currentSong = songs[currentSongIndex];
    if (!currentSong) return;
    
    // Check if it's an imported song without file
    if (currentSong.imported && !currentSong.objectURL) {
        showNotification('Bitte fügen Sie zuerst die Musikdatei hinzu');
        return;
    }
    
    if (!audioPlayer.src) {
        showNotification('Keine Audiodatei verfügbar');
        return;
    }
    
    isPlaying = true;
    
    // Resume audio context if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audioPlayer.play().then(() => {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        albumArt.classList.add('playing');
        visualize();
    }).catch(e => {
        console.error('Playback error:', e);
        showNotification('Fehler beim Abspielen');
        isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    });
}

// Pause Song
function pauseSong() {
    isPlaying = false;
    audioPlayer.pause();
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    albumArt.classList.remove('playing');
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

// Event Listeners
playPauseBtn.addEventListener('click', () => {
    if (songs.length === 0) {
        showNotification('Keine Songs in der Playlist!');
        return;
    }
    isPlaying ? pauseSong() : playSong();
});

prevBtn.addEventListener('click', () => {
    if (songs.length === 0) return;
    currentSongIndex = currentSongIndex > 0 ? currentSongIndex - 1 : songs.length - 1;
    loadSong(currentSongIndex);
    if (isPlaying) playSong();
});

nextBtn.addEventListener('click', () => {
    if (songs.length === 0) return;
    
    if (isShuffling) {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * songs.length);
        } while (newIndex === currentSongIndex && songs.length > 1);
        currentSongIndex = newIndex;
    } else {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
    }
    
    loadSong(currentSongIndex);
    if (isPlaying) playSong();
});

shuffleBtn.addEventListener('click', () => {
    isShuffling = !isShuffling;
    shuffleBtn.classList.toggle('active');
    showNotification(isShuffling ? 'Zufallswiedergabe aktiviert' : 'Zufallswiedergabe deaktiviert');
});

repeatBtn.addEventListener('click', () => {
    isRepeating = !isRepeating;
    repeatBtn.classList.toggle('active');
    showNotification(isRepeating ? 'Wiederholung aktiviert' : 'Wiederholung deaktiviert');
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

// Volume Control - Start bei 30%
audioPlayer.volume = 0.3;

volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    audioPlayer.volume = volume;
    volumePercent.textContent = e.target.value + '%';
    
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
        volumeSlider.dataset.prevValue = volumeSlider.value;
        volumeSlider.value = 0;
        audioPlayer.volume = 0;
        volumePercent.textContent = '0%';
        volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else {
        const prevValue = volumeSlider.dataset.prevValue || 30;
        volumeSlider.value = prevValue;
        audioPlayer.volume = prevValue / 100;
        volumePercent.textContent = prevValue + '%';
        volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
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
        const objectURL = URL.createObjectURL(file);
        objectURLs.set(objectURL, true);
        
        const title = file.name.replace(/\.[^/.]+$/, "");
        
        // Check if we're updating a saved song
        let songUpdated = false;
        for (let i = 0; i < songs.length; i++) {
            if (songs[i].saved && 
                songs[i].fileName === file.name && 
                songs[i].fileSize === file.size &&
                songs[i].lastModified === file.lastModified) {
                // Update the saved song with actual file
                songs[i].objectURL = objectURL;
                songs[i].saved = false;
                
                // Update visual indicator
                const playlistItems = playlist.children;
                if (playlistItems[i]) {
                    playlistItems[i].style.opacity = '1';
                }
                
                songUpdated = true;
                showNotification(`Song "${songs[i].title}" wurde wiederhergestellt`);
                break;
            }
        }
        
        if (!songUpdated) {
            // Add as new song
            const song = {
                objectURL: objectURL,
                title: title,
                artist: 'Lokale Datei',
                duration: '--:--',
                fileName: file.name,
                fileSize: file.size,
                lastModified: file.lastModified
            };
            
            songs.push(song);
            const playlistItem = createPlaylistItem(song, songs.length);
            playlist.appendChild(playlistItem);
            
            // Get duration
            const tempAudio = new Audio(objectURL);
            tempAudio.addEventListener('loadedmetadata', () => {
                song.duration = formatTime(tempAudio.duration);
                playlistItem.querySelector('.item-duration').textContent = song.duration;
                savePlaylistToLocalStorage();
            });
        }
    }
    
    const newSongsCount = Array.from(files).filter(file => {
        return !songs.some(song => 
            song.fileName === file.name && 
            song.fileSize === file.size && 
            song.lastModified === file.lastModified
        );
    }).length;
    
    if (newSongsCount > 0) {
        showNotification(`${newSongsCount} neue(r) Song(s) hinzugefügt!`);
    }
    
    savePlaylistToLocalStorage();
    updatePlaylistNumbers();
    
    // Clear file input for reselection
    fileInput.value = '';
});

// Menu
menuBtn.addEventListener('click', () => {
    menuDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
        menuDropdown.classList.remove('show');
    }
});

// Menu Actions
document.getElementById('clearPlaylistBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Möchten Sie wirklich die gesamte Playlist löschen?')) {
        pauseSong();
        
        // Clean up all object URLs
        objectURLs.forEach((_, url) => {
            URL.revokeObjectURL(url);
        });
        objectURLs.clear();
        
        playlist.innerHTML = '';
        songs = [];
        currentSongIndex = 0;
        songTitle.textContent = 'Wähle einen Song';
        artistName.textContent = 'Keine Musik geladen';
        audioPlayer.src = '';
        localStorage.removeItem('musicPlayerPlaylist');
        showNotification('Playlist gelöscht!');
    }
    menuDropdown.classList.remove('show');
});

document.getElementById('aboutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Music Player v1.0\nEntwickelt von Sandra Lukic\n\nFeatures:\n- Lokale Musikdateien\n- Visualizer mit 3 Modi\n- Playlist-Verwaltung\n- Import/Export von Playlists');
    menuDropdown.classList.remove('show');
});

document.getElementById('exportPlaylistBtn').addEventListener('click', (e) => {
    e.preventDefault();
    
    // Show export options
    const format = confirm('Export Format wählen:\n\nOK = JSON (mit allen Details)\nAbbrechen = M3U (Standard Playlist Format)');
    
    if (format) {
        exportPlaylist();
    } else {
        exportAsM3U();
    }
    
    menuDropdown.classList.remove('show');
});

document.getElementById('importPlaylistBtn').addEventListener('click', (e) => {
    e.preventDefault();
    importInput.click();
    menuDropdown.classList.remove('show');
});

// Save/Load Playlist
function savePlaylistToLocalStorage() {
    const playlistData = songs.map(song => ({
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        fileName: song.fileName
    }));
    
    localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlistData));
}

function loadSavedPlaylist() {
    const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
    if (savedPlaylist) {
        try {
            const playlistData = JSON.parse(savedPlaylist);
            showNotification('Gespeicherte Playlist gefunden. Bitte fügen Sie die Dateien erneut hinzu.');
        } catch (e) {
            console.error('Error loading playlist:', e);
        }
    }
}

document.getElementById('savePlaylistBtn').addEventListener('click', () => {
    savePlaylistToLocalStorage();
    showNotification('Playlist-Info gespeichert!');
});

document.getElementById('loadPlaylistBtn').addEventListener('click', () => {
    showNotification('Bitte verwenden Sie die Import-Funktion');
});

// Export/Import
function exportPlaylist() {
    const playlistData = songs.map(song => ({
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        fileName: song.fileName
    }));
    
    const exportData = {
        playlistName: "Music Player Playlist",
        exportDate: new Date().toISOString(),
        songs: playlistData
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `playlist_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('Playlist exportiert!');
}

// Export as M3U
function exportAsM3U() {
    let m3uContent = '#EXTM3U\n';
    
    songs.forEach(song => {
        const duration = song.duration === '--:--' ? -1 : 
            song.duration.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
        m3uContent += `#EXTINF:${duration},${song.artist} - ${song.title}\n`;
        m3uContent += `${song.fileName}\n`;
    });
    
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `playlist_${new Date().toISOString().split('T')[0]}.m3u`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('M3U Playlist exportiert!');
}

// Update import to handle JSON and M3U formats
importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'm3u' || fileExtension === 'm3u8') {
        // Handle M3U import
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const lines = content.split('\n');
                const newSongs = [];
                
                let currentSong = null;
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith('#EXTINF:')) {
                        // Parse song info
                        const match = line.match(/#EXTINF:(-?\d+),(.+)/);
                        if (match) {
                            const [, duration, info] = match;
                            const parts = info.split(' - ');
                            currentSong = {
                                artist: parts.length > 1 ? parts[0] : 'Unbekannter Künstler',
                                title: parts.length > 1 ? parts[1] : info,
                                duration: duration > 0 ? formatTime(parseInt(duration)) : '--:--'
                            };
                        }
                    } else if (line && !line.startsWith('#') && currentSong) {
                        // This is the filename
                        currentSong.fileName = line.split('/').pop().split('\\').pop();
                        newSongs.push(currentSong);
                        currentSong = null;
                    }
                });
                
                if (newSongs.length > 0) {
                    // Clear current playlist
                    playlist.innerHTML = '';
                    songs = [];
                    
                    // Add imported songs
                    newSongs.forEach((song, index) => {
                        const importedSong = {
                            title: song.title,
                            artist: song.artist,
                            duration: song.duration,
                            fileName: song.fileName,
                            imported: true
                        };
                        
                        songs.push(importedSong);
                        const playlistItem = createPlaylistItem(importedSong, index + 1);
                        playlistItem.style.opacity = '0.6';
                        playlist.appendChild(playlistItem);
                    });
                    
                    showNotification(`${newSongs.length} Songs aus M3U importiert. Bitte Dateien hinzufügen!`);
                }
                
            } catch (error) {
                alert('Fehler beim Importieren der M3U Playlist!');
                console.error('M3U import error:', error);
            }
        };
        reader.readAsText(file);
        
    } else {
        // Handle JSON import (existing code)
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                let playlistData;
                
                // Check if it's the new format or old format
                if (importedData.songs && Array.isArray(importedData.songs)) {
                    // New format
                    playlistData = importedData.songs;
                } else if (Array.isArray(importedData)) {
                    // Old format - direct array
                    playlistData = importedData;
                } else {
                    throw new Error('Unbekanntes Playlist-Format');
                }
                
                // Show import dialog with instructions
                const message = `Playlist Import:\n\n` +
                    `Die Playlist enthält ${playlistData.length} Songs:\n\n` +
                    playlistData.map((song, i) => `${i + 1}. ${song.title} - ${song.artist}`).join('\n') +
                    `\n\nHINWEIS: Die Musikdateien müssen manuell hinzugefügt werden.\n` +
                    `Die importierte Playlist zeigt nur die Song-Informationen.`;
                
                alert(message);
                
                // Clear current playlist
                playlist.innerHTML = '';
                songs = [];
                
                // Add imported songs info
                playlistData.forEach((song, index) => {
                    // Create placeholder song object
                    const importedSong = {
                        title: song.title || 'Unbekannter Titel',
                        artist: song.artist || 'Unbekannter Künstler',
                        duration: song.duration || '--:--',
                        fileName: song.fileName || '',
                        imported: true // Mark as imported
                    };
                    
                    songs.push(importedSong);
                    const playlistItem = createPlaylistItem(importedSong, index + 1);
                    playlistItem.style.opacity = '0.6'; // Visual indicator for imported songs
                    playlist.appendChild(playlistItem);
                });
                
                showNotification(`${playlistData.length} Song-Infos importiert. Bitte Dateien hinzufügen!`);
                
            } catch (error) {
                alert('Fehler beim Importieren der Playlist!\n\nStellen Sie sicher, dass die Datei im richtigen JSON-Format ist.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
});

// Visualizer
function visualize() {
    if (!isPlaying) return;
    
    animationId = requestAnimationFrame(visualize);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!analyser || !dataArray) {
        simulateVisualizer();
        return;
    }
    
    try {
        analyser.getByteFrequencyData(dataArray);
        
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
    } catch (e) {
        simulateVisualizer();
    }
}

function simulateVisualizer() {
    const time = Date.now() * 0.001;
    const fakeData = new Array(64).fill(0).map((_, i) => 
        Math.sin(time + i * 0.2) * 100 + 100 + Math.random() * 50
    );
    
    switch (visualizerMode) {
        case 'bars':
            drawBarsSimulated(fakeData);
            break;
        case 'wave':
            drawWaveSimulated(fakeData);
            break;
        case 'circle':
            drawCircleSimulated(fakeData);
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

function drawBarsSimulated(data) {
    const barWidth = (canvas.width / data.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * canvas.height * 0.7;
        
        const r = 45 + (data[i] / 255) * 150;
        const g = 96 + (data[i] / 255) * 150;
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

function drawWaveSimulated(data) {
    ctx.strokeStyle = 'rgba(195, 246, 234, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = canvas.width / data.length;
    let x = 0;
    
    for (let i = 0; i < data.length; i++) {
        const y = (data[i] / 255) * canvas.height;
        
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

function drawCircleSimulated(data) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    
    for (let i = 0; i < data.length; i++) {
        const angle = (i / data.length) * Math.PI * 2;
        const amp = (data[i] / 255) * 100;
        
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

// Notifications
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

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
            e.preventDefault();
            volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
        case 'ArrowDown':
            e.preventDefault();
            volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    // Try to load saved playlist info
    loadSavedPlaylist();
    
    // Handle audio errors
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio Error:', e);
        if (e.target.error) {
            console.error('Error code:', e.target.error.code);
            console.error('Error message:', e.target.error.message);
        }
    });
});
