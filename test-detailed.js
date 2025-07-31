const http = require('http');
const io = require('socket.io-client');

console.log('Starting detailed tests...\n');

// Test 1: Check if server is running
http.get('http://localhost:3001', (res) => {
    console.log(`✓ Server is running (status: ${res.statusCode})`);
    
    // Test 2: Connect via Socket.IO
    const socket = io('http://localhost:3001', {
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log(`✓ Socket connected (ID: ${socket.id})`);
        
        // Test 3: Try to join
        console.log('→ Attempting to join as "TestUser"...');
        socket.emit('join', 'TestUser');
        
        // Set timeout for join response
        const joinTimeout = setTimeout(() => {
            console.log('✗ No "joined" event received within 2 seconds');
            testMessage();
        }, 2000);
        
        socket.on('joined', (data) => {
            clearTimeout(joinTimeout);
            console.log('✓ Received "joined" event:', JSON.stringify(data, null, 2));
            testMessage();
        });
        
        socket.on('join-error', (error) => {
            clearTimeout(joinTimeout);
            console.log('✗ Join error:', error);
            testMessage();
        });
        
        function testMessage() {
            // Test 4: Send a message
            console.log('\n→ Sending test message...');
            socket.emit('chat-message', 'Test message from automated test');
            
            const messageTimeout = setTimeout(() => {
                console.log('✗ No message echo received within 2 seconds');
                socket.disconnect();
                process.exit(1);
            }, 2000);
            
            socket.on('chat-message', (data) => {
                clearTimeout(messageTimeout);
                console.log('✓ Received message:', JSON.stringify(data, null, 2));
                
                console.log('\n✓ All tests passed!');
                socket.disconnect();
                process.exit(0);
            });
        }
    });
    
    socket.on('connect_error', (error) => {
        console.log('✗ Socket connection error:', error.message);
        process.exit(1);
    });
    
    // List all events
    socket.onAny((eventName, ...args) => {
        console.log(`📡 Event: ${eventName}`, args.length > 0 ? JSON.stringify(args[0], null, 2) : '');
    });
    
}).on('error', (err) => {
    console.log('✗ Server is not running:', err.message);
    process.exit(1);
});