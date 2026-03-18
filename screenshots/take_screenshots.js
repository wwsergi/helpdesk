const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

        console.log('Logging in...');
        await page.type('input[type="email"]', 'agent@example.com');
        await page.type('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        console.log('Waiting for Dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Sometimes it redirects to /agent
        if (page.url().includes('login')) {
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        }

        console.log('Taking Dashboard screenshot...');
        await page.screenshot({ path: 'dashboard.png', fullPage: true });

        console.log('Navigating to Inbox...');
        await page.goto('http://localhost:5173/agent/inbox', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'inbox.png', fullPage: true });

        console.log('Opening Create Ticket modal...');
        const createTicketBtn = await page.$x("//button[contains(., 'Create Ticket')]");
        if (createTicketBtn.length > 0) {
            await createTicketBtn[0].click();
            // wait for modal text or just delay
            await new Promise(r => setTimeout(r, 1000));
            await page.screenshot({ path: 'create_ticket.png', fullPage: true });

            // close modal (clicking outside or cancel button)
            const cancelBtn = await page.$x("//button[contains(., 'Cancel')]");
            if (cancelBtn.length > 0) {
                await cancelBtn[cancelBtn.length - 1].click();
                await new Promise(r => setTimeout(r, 500));
            }
        }

        console.log('Opening first ticket...');
        const ticketLink = await page.$('a[href^="/agent/tickets/"]');
        if (ticketLink) {
            await ticketLink.click();
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            await page.screenshot({ path: 'ticket_detail.png', fullPage: true });

            console.log('Opening Delegate modal...');
            const delegateBtn = await page.$x("//button[contains(., 'Delegate / Create Sub-Ticket')]");
            if (delegateBtn.length > 0) {
                await delegateBtn[0].click();
                await new Promise(r => setTimeout(r, 1000));
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
