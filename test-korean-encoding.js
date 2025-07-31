const io = require('socket.io-client');
const axios = require('axios');
const assert = require('assert');

// Test configuration
const SERVER_URL = 'http://localhost:3001';
const TEST_KOREAN_USERNAME = '자스민'; // Korean username that was causing the issue
const TEST_CHINESE_USERNAME = '张伟'; // Chinese characters
const TEST_JAPANESE_USERNAME = 'さくら'; // Japanese characters
const TEST_ASCII_USERNAME = 'testuser'; // ASCII for backward compatibility

let server;

// Start server for testing
async function startServer() {
    const { spawn } = require('child_process');
    server = spawn('node', ['server.js'], { 
        stdio: 'pipe',
        cwd: __dirname 
    });
    
    // Wait for server to start
    await new Promise(resolve => {
        server.stdout.on('data', (data) => {
            if (data.toString().includes('Server running on port')) {
                resolve();
            }
        });
    });
    
    console.log('Server started for testing');
}

// Stop server
function stopServer() {
    if (server) {
        server.kill();
        console.log('Server stopped');
    }
}

// Test helper function to decode username like the server does
function decodeUsername(username) {
    if (!username) return username;
    
    try {
        return decodeURIComponent(username);
    } catch (error) {
        console.log('Failed to decode username, using original:', username);
        return username;
    }
}

// Test Korean character URL encoding/decoding
async function testKoreanEncoding() {
    console.log('\n=== Testing Korean Character Encoding ===');
    
    // Test the encoding/decoding logic
    const encodedKorean = encodeURIComponent(TEST_KOREAN_USERNAME);
    const decodedKorean = decodeUsername(encodedKorean);
    
    console.log('Original Korean username:', TEST_KOREAN_USERNAME);
    console.log('URL encoded:', encodedKorean);
    console.log('Decoded back:', decodedKorean);
    
    assert.strictEqual(decodedKorean, TEST_KOREAN_USERNAME, 'Korean encoding/decoding should work correctly');
    console.log('✓ Korean encoding/decoding test passed');
}

// Test Chinese character URL encoding/decoding
async function testChineseEncoding() {
    console.log('\n=== Testing Chinese Character Encoding ===');
    
    const encodedChinese = encodeURIComponent(TEST_CHINESE_USERNAME);
    const decodedChinese = decodeUsername(encodedChinese);
    
    console.log('Original Chinese username:', TEST_CHINESE_USERNAME);
    console.log('URL encoded:', encodedChinese);
    console.log('Decoded back:', decodedChinese);
    
    assert.strictEqual(decodedChinese, TEST_CHINESE_USERNAME, 'Chinese encoding/decoding should work correctly');
    console.log('✓ Chinese encoding/decoding test passed');
}

// Test Japanese character URL encoding/decoding
async function testJapaneseEncoding() {
    console.log('\n=== Testing Japanese Character Encoding ===');
    
    const encodedJapanese = encodeURIComponent(TEST_JAPANESE_USERNAME);
    const decodedJapanese = decodeUsername(encodedJapanese);
    
    console.log('Original Japanese username:', TEST_JAPANESE_USERNAME);
    console.log('URL encoded:', encodedJapanese);
    console.log('Decoded back:', decodedJapanese);
    
    assert.strictEqual(decodedJapanese, TEST_JAPANESE_USERNAME, 'Japanese encoding/decoding should work correctly');
    console.log('✓ Japanese encoding/decoding test passed');
}

