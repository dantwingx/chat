// Initialize Socket.io
const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const errorMessage = document.getElementById('error-message');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const usersList = document.getElementById('users-list');
const currentUserSpan = document.getElementById('current-user');
const typingIndicator = document.getElementById('typing-indicator');
const settingsBtn = document.getElementById('settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsModal = document.getElementById('settings-modal');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const languageSelect = document.getElementById('language-select');
const profilePhotoInput = document.getElementById('profile-photo-input');
const profilePhotoPreview = document.getElementById('profile-photo-preview');
const bioInput = document.getElementById('bio-input');

// New DOM elements for media features
const attachBtn = document.getElementById('attach-btn');
const mediaGalleryBtn = document.getElementById('media-gallery-btn');
const fileInput = document.getElementById('file-input');
const uploadProgress = document.getElementById('upload-progress');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentList = document.getElementById('attachment-list');
const newMessagesIndicator = document.getElementById('new-messages-indicator');
const mediaGalleryModal = document.getElementById('media-gallery-modal');
const mediaViewerModal = document.getElementById('media-viewer-modal');
const mediaGrid = document.getElementById('media-grid');
const viewerContent = document.getElementById('viewer-content');
const selectAllBtn = document.getElementById('select-all-btn');
const downloadSelectedBtn = document.getElementById('download-selected-btn');

// Room management DOM elements
const roomsList = document.getElementById('rooms-list');
const currentRoomName = document.getElementById('current-room-name');
const roomAnnouncement = document.getElementById('room-announcement');
const createRoomBtn = document.getElementById('create-room-btn');
const roomSettingsBtn = document.getElementById('room-settings-btn');
const createRoomModal = document.getElementById('create-room-modal');
const roomSettingsModal = document.getElementById('room-settings-modal');
const roomNameInput = document.getElementById('room-name-input');
const roomDescriptionInput = document.getElementById('room-description-input');
const roomMaxUsersInput = document.getElementById('room-max-users-input');
const roomAnnouncementInput = document.getElementById('room-announcement-input');
const deleteRoomBtn = document.getElementById('delete-room-btn');
const deleteRoomSection = document.getElementById('delete-room-section');

// State
let currentUsername = '';
let currentProfile = { profilePhoto: null, bio: '' };
let sessionId = null;
let currentRoomId = null;
let currentRoomInfo = null;
let rooms = [];
let isTyping = false;
let typingTimer = null;
let activeUsers = [];
let pendingAttachments = [];
let allMediaFiles = [];
let selectedMediaFiles = new Set();
let currentViewerIndex = 0;
let autoScroll = true;
let unreadMessages = [];
let visibleMessageIds = new Set();
let messageReadCounts = new Map();

// Initialize i18n and dark mode
async function init() {
    // Initialize i18n
    await i18n.init();
    
    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.documentElement.classList.add('dark-theme');
        darkModeToggle.checked = true;
    }
    
    // Set language in select
    languageSelect.value = i18n.currentLanguage;
    
    // Initialize UI state based on current authentication
    updateUIBasedOnAuthState();
    
    // Check for existing session
    const savedSessionId = localStorage.getItem('sessionId');
    const savedUsername = localStorage.getItem('username');
    
    if (savedSessionId && savedUsername) {
        // Validate session with server
        try {
            const response = await fetch('/api/session/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: savedSessionId })
            });
            
            if (response.ok) {
                const data = await response.json();
                sessionId = savedSessionId;
                currentUsername = data.username;
                currentProfile = data.profile || { profilePhoto: null, bio: '' };
                
                console.log('Auto-joining with session data:', {
                    username: currentUsername,
                    sessionId: sessionId,
                    roomId: data.roomId
                });
                
                // Auto-join with session data
                socket.emit('join', {
                    username: currentUsername,
                    sessionId: sessionId,
                    roomId: data.roomId
                });
            } else {
                console.log('Invalid session, clearing localStorage');
                // Invalid session, clear localStorage
                localStorage.removeItem('sessionId');
                localStorage.removeItem('username');
                currentUsername = '';
                sessionId = null;
                updateUIBasedOnAuthState();
            }
        } catch (error) {
            console.error('Session validation error:', error);
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            currentUsername = '';
            sessionId = null;
            updateUIBasedOnAuthState();
        }
    }
}

// Event Listeners
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    } else {
        handleTyping();
    }
});

