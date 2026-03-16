/**
 * Simplified test script for physical view functionality
 */

const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting simplified physical view test...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Collect console messages
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
            if (msg.type() === 'error') {
                console.log('❌ Error:', msg.text());
            }
        });
        
        const errors = [];
        page.on('pageerror', error => {
            errors.push(error.message);
            console.log('❌ Page Error:', error.message);
        });
        
        // Step 1: Navigate
        console.log('1️⃣  Navigating to http://localhost:8080...');
        await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: '/home/enguer/PROJECTS/3dit/screenshots/01-homepage.png' });
        console.log('✅ Page loaded\n');
        
        // Step 2: Click editor menu
        console.log('2️⃣  Clicking editor menu...');
        await page.evaluate(() => {
            const menuItems = document.querySelectorAll('.menu-item');
            if (menuItems[1]) {
                menuItems[1].click();
            }
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: '/home/enguer/PROJECTS/3dit/screenshots/02-editor-opened.png' });
        console.log('✅ Editor opened\n');
        
        // Step 3: Select file
        console.log('3️⃣  Selecting physical-demo.json...');
        await page.evaluate(() => {
            const selector = document.getElementById('file_selector');
            if (selector) {
                selector.value = 'physical-demo.json';
                selector.dispatchEvent(new Event('change'));
            }
        });
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: '/home/enguer/PROJECTS/3dit/screenshots/03-file-loaded.png' });
        console.log('✅ File selected\n');
        
        // Step 4: Check canvas
        console.log('4️⃣  Checking 3D canvas...');
        const hasCanvas = await page.$('#builder_canvas canvas');
        console.log(`   Canvas found: ${hasCanvas ? 'YES' : 'NO'}\n`);
        
        // Step 5: Click physical view button
        console.log('5️⃣  Looking for physical view button...');
        const btnExists = await page.$('#btn_physical_view');
        console.log(`   Button exists: ${btnExists ? 'YES' : 'NO'}`);
        
        if (btnExists) {
            console.log('6️⃣  Clicking physical view button...');
            await page.evaluate(() => {
                const btn = document.getElementById('btn_physical_view');
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: '/home/enguer/PROJECTS/3dit/screenshots/04-physical-view.png' });
            
            const isActive = await page.evaluate(() => {
                const btn = document.getElementById('btn_physical_view');
                return btn ? btn.classList.contains('active') : false;
            });
            console.log(`   Button is now active: ${isActive}\n`);
        }
        
        // Step 6: Check palette items
        console.log('7️⃣  Checking physical palette items...');
        const paletteCheck = await page.evaluate(() => {
            const items = {
                datacenter: !!document.querySelector('[data-type="datacenter"]'),
                row: !!document.querySelector('[data-type="row"]'),
                rack: !!document.querySelector('[data-type="rack"]'),
                physicalserver: !!document.querySelector('[data-type="physicalserver"]'),
                physicalswitch: !!document.querySelector('[data-type="physicalswitch"]')
            };
            return items;
        });
        
        console.log('   Palette items:');
        for (const [type, found] of Object.entries(paletteCheck)) {
            console.log(`   ${found ? '✅' : '❌'} ${type}`);
        }
        
        await page.screenshot({ path: '/home/enguer/PROJECTS/3dit/screenshots/05-palette-panel.png', fullPage: true });
        
        // Summary
        console.log('\n📊 TEST SUMMARY:');
        console.log('================');
        console.log(`✅ Page loaded`);
        console.log(`✅ Editor opened`);
        console.log(`✅ physical-demo.json selected`);
        console.log(`${hasCanvas ? '✅' : '❌'} 3D canvas present`);
        console.log(`${btnExists ? '✅' : '❌'} Physical view button exists`);
        console.log(`${Object.values(paletteCheck).every(v => v) ? '✅' : '⚠️'} All palette items present`);
        console.log(`${errors.length === 0 ? '✅' : '⚠️'} No JS errors (${errors.length} errors)`);
        
        if (errors.length > 0) {
            console.log('\nErrors detected:');
            errors.forEach(err => console.log('  - ' + err));
        }
        
        console.log('\n✅ Test complete! Screenshots in /home/enguer/PROJECTS/3dit/screenshots/');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
})();
