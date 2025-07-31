const io = require('socket.io-client');

const socket = io('http://localhost:3001');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`✗ ${name}: ${error.message}`);
        testsFailed++;
    }
}

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Test joining
    socket.emit('join', 'TestUser');
});

socket.on('joined', (data) => {
    test('Join response received', () => {
        if (!data.username) throw new Error('No username in response');
        if (!data.activeUsers) throw new Error('No activeUsers in response');
    });
    
    // Test sending message
    setTimeout(() => {
        socket.emit('chat-message', 'Test message');
    }, 100);
});

socket.on('chat-message', (data) => {
    test('Message received', () => {
        if (!data.message) throw new Error('No message in data');
        if (!data.username) throw new Error('No username in data');
        console.log('Received message:', data);
    });
    
    // Disconnect after tests
    setTimeout(() => {
        socket.disconnect();
        console.log(`\nTests: ${testsPassed} passed, ${testsFailed} failed`);
        process.exit(testsFailed > 0 ? 1 : 0);
    }, 500);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
    process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
    console.error('Test timeout');
    process.exit(1);
}, 5000);