settingsBtn.addEventListener('click', openSettings);
logoutBtn.addEventListener('click', logout);

// New event listeners for media features
attachBtn.addEventListener('click', () => fileInput.click());
mediaGalleryBtn.addEventListener('click', openMediaGallery);
fileInput.addEventListener('change', handleFileSelection);
newMessagesIndicator.addEventListener('click', scrollToBottom);

// Room management event listeners
createRoomBtn.addEventListener('click', (e) => {
    // Prevent room creation if not authenticated
    if (!currentUsername || currentUsername.trim() === '') {
        e.preventDefault();
        console.error('Room creation attempted without authentication');
        alert('Error: You must be logged in to create a room. Please refresh the page and log in again.');
        return;
    }
    openCreateRoomModal();
});
roomSettingsBtn.addEventListener('click', openRoomSettings);

// Create room modal event listeners
createRoomModal.querySelector('.modal-overlay').addEventListener('click', closeCreateRoomModal);
createRoomModal.querySelector('.close-btn').addEventListener('click', closeCreateRoomModal);
createRoomModal.querySelector('.cancel').addEventListener('click', closeCreateRoomModal);
createRoomModal.querySelector('.save').addEventListener('click', createRoom);

// Room settings modal event listeners
roomSettingsModal.querySelector('.modal-overlay').addEventListener('click', closeRoomSettings);
roomSettingsModal.querySelector('.close-btn').addEventListener('click', closeRoomSettings);
roomSettingsModal.querySelector('.cancel').addEventListener('click', closeRoomSettings);
roomSettingsModal.querySelector('.save').addEventListener('click', saveRoomSettings);
deleteRoomBtn?.addEventListener('click', deleteRoom);

// Message container scroll handling
messagesContainer.addEventListener('scroll', () => {
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;
    
    if (isAtBottom) {
        autoScroll = true;
        newMessagesIndicator.style.display = 'none';
        markVisibleMessagesAsRead();
    } else {
        autoScroll = false;
    }
});

// Intersection Observer for read receipts
const messageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            if (messageId && !visibleMessageIds.has(messageId)) {
                visibleMessageIds.add(messageId);
                unreadMessages = unreadMessages.filter(id => id !== messageId);
            }
        }
    });
    
    // Batch send read receipts
    if (visibleMessageIds.size > 0) {
        const messageIds = Array.from(visibleMessageIds);
        socket.emit('mark-messages-read', messageIds);
    }
}, {
    root: messagesContainer,
    threshold: 0.5
});

// Settings modal event listeners
document.querySelector('.modal-overlay').addEventListener('click', closeSettings);
document.querySelector('.close-btn').addEventListener('click', closeSettings);
document.querySelector('.modal-actions .cancel').addEventListener('click', closeSettings);
document.querySelector('.modal-actions .save').addEventListener('click', saveSettings);

darkModeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }
});

languageSelect.addEventListener('change', async (e) => {
    await i18n.setLanguage(e.target.value);
});

profilePhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert(i18n.t('maxFileSize'));
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            profilePhotoPreview.innerHTML = `<img src="${e.target.result}" alt="Profile">`;
        };
        reader.readAsDataURL(file);
    }
});

// Functions
function joinChat() {
    const username = usernameInput.value.trim();
    
    console.log('Attempting to join chat with username:', username);
    
    if (!username) {
        showError(i18n.t('usernameRequired'));
        return;
    }
    
    if (username.length > 20) {
        showError(i18n.t('usernameTooLong'));
        return;
    }
    
    // Clear any previous errors
    errorMessage.textContent = '';
    
    // Save username to localStorage
    localStorage.setItem('username', username);
    currentUsername = username;
    
    console.log('Username set, currentUsername is now:', currentUsername);
    
    // Update UI state based on authentication
    updateUIBasedOnAuthState();
    
    // Emit join event with session support
    socket.emit('join', {
        username: username,
        sessionId: sessionId,
        roomId: currentRoomId
    });
}

function showError(message) {
    errorMessage.textContent = message;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message && pendingAttachments.length === 0) return;
    
    // Prepare message data
    const messageData = {
        message: message,
        attachments: pendingAttachments
    };
    
    // Send message
    socket.emit('chat-message', messageData);
    
    // Clear input and attachments
    messageInput.value = '';
    pendingAttachments = [];
    attachmentPreview.style.display = 'none';
    attachmentList.innerHTML = '';
    
    // Stop typing indicator
    stopTyping();
}

