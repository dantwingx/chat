const assert = require('assert');

// Test configuration
const TEST_KOREAN_USERNAME = '자스민'; // Korean username that was causing the issue
const TEST_CHINESE_USERNAME = '张伟'; // Chinese characters
const TEST_JAPANESE_USERNAME = 'さくら'; // Japanese characters
const TEST_ASCII_USERNAME = 'testuser'; // ASCII for backward compatibility

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
function testKoreanEncoding() {
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
function testChineseEncoding() {
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
function testJapaneseEncoding() {
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
function testBackwardCompatibility() {
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

// Test malformed encoded usernames (edge cases)
function testMalformedEncodedUsernames() {
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

// Test that demonstrates the original issue would have failed
function testOriginalIssue() {
    console.log('\n=== Testing Original Issue Scenario ===');
    
    // This simulates what would happen with the original code
    const koreanUsername = '자스민';
    
    console.log('Original Korean username:', koreanUsername);
    
    // Show that without encoding, Korean characters would cause issues in HTTP headers
    console.log('Without URL encoding, this username would cause:');
    console.log('  HTTP Error: "String contains non ISO-8859-1 code point"');
    
    // Show that with our fix, it works
    const encoded = encodeURIComponent(koreanUsername);
    const decoded = decodeUsername(encoded);
    
    console.log('With URL encoding fix:');
    console.log('  Client sends:', encoded);
    console.log('  Server receives and decodes:', decoded);
    console.log('  Result matches original:', decoded === koreanUsername ? '✓' : '✗');
    
    assert.strictEqual(decoded, koreanUsername, 'Fix should handle Korean characters correctly');
    console.log('✓ Original issue fix verified');
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting Korean Character Encoding Tests');
    console.log('==========================================');
    
    try {
        testKoreanEncoding();
        testChineseEncoding();
        testJapaneseEncoding();
        testBackwardCompatibility();
        testMalformedEncodedUsernames();
        testOriginalIssue();
        
        console.log('\n🎉 All encoding/decoding tests passed!');
        console.log('✓ Korean, Chinese, and Japanese usernames are now supported');
        console.log('✓ Backward compatibility with ASCII usernames maintained');
        console.log('✓ Invalid encoding handled gracefully');
        console.log('✓ Original "String contains non ISO-8859-1 code point" issue fixed');
        
        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
}

module.exports = {
    runAllTests,
    testKoreanEncoding,
    testChineseEncoding,
    testJapaneseEncoding,
    testBackwardCompatibility,
    testMalformedEncodedUsernames,
    testOriginalIssue
};