const { chromium } = require('playwright');
const path = require('path');

async function run() {
    console.log('Starting playwright...');
    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

        console.log('Logging in...');
        await page.fill('input[type="email"]', 'agent@example.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        console.log('Waiting for Dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle' });

        if (page.url().includes('login')) {
            await page.waitForNavigation({ waitUntil: 'networkidle' });
        }

        console.log('Taking Dashboard screenshot...');
        await page.screenshot({ path: 'dashboard.png', fullPage: true });

        console.log('Navigating to Inbox...');
        await page.goto('http://localhost:5173/agent/inbox', { waitUntil: 'networkidle' });
        await page.screenshot({ path: 'inbox.png', fullPage: true });

        console.log('Opening Create Ticket modal...');
        const createTicketBtn = page.locator('button', { hasText: 'Create Ticket' });
        if (await createTicketBtn.count() > 0) {
            await createTicketBtn.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'create_ticket.png', fullPage: true });

            const cancelBtn = page.locator('button', { hasText: 'Cancel' });
            if (await cancelBtn.count() > 0) {
                await cancelBtn.last().click();
                await page.waitForTimeout(500);
            }
        }

        console.log('Opening first ticket...');
        const ticketLink = page.locator('a[href^="/agent/tickets/"]').first();
        if (await ticketLink.count() > 0) {
            await ticketLink.click();
            await page.waitForNavigation({ waitUntil: 'networkidle' });
            await page.screenshot({ path: 'ticket_detail.png', fullPage: true });

            console.log('Opening Delegate modal...');
            const delegateBtn = page.locator('button', { hasText: 'Delegate / Create Sub-Ticket' });
            if (await delegateBtn.count() > 0) {
                await delegateBtn.first().click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: 'create_subticket.png', fullPage: true });
            }
        }

        console.log('Screenshots captured successfully.');
    } catch (e) {
        console.error('Error during screenshot capture:', e);
    } finally {
        await browser.close();
    }
}

run();
