const WebSocket = require('ws');

const token = 'Hv52SXDY0TRsiii';
const appIds = [106684];

async function testToken(appId) {
    return new Promise((resolve) => {
        console.log(`Testing token with App ID: ${appId}...`);
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);

        ws.on('open', () => {
            ws.send(JSON.stringify({ authorize: token }));
        });

        ws.on('message', (data) => {
            const response = JSON.parse(data);
            if (response.error) {
                console.log(`App ID ${appId}: Failed - ${response.error.message} (${response.error.code})`);
            } else {
                console.log(`App ID ${appId}: Success! Login ID: ${response.authorize.loginid}`);
            }
            ws.close();
            resolve();
        });

        ws.on('error', (err) => {
            console.log(`App ID ${appId}: Connection Error - ${err.message}`);
            resolve();
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
                console.log(`App ID ${appId}: Timeout`);
                ws.close();
            }
            resolve();
        }, 10000);
    });
}

async function run() {
    for (const appId of appIds) {
        await testToken(appId);
    }
}

run();