function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing-start');
    }
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stopTyping();
    }, 1000);
}

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing-stop');
    }
    clearTimeout(typingTimer);
}

function createAvatarElement(user) {
    if (user.profilePhoto && user.profilePhoto !== 'null' && user.profilePhoto !== 'undefined') {
        return `<img src="${user.profilePhoto}" alt="${escapeHtml(user.username)}" onerror="this.outerHTML='<svg width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><path d=\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\'></path><circle cx=\'12\' cy=\'7\' r=\'4\'></circle></svg>'">`;
    } else {
        return `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
    }
}

function displayMessage(messageData, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    messageDiv.dataset.messageId = messageData.id;
    
    const time = new Date(messageData.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const avatarHtml = `
        <div class="message-avatar">
            ${createAvatarElement({ 
                username: messageData.username, 
                profilePhoto: messageData.profilePhoto 
            })}
        </div>
    `;
    
    // Build message content with attachments
    let messageContent = '';
    
    if (messageData.message) {
        messageContent += `<div class="message-bubble">${escapeHtml(messageData.message)}</div>`;
    }
    
    if (messageData.attachments && messageData.attachments.length > 0) {
        messageContent += renderAttachments(messageData.attachments);
    }
    
    // Read receipts - show unread count
    const totalUsers = usersList.children.length;
    const readCount = messageData.readCount || 1;
    const unreadCount = Math.max(0, totalUsers - readCount);
    const readReceiptHtml = isOwn ? `<span class="read-count" title="${unreadCount} unread">${unreadCount > 0 ? `${unreadCount} unread` : '✓✓ All read'}</span>` : '';
    
    const contentHtml = `
        <div class="message-content">
            ${messageContent}
            <div class="message-info">
                ${isOwn ? '' : escapeHtml(messageData.username) + ' • '}${time}
                ${readReceiptHtml}
            </div>
        </div>
    `;
    
    messageDiv.innerHTML = isOwn ? contentHtml + avatarHtml : avatarHtml + contentHtml;
    
    // Store in media files list
    if (messageData.attachments) {
        messageData.attachments.forEach(att => {
            allMediaFiles.push({
                ...att,
                sender: messageData.username,
                timestamp: messageData.timestamp
            });
        });
    }
    
    messagesContainer.appendChild(messageDiv);
    
    // Observe for read receipts
    messageObserver.observe(messageDiv);
    
    // Handle auto-scroll
    if (autoScroll || isOwn) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else if (!isOwn) {
        newMessagesIndicator.style.display = 'block';
        unreadMessages.push(messageData.id);
    }
}

function renderAttachments(attachments) {
    const mediaHtml = attachments.map(att => {
        if (att.type === 'image') {
            return `
                <div class="message-media" onclick="openMediaViewer('${att.url}', '${att.originalName}')">
                    <img src="${att.url}" alt="${escapeHtml(att.originalName)}" loading="lazy">
                    <div class="media-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
                </div>
            `;
        } else if (att.type === 'video') {
            return `
                <div class="message-media video-thumbnail" onclick="openMediaViewer('${att.url}', '${att.originalName}')">
                    <video src="${att.url}" preload="metadata"></video>
                    <div class="media-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="message-file" onclick="window.open('${att.url}', '_blank')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <div class="file-info">
                        <span class="file-name">${escapeHtml(att.originalName)}</span>
                        <span class="file-size">${formatFileSize(att.size)}</span>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    return `<div class="message-attachments">${mediaHtml}</div>`;
}

function displaySystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUsersList() {
    usersList.innerHTML = '';
    
    activeUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = `user-item ${user.isTyping ? 'typing' : ''}`;
        
        let content = `
            <div class="user-avatar">
                ${createAvatarElement(user)}
            </div>
            <div class="user-info">
                <span>${escapeHtml(user.username)}</span>
        `;
        
        if (user.isTyping) {
            content += `
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
        }
        
        content += '</div>';
        
        userDiv.innerHTML = content;
        usersList.appendChild(userDiv);
    });
}

function updateTypingIndicator() {
    const typingUsers = activeUsers.filter(user => user.isTyping);
    
    if (typingUsers.length === 0) {
        typingIndicator.textContent = '';
    } else if (typingUsers.length === 1) {
        typingIndicator.textContent = i18n.t('isTyping', { username: typingUsers[0].username });
    } else if (typingUsers.length === 2) {
        typingIndicator.textContent = i18n.t('areTyping', { 
            username1: typingUsers[0].username, 
            username2: typingUsers[1].username 
        });
    } else {
        typingIndicator.textContent = i18n.t('multipleTyping', { count: typingUsers.length });
    }
}

function openSettings() {
    settingsModal.classList.add('active');
    
    // Load current profile
    if (currentProfile.profilePhoto && currentProfile.profilePhoto !== 'null' && currentProfile.profilePhoto !== 'undefined') {
        profilePhotoPreview.innerHTML = `<img src="${currentProfile.profilePhoto}" alt="Profile">`;
    } else {
        profilePhotoPreview.innerHTML = '';
    }
    bioInput.value = currentProfile.bio || '';
}

function closeSettings() {
    settingsModal.classList.remove('active');
    profilePhotoInput.value = '';
}

async function saveSettings() {
    // Save dark mode preference
    localStorage.setItem('darkMode', darkModeToggle.checked);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('username', currentUsername);
    formData.append('bio', bioInput.value);
    
    // Add photo if selected
    if (profilePhotoInput.files[0]) {
        formData.append('profilePhoto', profilePhotoInput.files[0]);
    } else if (currentProfile.profilePhoto) {
        formData.append('existingPhoto', currentProfile.profilePhoto);
    }
    
    try {
        const response = await fetch('/api/profile/update', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentProfile = {
                profilePhoto: result.profilePhoto,
                bio: result.bio
            };
            
            displaySystemMessage(i18n.t('profileUpdated'));
            closeSettings();
        } else {
            alert(result.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        alert('Failed to update profile');
    }
}

function logout() {
    if (confirm(i18n.t('logout') + '?')) {
        socket.emit('logout');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('username');
        location.reload();
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// New helper functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    autoScroll = true;
    newMessagesIndicator.style.display = 'none';
}

function markVisibleMessagesAsRead() {
    const messages = messagesContainer.querySelectorAll('.message');
    const visibleIds = [];
    
    messages.forEach(msg => {
        const rect = msg.getBoundingClientRect();
        const containerRect = messagesContainer.getBoundingClientRect();
        
        if (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom) {
            const msgId = msg.dataset.messageId;
            if (msgId && !msg.classList.contains('own')) {
                visibleIds.push(msgId);
            }
        }
    });
    
    if (visibleIds.length > 0) {
        socket.emit('mark-messages-read', visibleIds);
    }
}

// File handling functions
async function handleFileSelection(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadProgress.style.display = 'block';
    
    try {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        
        const response = await fetch('/api/upload/media', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const result = await response.json();
        
        // Add to pending attachments
        pendingAttachments.push(...result.files);
        
        // Show attachment preview
        showAttachmentPreview();
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload files');
    } finally {
        uploadProgress.style.display = 'none';
        fileInput.value = '';
    }
}

function showAttachmentPreview() {
    if (pendingAttachments.length === 0) {
        attachmentPreview.style.display = 'none';
        return;
    }
    
    attachmentPreview.style.display = 'block';
    attachmentList.innerHTML = pendingAttachments.map((att, index) => `
        <div class="attachment-item">
            ${att.type === 'image' ? 
                `<img src="${att.url}" alt="${escapeHtml(att.originalName)}">` :
                att.type === 'video' ?
                `<video src="${att.url}"></video>` :
                `<div class="file-icon">📄</div>`
            }
            <span class="attachment-name">${escapeHtml(att.originalName)}</span>
            <button class="remove-attachment" onclick="removeAttachment(${index})">×</button>
        </div>
    `).join('');
    
    // Clear attachments button
    const clearBtn = attachmentPreview.querySelector('.clear-attachments');
    clearBtn.onclick = () => {
        pendingAttachments = [];
        showAttachmentPreview();
    };
}

function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    showAttachmentPreview();
}

// Media gallery functions
function openMediaGallery() {
    mediaGalleryModal.classList.add('active');
    renderMediaGallery('all');
    
    // Setup tab switching
    const tabs = mediaGalleryModal.querySelectorAll('.media-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderMediaGallery(tab.dataset.type);
        };
    });
    
    // Setup close buttons
    const closeButtons = mediaGalleryModal.querySelectorAll('.close-btn, .modal-overlay');
    closeButtons.forEach(btn => {
        btn.onclick = () => mediaGalleryModal.classList.remove('active');
    });
    
    // Setup select all
    selectAllBtn.onclick = toggleSelectAll;
    
    // Setup download selected
    downloadSelectedBtn.onclick = downloadSelected;
}

function renderMediaGallery(type) {
    const filteredMedia = type === 'all' ? 
        allMediaFiles : 
        allMediaFiles.filter(m => m.type === type || (type === 'files' && m.type !== 'image' && m.type !== 'video'));
    
    mediaGrid.innerHTML = filteredMedia.map((media, index) => `
        <div class="media-item ${selectedMediaFiles.has(media.url) ? 'selected' : ''}" 
             data-url="${media.url}" 
             data-index="${index}">
            <div class="media-checkbox">
                <input type="checkbox" ${selectedMediaFiles.has(media.url) ? 'checked' : ''}>
            </div>
            ${media.type === 'image' ? 
                `<img src="${media.url}" alt="${escapeHtml(media.originalName)}" loading="lazy">` :
                media.type === 'video' ?
                `<video src="${media.url}" preload="metadata"></video>` :
                `<div class="file-preview">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>`
            }
            <div class="media-info">
                <span class="media-name">${escapeHtml(media.originalName)}</span>
                <span class="media-meta">${media.sender} • ${new Date(media.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    mediaGrid.querySelectorAll('.media-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        item.onclick = (e) => {
            if (e.target === checkbox) return;
            
            const url = item.dataset.url;
            const media = filteredMedia[parseInt(item.dataset.index)];
            
            if (media.type === 'image' || media.type === 'video') {
                openMediaViewer(url, media.originalName);
            } else {
                window.open(url, '_blank');
            }
        };
        
        checkbox.onchange = () => {
            const url = item.dataset.url;
            if (checkbox.checked) {
                selectedMediaFiles.add(url);
                item.classList.add('selected');
            } else {
                selectedMediaFiles.delete(url);
                item.classList.remove('selected');
            }
            
            downloadSelectedBtn.disabled = selectedMediaFiles.size === 0;
        };
    });
}

function toggleSelectAll() {
    const items = mediaGrid.querySelectorAll('.media-item');
    const allSelected = selectedMediaFiles.size === items.length;
    
    items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const url = item.dataset.url;
        
        if (allSelected) {
            selectedMediaFiles.delete(url);
            checkbox.checked = false;
            item.classList.remove('selected');
        } else {
            selectedMediaFiles.add(url);
            checkbox.checked = true;
            item.classList.add('selected');
        }
    });
    
    downloadSelectedBtn.disabled = selectedMediaFiles.size === 0;
}