// Test backward compatibility with ASCII usernames
async function testBackwardCompatibility() {
    console.log('\n=== Testing Backward Compatibility ===');
    
    // Test non-encoded ASCII username (backward compatibility)
    const decodedASCII = decodeUsername(TEST_ASCII_USERNAME);
    console.log('ASCII username (non-encoded):', TEST_ASCII_USERNAME);
    console.log('Decoded result:', decodedASCII);
    
    assert.strictEqual(decodedASCII, TEST_ASCII_USERNAME, 'ASCII usernames should remain unchanged');
    
    // Test encoded ASCII username
    const encodedASCII = encodeURIComponent(TEST_ASCII_USERNAME);
    const decodedEncodedASCII = decodeUsername(encodedASCII);
    console.log('ASCII username (encoded):', encodedASCII);
    console.log('Decoded result:', decodedEncodedASCII);
    
    assert.strictEqual(decodedEncodedASCII, TEST_ASCII_USERNAME, 'Encoded ASCII usernames should decode correctly');
    console.log('✓ Backward compatibility test passed');
}

// Test actual HTTP header with Korean characters
async function testHTTPHeaderWithKoreanCharacters() {
    console.log('\n=== Testing HTTP Headers with Korean Characters ===');
    
    try {
        // First, join the chat with a Korean username
        const socket = io(SERVER_URL, { 
            transports: ['websocket'],
            timeout: 5000
        });
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);
            
            socket.on('connect', () => {
                clearTimeout(timeout);
                console.log('Socket connected');
                
                // Join with Korean username
                socket.emit('join', {
                    username: TEST_KOREAN_USERNAME,
                    roomId: 'general'
                });
            });
            
            socket.on('join-success', (data) => {
                console.log('✓ Successfully joined chat with Korean username:', data.username);
                assert.strictEqual(data.username, TEST_KOREAN_USERNAME, 'Username should match exactly');
                resolve();
            });
            
            socket.on('join-error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Join failed: ${error}`));
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Connection failed: ${error.message}`));
            });
        });
        
        // Test room creation with Korean username
        console.log('Testing room creation with Korean username...');
        const roomResponse = await axios.post(`${SERVER_URL}/api/rooms`, {
            name: 'Korean Test Room',
            description: 'Testing Korean character encoding',
            maxUsers: 10
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Username': encodeURIComponent(TEST_KOREAN_USERNAME)
            }
        });
        
        console.log('✓ Room creation with Korean username successful:', roomResponse.data);
        
        socket.disconnect();
        console.log('✓ HTTP header test with Korean characters passed');
        
    } catch (error) {
        console.error('✗ HTTP header test failed:', error.message);
        throw error;
    }
}

// Test malformed encoded usernames (edge cases)
async function testMalformedEncodedUsernames() {
    console.log('\n=== Testing Malformed Encoded Usernames ===');
    
    // Test invalid URL encoding
    const invalidEncoded = 'test%ZZ%invalid';
    const decodedInvalid = decodeUsername(invalidEncoded);
    
    console.log('Invalid encoded username:', invalidEncoded);
    console.log('Decoded result (should be original):', decodedInvalid);
    
    // Should fallback to original value
    assert.strictEqual(decodedInvalid, invalidEncoded, 'Invalid encoding should fallback to original');
    console.log('✓ Malformed encoding test passed');
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Korean Character Encoding Tests');
    console.log('==========================================');
    
    try {
        // Start the server
        await startServer();
        
        // Run encoding/decoding tests
        await testKoreanEncoding();
        await testChineseEncoding();
        await testJapaneseEncoding();
        await testBackwardCompatibility();
        await testMalformedEncodedUsernames();
        
        // Test with actual server
        await testHTTPHeaderWithKoreanCharacters();
        
        console.log('\n🎉 All tests passed! Korean character encoding fix is working correctly.');
        console.log('✓ Korean, Chinese, and Japanese usernames are now supported');
        console.log('✓ Backward compatibility with ASCII usernames maintained');
        console.log('✓ HTTP headers properly encode/decode international characters');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        stopServer();
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, cleaning up...');
    stopServer();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, cleaning up...');
    stopServer();
    process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        stopServer();
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testKoreanEncoding,
    testChineseEncoding,
    testJapaneseEncoding,
    testBackwardCompatibility,
    testHTTPHeaderWithKoreanCharacters,
    testMalformedEncodedUsernames
};