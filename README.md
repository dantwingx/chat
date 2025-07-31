# Multi-User Chat Application

A simple real-time multi-user chat application built with Node.js, Express, and Socket.io.

## Features

- Real-time messaging between multiple users
- Username-based system (no authentication required)
- Active user list with online status
- Message history (last 100 messages)
- Typing indicators
- Clean and responsive UI
- Automatic reconnection handling

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone or download this project to your local machine

2. Navigate to the project directory:
   ```bash
   cd /Users/aladdin/Documents/claude/chat
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Enter a username and start chatting!

## Usage

1. **Join the chat**: Enter a unique username (up to 20 characters) and click "Join Chat"
2. **Send messages**: Type your message and press Enter or click Send
3. **View active users**: See who's online in the sidebar (desktop view)
4. **Typing indicators**: See when other users are typing
5. **Message history**: New users can see the last 100 messages

## Technical Details

### Backend
- **Express**: Web server framework
- **Socket.io**: WebSocket library for real-time communication
- **In-memory storage**: Messages and user data stored in memory (resets on server restart)

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Socket.io Client**: For WebSocket communication
- **Responsive CSS**: Mobile-friendly design

### Key Files
- `server.js`: Main server file with Socket.io event handlers
- `public/index.html`: HTML structure
- `public/styles.css`: Styling and animations
- `public/chat.js`: Client-side JavaScript logic

## Features in Detail

### Real-time Messaging
- Messages are instantly broadcast to all connected users
- Each message includes username and timestamp

### User Management
- Usernames must be unique
- Users see a list of all active participants
- Join/leave notifications for all users

### Typing Indicators
- Shows when users are typing
- Automatically clears after 1 second of inactivity

### Message History
- Stores last 100 messages in memory
- New users can see previous conversation context

## Limitations (MVP)

- No persistent storage (messages lost on server restart)
- No authentication or user accounts
- No private messaging
- No file sharing
- No message editing or deletion

## Future Enhancements

- Add database for persistent storage
- Implement user authentication
- Add private messaging/rooms
- Support file and image sharing
- Add message reactions/emojis
- Implement message search
- Add notification sounds
- Create mobile apps

## Troubleshooting

1. **Port already in use**: Change the port in `server.js` or set PORT environment variable
2. **Cannot connect**: Ensure the server is running and check firewall settings
3. **Username taken**: Choose a different username or restart the server to clear users

## License

MIT