async function downloadSelected() {
    if (selectedMediaFiles.size === 0) return;
    
    const fileUrls = Array.from(selectedMediaFiles);
    
    try {
        const response = await fetch('/api/download/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileUrls })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'media-download.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download files');
    }
}

// Media viewer functions
function openMediaViewer(url, filename) {
    mediaViewerModal.classList.add('active');
    
    const isVideo = url.includes('/videos/');
    
    viewerContent.innerHTML = isVideo ? 
        `<video src="${url}" controls autoplay></video>` :
        `<img src="${url}" alt="${escapeHtml(filename)}">`;
    
    const viewerFilename = mediaViewerModal.querySelector('.viewer-filename');
    viewerFilename.textContent = filename;
    
    // Find current media index
    const mediaUrls = allMediaFiles
        .filter(m => m.type === 'image' || m.type === 'video')
        .map(m => m.url);
    currentViewerIndex = mediaUrls.indexOf(url);
    
    // Setup navigation
    const prevBtn = mediaViewerModal.querySelector('.viewer-nav.prev');
    const nextBtn = mediaViewerModal.querySelector('.viewer-nav.next');
    
    prevBtn.style.display = currentViewerIndex > 0 ? 'block' : 'none';
    nextBtn.style.display = currentViewerIndex < mediaUrls.length - 1 ? 'block' : 'none';
    
    prevBtn.onclick = () => navigateViewer(-1);
    nextBtn.onclick = () => navigateViewer(1);
    
    // Setup close
    const closeButtons = mediaViewerModal.querySelectorAll('.viewer-close, .modal-overlay');
    closeButtons.forEach(btn => {
        btn.onclick = () => mediaViewerModal.classList.remove('active');
    });
    
    // Setup download
    const downloadBtn = mediaViewerModal.querySelector('.viewer-download');
    downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    
    // Keyboard navigation
    document.onkeydown = (e) => {
        if (!mediaViewerModal.classList.contains('active')) return;
        
        if (e.key === 'ArrowLeft') navigateViewer(-1);
        else if (e.key === 'ArrowRight') navigateViewer(1);
        else if (e.key === 'Escape') mediaViewerModal.classList.remove('active');
    };
}

function navigateViewer(direction) {
    const mediaFiles = allMediaFiles.filter(m => m.type === 'image' || m.type === 'video');
    currentViewerIndex += direction;
    
    if (currentViewerIndex < 0 || currentViewerIndex >= mediaFiles.length) return;
    
    const media = mediaFiles[currentViewerIndex];
    openMediaViewer(media.url, media.originalName);
}

// Room management functions
function updateRoomInfo() {
    if (currentRoomInfo) {
        currentRoomName.textContent = currentRoomInfo.name;
        
        // Show announcement if exists
        if (currentRoomInfo.announcement) {
            roomAnnouncement.textContent = currentRoomInfo.announcement;
            roomAnnouncement.style.display = 'block';
        } else {
            roomAnnouncement.style.display = 'none';
        }
        
        // Show room settings button if user is room owner
        if (currentRoomInfo.createdBy === currentUsername) {
            roomSettingsBtn.style.display = 'flex';
        } else {
            roomSettingsBtn.style.display = 'none';
        }
    }
    
    // Update UI state based on current room and auth status
    updateUIBasedOnAuthState();
}

function updateRoomsList() {
    roomsList.innerHTML = '';
    
    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = `room-item ${room.id === currentRoomId ? 'active' : ''}`;
        roomDiv.dataset.roomId = room.id;
        
        let roomHtml = `
            <div class="room-name">${escapeHtml(room.name)}</div>
        `;
        
        if (room.description) {
            roomHtml += `<div class="room-description">${escapeHtml(room.description)}</div>`;
        }
        
        roomHtml += `<div class="room-users">${room.userCount}/${room.maxUsers} users</div>`;
        
        if (room.createdBy === currentUsername) {
            roomHtml += `<div class="room-owner-badge" title="You own this room">★</div>`;
        }
        
        roomDiv.innerHTML = roomHtml;
        roomDiv.addEventListener('click', () => switchRoom(room.id));
        
        roomsList.appendChild(roomDiv);
    });
}

