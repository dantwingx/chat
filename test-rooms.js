const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';
let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ ${name}: ${error.message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('🧪 Testing Room Management System...\n');
    
    // Test 1: Connect and join
    await test('Connect to server', async () => {
        const socket = io(SERVER_URL);
        await new Promise((resolve, reject) => {
            socket.on('connect', resolve);
            socket.on('connect_error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 3000);
        });
        
        // Join with username
        socket.emit('join', 'TestUser1');
        
        const response = await new Promise((resolve) => {
            socket.on('join-success', resolve);
            socket.on('join-error', (error) => {
                throw new Error(`Join failed: ${error}`);
            });
        });
        
        if (!response.sessionId) throw new Error('No sessionId returned');
        if (!response.currentRoom) throw new Error('No currentRoom returned');
        if (!response.rooms) throw new Error('No rooms list returned');
        
        console.log(`  → Joined as ${response.username} in room ${response.currentRoom.name}`);
        console.log(`  → Session ID: ${response.sessionId}`);
        console.log(`  → Available rooms: ${response.rooms.length}`);
        
        socket.disconnect();
    });
    
    // Test 2: Create a room
    await test('Create a new room', async () => {
        const socket = io(SERVER_URL);
        await new Promise(resolve => socket.on('connect', resolve));
        
        socket.emit('join', 'RoomCreator');
        await new Promise(resolve => socket.on('join-success', resolve));
        
        // Create room via API
        const roomData = {
            name: 'Test Room',
            description: 'A test room for automated testing',
            maxParticipants: 10
        };
        
        const response = await axios.post(`${SERVER_URL}/api/rooms`, {
            ...roomData,
            username: 'RoomCreator'
        });
        
        if (response.data.error) throw new Error(response.data.error);
        if (!response.data.room) throw new Error('No room data returned');
        
        console.log(`  → Created room: ${response.data.room.name} (${response.data.room.roomId})`);
        
        socket.disconnect();
    });
    
    // Test 3: Switch rooms
    await test('Switch between rooms', async () => {
        const socket = io(SERVER_URL);
        await new Promise(resolve => socket.on('connect', resolve));
        
        socket.emit('join', 'RoomSwitcher');
        const joinResponse = await new Promise(resolve => socket.on('join-success', resolve));
        
        const rooms = joinResponse.rooms;
        if (rooms.length < 2) throw new Error('Not enough rooms to test switching');
        
        // Switch to a different room
        const targetRoom = rooms.find(r => r.roomId !== joinResponse.currentRoom.roomId);
        socket.emit('switch-room', targetRoom.roomId);
        
        const switchResponse = await new Promise((resolve) => {
            socket.on('room-switched', resolve);
        });
        
        if (switchResponse.roomId !== targetRoom.roomId) {
            throw new Error('Room switch failed');
        }
        
        console.log(`  → Switched from ${joinResponse.currentRoom.name} to ${targetRoom.name}`);
        
        socket.disconnect();
    });
    
    // Test 4: Send message in room
    await test('Send message in room', async () => {
        const socket = io(SERVER_URL);
        await new Promise(resolve => socket.on('connect', resolve));
        
        socket.emit('join', 'MessageSender');
        await new Promise(resolve => socket.on('join-success', resolve));
        
        // Send a message
        const messageData = {
            message: 'Test message in room',
            attachments: []
        };
        
        socket.emit('chat-message', messageData);
        
        // Wait for message echo
        const receivedMessage = await new Promise((resolve) => {
            socket.on('new-message', resolve);
        });
        
        if (receivedMessage.message !== messageData.message) {
            throw new Error('Message content mismatch');
        }
        
        console.log(`  → Message sent and received in room`);
        
        socket.disconnect();
    });
    
    // Test 5: Persistent session
    await test('Persistent session (simulated)', async () => {
        // First connection
        const socket1 = io(SERVER_URL);
        await new Promise(resolve => socket1.on('connect', resolve));
        
        socket1.emit('join', 'PersistentUser');
        const response1 = await new Promise(resolve => socket1.on('join-success', resolve));
        const sessionId = response1.sessionId;
        
        socket1.disconnect();
        
        // Second connection with session
        const socket2 = io(SERVER_URL);
        await new Promise(resolve => socket2.on('connect', resolve));
        
        socket2.emit('rejoin-session', { sessionId, username: 'PersistentUser' });
        const response2 = await new Promise((resolve, reject) => {
            socket2.on('rejoin-success', resolve);
            socket2.on('rejoin-error', reject);
            setTimeout(() => reject(new Error('Rejoin timeout')), 3000);
        });
        
        if (response2.username !== 'PersistentUser') {
            throw new Error('Session not preserved');
        }
        
        console.log(`  → Session persisted successfully`);
        
        socket2.disconnect();
    });
    
    console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Install axios if needed
const { exec } = require('child_process');
exec('npm list axios', (error) => {
    if (error) {
        console.log('Installing axios...');
        exec('npm install axios', (err) => {
            if (err) {
                console.error('Failed to install axios');
                process.exit(1);
            }
            runTests();
        });
    } else {
        runTests();
    }
});