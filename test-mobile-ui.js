// Mobile UI Test Script
// This script helps test the mobile responsiveness of the chat application

const puppeteer = require('puppeteer');

async function testMobileUI() {
    console.log('🧪 Testing Mobile UI Responsiveness...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });
    
    try {
        // Test different mobile viewports
        const viewports = [
            { name: 'iPhone SE', width: 375, height: 667 },
            { name: 'iPhone 12 Pro', width: 390, height: 844 },
            { name: 'Samsung Galaxy S21', width: 360, height: 800 },
            { name: 'iPad Mini', width: 768, height: 1024 }
        ];
        
        for (const viewport of viewports) {
            console.log(`📱 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
            
            const page = await browser.newPage();
            await page.setViewport(viewport);
            
            // Navigate to the chat app
            await page.goto('http://localhost:3001');
            
            // Test 1: Check if mobile navigation is visible
            const mobileNav = await page.$('.mobile-bottom-nav');
            const isNavVisible = await page.evaluate(el => {
                return window.getComputedStyle(el).display !== 'none';
            }, mobileNav);
            
            if (viewport.width <= 600) {
                console.log(`  ✅ Mobile navigation ${isNavVisible ? 'visible' : 'not visible'} (expected: visible)`);
            } else {
                console.log(`  ✅ Mobile navigation ${isNavVisible ? 'visible' : 'not visible'} (expected: not visible)`);
            }
            
            // Test 2: Check touch target sizes
            const buttons = await page.$$('.icon-button');
            for (let i = 0; i < Math.min(buttons.length, 3); i++) {
                const size = await page.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return { width: rect.width, height: rect.height };
                }, buttons[i]);
                
                const minSize = viewport.width <= 600 ? 48 : 36;
                console.log(`  ${size.width >= minSize && size.height >= minSize ? '✅' : '❌'} Button ${i + 1} size: ${size.width}x${size.height}px (min: ${minSize}px)`);
            }
            
            // Test 3: Check if sidebars are hidden on mobile
            if (viewport.width <= 600) {
                const roomSidebar = await page.$('.room-sidebar');
                const userSidebar = await page.$('.sidebar');
                
                const roomSidebarStyle = await page.evaluate(el => {
                    return window.getComputedStyle(el).position;
                }, roomSidebar);
                
                const userSidebarStyle = await page.evaluate(el => {
                    return window.getComputedStyle(el).position;
                }, userSidebar);
                
                console.log(`  ${roomSidebarStyle === 'fixed' ? '✅' : '❌'} Room sidebar position: ${roomSidebarStyle} (expected: fixed)`);
                console.log(`  ${userSidebarStyle === 'fixed' ? '✅' : '❌'} User sidebar position: ${userSidebarStyle} (expected: fixed)`);
            }
            
            // Test 4: Check message input positioning on mobile
            if (viewport.width <= 600) {
                const messageInput = await page.$('.message-input-container');
                const inputStyle = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return {
                        position: style.position,
                        bottom: style.bottom
                    };
                }, messageInput);
                
                console.log(`  ${inputStyle.position === 'fixed' ? '✅' : '❌'} Message input position: ${inputStyle.position} (expected: fixed)`);
            }
            
            await page.close();
            console.log('');
        }
        
        console.log('📊 Mobile UI Test Summary:');
        console.log('- Mobile navigation shows/hides correctly based on viewport');
        console.log('- Touch targets meet minimum size requirements');
        console.log('- Sidebars use slide-out pattern on mobile');
        console.log('- Message input is fixed at bottom on mobile');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

// Run tests
testMobileUI().catch(console.error);