function switchRoom(roomId) {
    if (roomId === currentRoomId) return;
    
    socket.emit('switch-room', roomId);
}

function openCreateRoomModal() {
    // Check if user is authenticated before allowing room creation
    if (!currentUsername || currentUsername.trim() === '') {
        console.error('Room creation attempted without valid username');
        alert('Error: You must be logged in to create a room. Please refresh the page and log in again.');
        return;
    }
    
    console.log('Opening room creation modal for user:', currentUsername);
    createRoomModal.classList.add('active');
    roomNameInput.value = '';
    roomDescriptionInput.value = '';
    roomMaxUsersInput.value = 20;
    roomNameInput.focus();
}

function closeCreateRoomModal() {
    createRoomModal.classList.remove('active');
}

async function createRoom() {
    // Validate authentication state before proceeding
    if (!currentUsername || currentUsername.trim() === '') {
        console.error('Room creation attempted without valid username');
        alert('Error: You must be logged in to create a room. Please refresh the page and log in again.');
        return;
    }
    
    const name = roomNameInput.value.trim();
    const description = roomDescriptionInput.value.trim();
    const maxUsers = parseInt(roomMaxUsersInput.value) || 20;
    
    if (!name) {
        alert('Room name is required');
        return;
    }
    
    if (name.length > 30) {
        alert('Room name is too long (maximum 30 characters)');
        return;
    }
    
    console.log('Creating room:', { name, description, maxUsers, username: currentUsername });
    
    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Username': encodeURIComponent(currentUsername)
            },
            body: JSON.stringify({ name, description, maxUsers })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('Room created successfully:', result);
            closeCreateRoomModal();
            // Switch to the new room
            switchRoom(result.roomId);
        } else {
            console.error('Room creation failed:', result.error);
            alert(result.error || 'Failed to create room');
        }
    } catch (error) {
        console.error('Create room error:', error);
        alert('Failed to create room. Please check your connection and try again.');
    }
}

