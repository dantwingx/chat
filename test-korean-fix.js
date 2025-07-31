const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';

async function testKoreanUsername() {
    console.log('🧪 Testing Korean username encoding fix...\n');
    
    try {
        // Test Korean username
        const koreanUsername = '자스민';
        console.log(`Testing with Korean username: "${koreanUsername}"`);
        
        // Test room creation with Korean username
        const roomData = {
            name: 'Korean Test Room',
            description: 'Testing Korean character encoding',
            maxUsers: 20
        };
        
        console.log('📤 Sending room creation request...');
        console.log('Headers:', {
            'Content-Type': 'application/json',
            'X-Username': encodeURIComponent(koreanUsername)
        });
        
        const response = await axios.post(`${SERVER_URL}/api/rooms`, roomData, {
            headers: {
                'Content-Type': 'application/json',
                'X-Username': encodeURIComponent(koreanUsername)
            }
        });
        
        console.log('✅ Room creation successful!');
        console.log('Response:', response.data);
        
        if (response.data.success && response.data.roomId) {
            console.log(`✅ Room created with ID: ${response.data.roomId}`);
            
            // Test room announcement update
            console.log('\n📤 Testing room announcement update...');
            const announcementResponse = await axios.post(
                `${SERVER_URL}/api/rooms/${response.data.roomId}/announcement`,
                { announcement: '안녕하세요! Welcome to the test room!' },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Username': encodeURIComponent(koreanUsername)
                    }
                }
            );
            
            if (announcementResponse.data.success) {
                console.log('✅ Room announcement update successful!');
            } else {
                console.log('❌ Room announcement update failed:', announcementResponse.data);
            }
            
        } else {
            console.log('❌ Room creation failed:', response.data);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
    
    console.log('\n📊 Korean encoding test completed!');
}

// Test other international characters
async function testOtherInternationalChars() {
    console.log('\n🌍 Testing other international characters...\n');
    
    const testUsers = [
        { name: '张伟', lang: 'Chinese' },
        { name: 'さくら', lang: 'Japanese' },
        { name: 'محمد', lang: 'Arabic' },
        { name: 'Владимир', lang: 'Russian' }
    ];
    
    for (const user of testUsers) {
        try {
            console.log(`Testing ${user.lang} username: "${user.name}"`);
            
            const response = await axios.post(`${SERVER_URL}/api/rooms`, {
                name: `${user.lang} Test Room`,
                description: `Testing ${user.lang} encoding`,
                maxUsers: 20
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Username': encodeURIComponent(user.name)
                }
            });
            
            if (response.data.success) {
                console.log(`✅ ${user.lang} test passed`);
            } else {
                console.log(`❌ ${user.lang} test failed:`, response.data.error);
            }
            
        } catch (error) {
            console.log(`❌ ${user.lang} test error:`, error.message);
        }
    }
}

// Check if server is running
async function checkServer() {
    try {
        const response = await axios.get(SERVER_URL);
        console.log('✅ Server is running\n');
        return true;
    } catch (error) {
        console.log('❌ Server is not running on port 3001');
        console.log('Please start the server with: npm start');
        return false;
    }
}

async function runTests() {
    if (await checkServer()) {
        await testKoreanUsername();
        await testOtherInternationalChars();
    }
}

runTests();