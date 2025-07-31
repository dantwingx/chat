const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const archiver = require('archiver');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    maxHttpBufferSize: 10e7 // 100MB max for file uploads via socket
});

// Security middleware
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    next();
});

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Create media subdirectories
const mediaTypes = ['images', 'videos', 'files'];
mediaTypes.forEach(type => {
    fs.mkdir(path.join(uploadsDir, type), { recursive: true }).catch(console.error);
});


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subDir = 'files';
        const mimetype = file.mimetype.toLowerCase();
        
        if (mimetype.startsWith('image/')) {
            subDir = 'images';
        } else if (mimetype.startsWith('video/')) {
            subDir = 'videos';
        }
        
        cb(null, path.join(uploadsDir, subDir));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        // Validate extension
        const allowedExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.webp',
            '.mp4', '.webm', '.mov',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.txt', '.zip'
        ];
        
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error('Invalid file extension'));
        }
        
        // Create safe filename with only alphanumeric, dash, underscore
        const baseName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .substring(0, 50); // Limit filename length
        
        cb(null, `${uuidv4()}_${baseName}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images, videos, and common document types
        const allowedMimetypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/quicktime',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'application/zip', 'application/x-zip-compressed'
        ];
        
        if (allowedMimetypes.includes(file.mimetype.toLowerCase())) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    }
});

// In-memory storage
const users = new Map(); // socketId -> { username, isTyping, profilePhoto, bio, roomId, sessionId }
const userProfiles = new Map(); // username -> { profilePhoto, bio }
const rooms = new Map(); // roomId -> { id, name, description, maxUsers, createdBy, createdAt, messages[], users: Set }
const sessions = new Map(); // sessionId -> { username, roomId, createdAt }
const messageReadReceipts = new Map(); // messageId -> Set of usernames who read it
const MAX_MESSAGES_PER_ROOM = 100;

// Default room
const DEFAULT_ROOM_ID = 'general';
const DEFAULT_ROOM = {
    id: DEFAULT_ROOM_ID,
    name: 'General',
    description: 'Main chat room for everyone',
    maxUsers: 50,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    messages: [],
    users: new Set(),
    announcement: ''
};
rooms.set(DEFAULT_ROOM_ID, DEFAULT_ROOM);

// Rate limiting for uploads
const uploadRateLimit = new Map(); // IP -> { count, resetTime }
const UPLOAD_RATE_LIMIT = 10; // Max uploads per window
const UPLOAD_RATE_WINDOW = 60 * 1000; // 1 minute window

// Helper functions
function generateSessionId() {
    return uuidv4();
}

function decodeUsername(username) {
    if (!username) return username;
    
    try {
        // Try to decode URI component, fallback to original if it fails
        return decodeURIComponent(username);
    } catch (error) {
        // If decoding fails, return original value for backward compatibility
        console.log('Failed to decode username, using original:', username);
        return username;
    }
}

function getActiveUsersInRoom(roomId) {
    return Array.from(users.values())
        .filter(user => user.roomId === roomId)
        .map(user => ({
            username: user.username,
            isTyping: user.isTyping,
            profilePhoto: user.profilePhoto,
            bio: user.bio
        }));
}

function getRoomList() {
    return Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        userCount: room.users.size,
        maxUsers: room.maxUsers,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        hasAnnouncement: !!room.announcement
    }));
}

function cleanupExpiredSessions() {
    const now = Date.now();
    const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [sessionId, session] of sessions.entries()) {
        if (now - new Date(session.createdAt).getTime() > SESSION_EXPIRY) {
            sessions.delete(sessionId);
        }
    }
}

// Rate limiting middleware
function checkUploadRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    let rateInfo = uploadRateLimit.get(ip);
    
    if (!rateInfo || now > rateInfo.resetTime) {
        rateInfo = { count: 0, resetTime: now + UPLOAD_RATE_WINDOW };
        uploadRateLimit.set(ip, rateInfo);
    }
    
    if (rateInfo.count >= UPLOAD_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many uploads. Please try again later.' });
    }
    
    rateInfo.count++;
    next();
}

// API endpoint for media uploads
app.post('/api/upload/media', checkUploadRateLimit, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = req.files.map(file => {
            const type = file.mimetype.startsWith('image/') ? 'image' : 
                         file.mimetype.startsWith('video/') ? 'video' : 'file';
            
            return {
                id: uuidv4(),
                filename: file.filename,
                originalName: file.originalname,
                type: type,
                mimetype: file.mimetype,
                size: file.size,
                url: `/uploads/${type}s/${file.filename}`
            };
        });

        res.json({ success: true, files: uploadedFiles });
    } catch (error) {
        console.error('Media upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// API endpoint for session validation
app.post('/api/session/validate', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }
        
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(401).json({ error: 'Invalid session' });
        }
        
        // Get user profile
        const profile = userProfiles.get(session.username) || { profilePhoto: null, bio: '' };
        
        res.json({
            success: true,
            username: session.username,
            roomId: session.roomId || DEFAULT_ROOM_ID,
            profile
        });
    } catch (error) {
        console.error('Session validation error:', error);
        res.status(500).json({ error: 'Session validation failed' });
    }
});

// API endpoint for room management
app.get('/api/rooms', (req, res) => {
    res.json({ success: true, rooms: getRoomList() });
});

app.post('/api/rooms', (req, res) => {
    try {
        const { name, description, maxUsers } = req.body;
        const username = decodeUsername(req.headers['x-username']); // Decode the username from client
        
        console.log('Room creation request:', { name, description, maxUsers, username });
        
        // Enhanced validation
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.error('Invalid room name provided:', name);
            return res.status(400).json({ error: 'Valid room name is required' });
        }
        
        if (!username || typeof username !== 'string' || username.trim() === '') {
            console.error('Invalid username provided:', username);
            return res.status(400).json({ error: 'Valid username is required. Please refresh the page and log in again.' });
        }
        
        // Verify the user is actually logged in (exists in our users map)
        const userExists = Array.from(users.values()).some(u => u.username === username.trim());
        if (!userExists) {
            console.error('User not found in active users:', username);
            return res.status(401).json({ error: 'User authentication required. Please refresh the page and log in again.' });
        }
        
        // Validate room name length
        const trimmedName = name.trim();
        if (trimmedName.length > 30) {
            console.error('Room name too long:', trimmedName.length);
            return res.status(400).json({ error: 'Room name too long (max 30 characters)' });
        }
        
        if (trimmedName.length < 1) {
            console.error('Room name too short');
            return res.status(400).json({ error: 'Room name cannot be empty' });
        }
        
        // Check if room name already exists
        const existingRoom = Array.from(rooms.values()).find(r => r.name.toLowerCase() === trimmedName.toLowerCase());
        if (existingRoom) {
            console.error('Room name already exists:', trimmedName);
            return res.status(400).json({ error: 'Room name already exists' });
        }
        
        const roomId = uuidv4();
        const room = {
            id: roomId,
            name: trimmedName,
            description: description?.trim() || '',
            maxUsers: Math.min(Math.max(2, maxUsers || 20), 100), // Between 2 and 100
            createdBy: username.trim(),
            createdAt: new Date().toISOString(),
            messages: [],
            users: new Set(),
            announcement: ''
        };
        
        console.log('Creating room:', room);
        
        rooms.set(roomId, room);
        
        // Notify all users about new room
        io.emit('room-created', {
            id: room.id,
            name: room.name,
            description: room.description,
            userCount: 0,
            maxUsers: room.maxUsers,
            createdBy: room.createdBy,
            createdAt: room.createdAt
        });
        
        console.log('Room created successfully:', roomId);
        res.json({ success: true, roomId });
    } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).json({ error: 'Room creation failed. Please try again.' });
    }
});

app.delete('/api/rooms/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        const username = decodeUsername(req.headers['x-username']);
        
        console.log('Room deletion request:', { roomId, username });
        
        if (!username || typeof username !== 'string' || username.trim() === '') {
            console.error('Invalid username for room deletion:', username);
            return res.status(400).json({ error: 'Valid username is required. Please refresh the page and log in again.' });
        }
        
        // Verify the user is actually logged in
        const userExists = Array.from(users.values()).some(u => u.username === username.trim());
        if (!userExists) {
            console.error('User not found for room deletion:', username);
            return res.status(401).json({ error: 'User authentication required. Please refresh the page and log in again.' });
        }
        
        if (roomId === DEFAULT_ROOM_ID) {
            console.error('Attempt to delete default room');
            return res.status(400).json({ error: 'Cannot delete default room' });
        }
        
        const room = rooms.get(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.createdBy !== username) {
            return res.status(403).json({ error: 'Only room creator can delete the room' });
        }
        
        // Move all users in the room to default room
        for (const [socketId, user] of users.entries()) {
            if (user.roomId === roomId) {
                user.roomId = DEFAULT_ROOM_ID;
                const defaultRoom = rooms.get(DEFAULT_ROOM_ID);
                defaultRoom.users.add(user.username);
                room.users.delete(user.username);
                
                // Notify user they've been moved
                io.to(socketId).emit('room-deleted', {
                    deletedRoomId: roomId,
                    newRoomId: DEFAULT_ROOM_ID
                });
            }
        }
        
        rooms.delete(roomId);
        
        // Notify all users
        io.emit('room-removed', { roomId });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Room deletion error:', error);
        res.status(500).json({ error: 'Room deletion failed' });
    }
});

app.post('/api/rooms/:roomId/announcement', (req, res) => {
    try {
        const { roomId } = req.params;
        const { announcement } = req.body;
        const username = decodeUsername(req.headers['x-username']);
        
        console.log('Announcement update request:', { roomId, username, announcement });
        
        if (!username || typeof username !== 'string' || username.trim() === '') {
            console.error('Invalid username for announcement update:', username);
            return res.status(400).json({ error: 'Valid username is required. Please refresh the page and log in again.' });
        }
        
        // Verify the user is actually logged in
        const userExists = Array.from(users.values()).some(u => u.username === username.trim());
        if (!userExists) {
            console.error('User not found for announcement update:', username);
            return res.status(401).json({ error: 'User authentication required. Please refresh the page and log in again.' });
        }
        
        const room = rooms.get(roomId);
        if (!room) {
            console.error('Room not found for announcement update:', roomId);
            return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.createdBy !== username) {
            return res.status(403).json({ error: 'Only room creator can set announcements' });
        }
        
        room.announcement = announcement?.trim() || '';
        
        // Notify all users in the room
        io.to(roomId).emit('announcement-updated', {
            roomId,
            announcement: room.announcement
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Announcement update error:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// API endpoint for bulk download
app.post('/api/download/bulk', async (req, res) => {
    try {
        const { fileUrls } = req.body;
        
        if (!fileUrls || fileUrls.length === 0) {
            return res.status(400).json({ error: 'No files specified' });
        }

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        res.attachment('media-download.zip');
        archive.pipe(res);

        for (const fileUrl of fileUrls) {
            // Validate URL format and prevent path traversal
            if (!fileUrl.startsWith('/uploads/') || fileUrl.includes('..')) {
                console.error(`Invalid file URL: ${fileUrl}`);
                continue;
            }
            
            const filePath = path.join(__dirname, 'public', fileUrl);
            const resolvedPath = path.resolve(filePath);
            const allowedBasePath = path.resolve(path.join(__dirname, 'public', 'uploads'));
            
            // Ensure the resolved path is within the uploads directory
            if (!resolvedPath.startsWith(allowedBasePath)) {
                console.error(`Path traversal attempt detected: ${fileUrl}`);
                continue;
            }
            
            const filename = path.basename(fileUrl);
            
            try {
                await fs.access(resolvedPath);
                archive.file(resolvedPath, { name: filename });
            } catch (err) {
                console.error(`File not found: ${resolvedPath}`);
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Bulk download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// REST API endpoint for profile updates
app.post('/api/profile/update', checkUploadRateLimit, upload.single('profilePhoto'), async (req, res) => {
    try {
        const { username, bio, existingPhoto } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        let profilePhoto = existingPhoto || null;
        
        // If a new photo was uploaded
        if (req.file) {
            // Determine the subdirectory based on file type
            const type = req.file.mimetype.startsWith('image/') ? 'images' : 
                         req.file.mimetype.startsWith('video/') ? 'videos' : 'files';
            
            // Create the correct URL path with subdirectory
            profilePhoto = `/uploads/${type}/${req.file.filename}`;
            
            // Delete old photo if exists and different from new one
            const oldProfile = userProfiles.get(username);
            if (oldProfile?.profilePhoto && oldProfile.profilePhoto !== profilePhoto) {
                try {
                    // Validate that the old photo path is within uploads directory
                    if (oldProfile.profilePhoto.startsWith('/uploads/')) {
                        // Build the correct physical path for the old photo
                        // Remove leading slash to create relative path
                        const oldPhotoPath = oldProfile.profilePhoto.startsWith('/') 
                            ? oldProfile.profilePhoto.substring(1) 
                            : oldProfile.profilePhoto;
                        const oldPath = path.join(__dirname, 'public', oldPhotoPath);
                        const resolvedOldPath = path.resolve(oldPath);
                        const allowedBasePath = path.resolve(path.join(__dirname, 'public', 'uploads'));
                        
                        // Ensure the resolved path is within the uploads directory (prevent path traversal)
                        if (resolvedOldPath.startsWith(allowedBasePath)) {
                            // Check if file exists before attempting to delete
                            await fs.access(resolvedOldPath);
                            await fs.unlink(resolvedOldPath);
                            console.log(`Deleted old profile photo: ${resolvedOldPath}`);
                        } else {
                            console.error('Path traversal attempt detected in profile photo deletion');
                        }
                    }
                } catch (err) {
                    // Only log error if it's not a "file not found" error
                    if (err.code !== 'ENOENT') {
                        console.error('Error deleting old photo:', err);
                    }
                }
            }
        }

        // Update user profile
        const profile = {
            profilePhoto,
            bio: bio || ''
        };
        
        userProfiles.set(username, profile);
        
        // Update active user if they're online
        for (const [socketId, user] of users.entries()) {
            if (user.username === username) {
                users.set(socketId, { ...user, profilePhoto: profile.profilePhoto, bio: profile.bio });
                break;
            }
        }
        
        // Notify all users about the profile update
        io.emit('profile-updated', {
            username,
            ...profile
        });
        
        res.json({ success: true, ...profile });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Add error handling for socket
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  // Handle user join
  socket.on('join', (data) => {
    let username, sessionId, roomId;
    
    // Handle both string and object data formats for backward compatibility
    if (typeof data === 'string') {
      username = data;
      roomId = DEFAULT_ROOM_ID;
    } else if (typeof data === 'object' && data !== null) {
      username = data.username;
      sessionId = data.sessionId;
      roomId = data.roomId || DEFAULT_ROOM_ID;
    } else {
      socket.emit('join-error', 'Invalid join data');
      return;
    }
    
    // Validate username
    if (!username || typeof username !== 'string') {
      socket.emit('join-error', 'Invalid username');
      return;
    }
    
    username = username.trim();
    
    if (username.length === 0) {
      socket.emit('join-error', 'Username cannot be empty');
      return;
    }
    
    if (username.length > 20) {
      socket.emit('join-error', 'Username too long (max 20 characters)');
      return;
    }
    
    // Check if username is already taken by another socket
    const existingUser = Array.from(users.values()).find(u => u.username === username && u.sessionId !== sessionId);
    if (existingUser) {
      socket.emit('join-error', 'Username already taken');
      return;
    }
    
    // Check if room exists
    const room = rooms.get(roomId);
    if (!room) {
      roomId = DEFAULT_ROOM_ID;
    }
    
    // Check room capacity
    if (room && room.users.size >= room.maxUsers) {
      socket.emit('join-error', 'Room is full');
      return;
    }

    // Get existing profile if available
    const profile = userProfiles.get(username) || { profilePhoto: null, bio: '' };
    
    // Generate session if not provided
    if (!sessionId) {
      sessionId = generateSessionId();
    }
    
    // Save/update session
    sessions.set(sessionId, {
      username,
      roomId,
      createdAt: new Date().toISOString()
    });

    // Add user to the users map
    users.set(socket.id, { 
      username, 
      isTyping: false, 
      ...profile,
      roomId,
      sessionId 
    });
    
    // Add user to room
    room.users.add(username);
    socket.join(roomId);
    
    // Prepare room message history with read receipts
    const messagesWithReceipts = room.messages.map(msg => {
      const readSet = messageReadReceipts.get(msg.id) || new Set();
      return {
        ...msg,
        readBy: Array.from(readSet),
        readCount: readSet.size
      };
    });

    // Send success response to the joining user
    socket.emit('join-success', {
      username,
      sessionId,
      roomId,
      roomInfo: {
        id: room.id,
        name: room.name,
        description: room.description,
        announcement: room.announcement,
        createdBy: room.createdBy
      },
      messageHistory: messagesWithReceipts,
      activeUsers: getActiveUsersInRoom(roomId),
      rooms: getRoomList()
    });
    
    // Also emit 'joined' for backward compatibility with tests
    socket.emit('joined', {
      username,
      activeUsers: getActiveUsersInRoom(roomId)
    });

    // Notify all other users in the room about the new user
    socket.to(roomId).emit('user-joined', {
      username,
      activeUsers: getActiveUsersInRoom(roomId)
    });
    
    // Notify all users about updated room list
    io.emit('room-list-updated', getRoomList());

    console.log(`User ${username} joined room ${room.name}`);
  });

  // Handle chat messages with media
  socket.on('chat-message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    // Handle both string and object message formats
    let message = '';
    let attachments = [];
    
    if (typeof data === 'string') {
      // Simple string message
      message = data;
    } else if (typeof data === 'object' && data !== null) {
      // Object with message and attachments
      message = data.message || '';
      attachments = data.attachments || [];
    } else {
      // Invalid message format
      console.error('Invalid message format:', data);
      return;
    }

    const messageData = {
      id: uuidv4(),
      username: user.username,
      message: message,
      timestamp: new Date().toISOString(),
      profilePhoto: user.profilePhoto,
      attachments: attachments,
      readBy: new Set([user.username]) // Message is read by sender
    };

    // Add to room's message history
    room.messages.push(messageData);
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      const removedMessage = room.messages.shift();
      messageReadReceipts.delete(removedMessage.id);
    }

    // Initialize read receipts for this message
    messageReadReceipts.set(messageData.id, new Set([user.username]));

    // Broadcast message to all clients in the room (including sender)
    const messageToSend = {
      ...messageData,
      readBy: Array.from(messageData.readBy),
      readCount: messageData.readBy.size
    };
    
    io.to(user.roomId).emit('new-message', messageToSend);
    
    // Also emit 'chat-message' for backward compatibility with tests
    io.to(user.roomId).emit('chat-message', {
      id: messageData.id,
      username: messageData.username,
      message: messageData.message,
      timestamp: messageData.timestamp
    });
  });

  // Handle message read receipts
  socket.on('mark-messages-read', (messageIds) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    // Validate messageIds
    if (!Array.isArray(messageIds)) {
      console.error('Invalid messageIds format');
      return;
    }

    const room = rooms.get(user.roomId);
    if (!room) return;

    const updatedMessages = [];

    messageIds.forEach(messageId => {
      const readSet = messageReadReceipts.get(messageId);
      if (readSet && !readSet.has(user.username)) {
        readSet.add(user.username);
        
        // Find message in room's message history to get full data
        const message = room.messages.find(m => m.id === messageId);
        if (message) {
          updatedMessages.push({
            id: messageId,
            readBy: Array.from(readSet),
            readCount: readSet.size
          });
        }
      }
    });

    // Notify all users about read receipt updates
    if (updatedMessages.length > 0) {
      io.emit('read-receipts-updated', updatedMessages);
    }
  });

  // Handle room switching
  socket.on('switch-room', (newRoomId) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const newRoom = rooms.get(newRoomId);
    if (!newRoom) {
      socket.emit('switch-room-error', 'Room not found');
      return;
    }
    
    // Check room capacity
    if (newRoom.users.size >= newRoom.maxUsers && !newRoom.users.has(user.username)) {
      socket.emit('switch-room-error', 'Room is full');
      return;
    }
    
    const oldRoomId = user.roomId;
    const oldRoom = rooms.get(oldRoomId);
    
    // Leave old room
    if (oldRoom) {
      oldRoom.users.delete(user.username);
      socket.leave(oldRoomId);
      
      // Notify users in old room
      socket.to(oldRoomId).emit('user-left', {
        username: user.username,
        activeUsers: getActiveUsersInRoom(oldRoomId)
      });
    }
    
    // Join new room
    user.roomId = newRoomId;
    newRoom.users.add(user.username);
    socket.join(newRoomId);
    
    // Update session
    const session = sessions.get(user.sessionId);
    if (session) {
      session.roomId = newRoomId;
    }
    
    // Prepare room message history
    const messagesWithReceipts = newRoom.messages.map(msg => {
      const readSet = messageReadReceipts.get(msg.id) || new Set();
      return {
        ...msg,
        readBy: Array.from(readSet),
        readCount: readSet.size
      };
    });
    
    // Send room data to user
    socket.emit('room-switched', {
      roomId: newRoomId,
      roomInfo: {
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        announcement: newRoom.announcement,
        createdBy: newRoom.createdBy
      },
      messageHistory: messagesWithReceipts,
      activeUsers: getActiveUsersInRoom(newRoomId)
    });
    
    // Notify users in new room
    socket.to(newRoomId).emit('user-joined', {
      username: user.username,
      activeUsers: getActiveUsersInRoom(newRoomId)
    });
    
    // Update room list for all users
    io.emit('room-list-updated', getRoomList());
    
    console.log(`User ${user.username} switched from room ${oldRoom?.name} to ${newRoom.name}`);
  });

  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = users.get(socket.id);
    if (!user) return;

    user.isTyping = true;
    socket.to(user.roomId).emit('user-typing-update', {
      username: user.username,
      isTyping: true,
      activeUsers: getActiveUsersInRoom(user.roomId)
    });
  });

  socket.on('typing-stop', () => {
    const user = users.get(socket.id);
    if (!user) return;

    user.isTyping = false;
    socket.to(user.roomId).emit('user-typing-update', {
      username: user.username,
      isTyping: false,
      activeUsers: getActiveUsersInRoom(user.roomId)
    });
  });

  // Handle logout
  socket.on('logout', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.users.delete(user.username);
        socket.leave(user.roomId);
        
        // Notify other users in the room
        socket.to(user.roomId).emit('user-left', {
          username: user.username,
          activeUsers: getActiveUsersInRoom(user.roomId)
        });
      }
      
      users.delete(socket.id);
      
      // Update room list for all users
      io.emit('room-list-updated', getRoomList());

      console.log(`User ${user.username} logged out`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.users.delete(user.username);
        
        // Notify other users in the room
        socket.to(user.roomId).emit('user-left', {
          username: user.username,
          activeUsers: getActiveUsersInRoom(user.roomId)
        });
      }
      
      users.delete(socket.id);
      
      // Update room list for all users
      io.emit('room-list-updated', getRoomList());

      console.log(`User ${user.username} disconnected`);
    }
  });
});

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, rateInfo] of uploadRateLimit.entries()) {
        if (now > rateInfo.resetTime + UPLOAD_RATE_WINDOW) {
            uploadRateLimit.delete(ip);
        }
    }
}, UPLOAD_RATE_WINDOW);

// Clean up expired sessions periodically
setInterval(() => {
    cleanupExpiredSessions();
}, 60 * 60 * 1000); // Every hour

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