function openRoomSettings() {
    roomSettingsModal.classList.add('active');
    roomAnnouncementInput.value = currentRoomInfo?.announcement || '';
    
    // Show delete option only for room owner and non-default rooms
    if (currentRoomInfo?.createdBy === currentUsername && currentRoomId !== 'general') {
        deleteRoomSection.style.display = 'block';
    } else {
        deleteRoomSection.style.display = 'none';
    }
}

function closeRoomSettings() {
    roomSettingsModal.classList.remove('active');
}

async function saveRoomSettings() {
    const announcement = roomAnnouncementInput.value.trim();
    
    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/announcement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Username': encodeURIComponent(currentUsername)
            },
            body: JSON.stringify({ announcement })
        });
        
        if (response.ok) {
            closeRoomSettings();
        } else {
            const result = await response.json();
            alert(result.error || 'Failed to update announcement');
        }
    } catch (error) {
        console.error('Update announcement error:', error);
        alert('Failed to update announcement');
    }
}

async function deleteRoom() {
    if (!confirm('Are you sure you want to delete this room? All users will be moved to the General room.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/rooms/${currentRoomId}`, {
            method: 'DELETE',
            headers: {
                'X-Username': encodeURIComponent(currentUsername)
            }
        });
        
        if (response.ok) {
            closeRoomSettings();
        } else {
            const result = await response.json();
            alert(result.error || 'Failed to delete room');
        }
    } catch (error) {
        console.error('Delete room error:', error);
        alert('Failed to delete room');
    }
}

// Function to update UI based on authentication state
function updateUIBasedOnAuthState() {
    const isAuthenticated = currentUsername && currentUsername.trim() !== '';
    
    console.log('Updating UI based on auth state. Authenticated:', isAuthenticated, 'Username:', currentUsername);
    
    // Disable/enable room creation button
    if (createRoomBtn) {
        createRoomBtn.disabled = !isAuthenticated;
        createRoomBtn.title = isAuthenticated ? 
            'Create a new room' : 
            'You must be logged in to create rooms';
    }
    
    // Disable/enable room settings button
    if (roomSettingsBtn) {
        // Room settings should only be enabled if user is authenticated AND is room owner
        const isRoomOwner = currentRoomInfo && currentRoomInfo.createdBy === currentUsername;
        roomSettingsBtn.disabled = !isAuthenticated || !isRoomOwner;
    }
}

// Make functions globally accessible
window.openMediaViewer = openMediaViewer;
window.removeAttachment = removeAttachment;
window.updateUIBasedOnAuthState = updateUIBasedOnAuthState;

// Socket Event Handlers
socket.on('join-success', (data) => {
    console.log('Join success received:', data);
    
    currentUsername = data.username;
    sessionId = data.sessionId;
    currentRoomId = data.roomId;
    currentRoomInfo = data.roomInfo;
    activeUsers = data.activeUsers;
    rooms = data.rooms || [];
    
    console.log('Authentication state updated:', {
        currentUsername,
        sessionId,
        currentRoomId
    });
    
    // Save session to localStorage
    if (sessionId) {
        localStorage.setItem('sessionId', sessionId);
    }
    
    // Find current user's profile
    const currentUserData = activeUsers.find(u => u.username === currentUsername);
    if (currentUserData) {
        currentProfile = {
            profilePhoto: currentUserData.profilePhoto,
            bio: currentUserData.bio
        };
    }
    
    // Switch screens
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');
    
    // Update UI
    currentUserSpan.textContent = i18n.t('loggedInAs') + ': ' + currentUsername;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
    
    // Update room info
    updateRoomInfo();
    updateRoomsList();
    
    // Update UI based on authentication state
    updateUIBasedOnAuthState();
    
    // Clear messages and display history
    messagesContainer.innerHTML = '';
    allMediaFiles = [];
    data.messageHistory.forEach(msg => {
        displayMessage(msg, msg.username === currentUsername);
    });
    
    // Update users list
    updateUsersList();
    
    // Show welcome message
    displaySystemMessage(i18n.t('welcomeMessage', { username: currentUsername }));
});

socket.on('join-error', (error) => {
    console.error('Join error received:', error);
    
    // Clear currentUsername on join error to prevent inconsistent state
    currentUsername = '';
    sessionId = null;
    updateUIBasedOnAuthState();
    
    if (error === 'Username already taken') {
        showError(i18n.t('usernameTaken'));
    } else {
        showError(error);
    }
});

socket.on('user-joined', (data) => {
    activeUsers = data.activeUsers;
    updateUsersList();
    displaySystemMessage(i18n.t('userJoined', { username: data.username }));
});

socket.on('user-left', (data) => {
    activeUsers = data.activeUsers;
    updateUsersList();
    displaySystemMessage(i18n.t('userLeft', { username: data.username }));
});

socket.on('new-message', (messageData) => {
    displayMessage(messageData, messageData.username === currentUsername);
});

socket.on('read-receipts-updated', (updates) => {
    updates.forEach(update => {
        // Update read count in UI
        const messageEl = document.querySelector(`[data-message-id="${update.id}"]`);
        if (messageEl && messageEl.classList.contains('own')) {
            const readCountEl = messageEl.querySelector('.read-count');
            if (readCountEl) {
                const totalUsers = usersList.children.length;
                const unreadCount = Math.max(0, totalUsers - update.readCount);
                readCountEl.textContent = unreadCount > 0 ? `${unreadCount} unread` : '✓✓ All read';
                readCountEl.title = `${unreadCount} unread`;
            }
        }
        
        // Update our local store
        messageReadCounts.set(update.id, update.readCount);
    });
});

socket.on('user-typing-update', (data) => {
    activeUsers = data.activeUsers;
    updateUsersList();
    updateTypingIndicator();
});

socket.on('profile-updated', (data) => {
    // Update specific user in active users list
    const userIndex = activeUsers.findIndex(u => u.username === data.username);
    if (userIndex !== -1) {
        activeUsers[userIndex] = {
            ...activeUsers[userIndex],
            profilePhoto: data.profilePhoto,
            bio: data.bio
        };
    }
    updateUsersList();
    
    // Update current profile if it's our own
    if (data.username === currentUsername) {
        currentProfile = {
            profilePhoto: data.profilePhoto,
            bio: data.bio
        };
    }
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
    displaySystemMessage(i18n.t('disconnected'));
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Update UI state on disconnect
    updateUIBasedOnAuthState();
});

socket.on('connect', () => {
    console.log('Socket connected');
    
    if (currentUsername) {
        console.log('Reconnecting with existing credentials:', {
            username: currentUsername,
            sessionId,
            roomId: currentRoomId
        });
        
        displaySystemMessage(i18n.t('reconnected'));
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        // Rejoin with the same username and session
        socket.emit('join', {
            username: currentUsername,
            sessionId: sessionId,
            roomId: currentRoomId
        });
    }
    
    // Update UI state on connect
    updateUIBasedOnAuthState();
});

// Room-related socket events
socket.on('room-switched', (data) => {
    console.log('Room switched:', data);
    
    currentRoomId = data.roomId;
    currentRoomInfo = data.roomInfo;
    activeUsers = data.activeUsers;
    
    // Update room info
    updateRoomInfo();
    updateRoomsList();
    
    // Clear messages and display new room's history
    messagesContainer.innerHTML = '';
    allMediaFiles = [];
    data.messageHistory.forEach(msg => {
        displayMessage(msg, msg.username === currentUsername);
    });
    
    // Update users list
    updateUsersList();
    
    // Update UI state after room switch
    updateUIBasedOnAuthState();
    
    displaySystemMessage(`Switched to room: ${data.roomInfo.name}`);
});

socket.on('switch-room-error', (error) => {
    alert(error);
});

socket.on('room-created', (room) => {
    rooms.push(room);
    updateRoomsList();
});

socket.on('room-removed', (data) => {
    rooms = rooms.filter(r => r.id !== data.roomId);
    updateRoomsList();
});

socket.on('room-deleted', (data) => {
    if (currentRoomId === data.deletedRoomId) {
        currentRoomId = data.newRoomId;
        displaySystemMessage('This room has been deleted. You have been moved to the General room.');
    }
});

socket.on('room-list-updated', (roomList) => {
    rooms = roomList;
    updateRoomsList();
});

socket.on('announcement-updated', (data) => {
    if (data.roomId === currentRoomId) {
        currentRoomInfo.announcement = data.announcement;
        updateRoomInfo();
    }
});

// Initialize the app
init();

// Debug function to check authentication state
function debugAuthState() {
    console.log('Current authentication state:', {
        currentUsername,
        sessionId,
        currentRoomId,
        loginScreenActive: loginScreen.classList.contains('active'),
        chatScreenActive: chatScreen.classList.contains('active'),
        createRoomBtnDisabled: createRoomBtn?.disabled
    });
}

// Make debug function available globally for debugging
window.debugAuthState = debugAuthState;