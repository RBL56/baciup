import { getAppId, getSocketURL } from '@/components/shared';
import { website_name } from '@/utils/site-config';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import { getInitialLanguage } from '@deriv-com/translations';
import APIMiddleware from './api-middleware';

// Fallback servers in order of preference
const FALLBACK_SERVERS = [
    'ws.derivws.com',
    'green.derivws.com',
    'blue.derivws.com',
    'red.derivws.com',
    'frontend.derivws.com'
];

let currentServerIndex = 0;
let connectionAttempts = 0;

export const generateDerivApiInstance = () => {
    const configServer = getSocketURL();
    const cleanedAppId = getAppId()?.replace?.(/[^a-zA-Z0-9]/g, '') ?? getAppId();

    // Try configured server first, then fallbacks
    let serverToUse = configServer;
    if (connectionAttempts > 0 && currentServerIndex < FALLBACK_SERVERS.length) {
        serverToUse = FALLBACK_SERVERS[currentServerIndex];
        console.log(`[WebSocket] Trying fallback server ${currentServerIndex + 1}/${FALLBACK_SERVERS.length}: ${serverToUse}`);
    }

    const cleanedServer = serverToUse.replace(/[^a-zA-Z0-9.]/g, '');
    const socket_url = `wss://${cleanedServer}/websockets/v3?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=${website_name.toLowerCase()}`;

    console.log('%c[WebSocket] Connecting...', 'color: #2196f3; font-weight: bold');
    console.log('[WebSocket] URL:', socket_url);
    console.log('[WebSocket] Server:', cleanedServer);
    console.log('[WebSocket] App ID:', cleanedAppId);
    console.log('[WebSocket] Attempt:', connectionAttempts + 1);

    const deriv_socket = new WebSocket(socket_url);

    deriv_socket.addEventListener('open', () => {
        console.log('%c[WebSocket] ✓ Connected successfully!', 'color: #4caf50; font-weight: bold');
        console.log('[WebSocket] Using server:', cleanedServer);
        // Reset counters on successful connection
        connectionAttempts = 0;
        currentServerIndex = 0;
    });

    deriv_socket.addEventListener('error', (error) => {
        console.error('%c[WebSocket] ✗ Connection error:', 'color: #f44336; font-weight: bold', error);
        console.error('[WebSocket] Failed URL:', socket_url);
        console.error('[WebSocket] Failed server:', cleanedServer);

        connectionAttempts++;

        // Try next fallback server
        if (currentServerIndex < FALLBACK_SERVERS.length - 1) {
            currentServerIndex++;
            console.log(`[WebSocket] Will try next fallback server on reconnect: ${FALLBACK_SERVERS[currentServerIndex]}`);
        } else {
            console.error('[WebSocket] All fallback servers exhausted. Please check your network connection.');
            currentServerIndex = 0; // Reset for next retry cycle
        }
    });

    deriv_socket.addEventListener('close', (event) => {
        console.warn('%c[WebSocket] Connection closed', 'color: #ff9800; font-weight: bold');
        console.warn('[WebSocket] Close code:', event.code);
        console.warn('[WebSocket] Close reason:', event.reason || 'No reason provided');
        console.warn('[WebSocket] Was clean:', event.wasClean);

        // Common close codes
        const closeCodeMessages = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1006: 'Abnormal closure (no close frame)',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal server error',
            1015: 'TLS handshake failure'
        };

        if (closeCodeMessages[event.code]) {
            console.warn('[WebSocket] Close reason:', closeCodeMessages[event.code]);
        }

        // Suggest solutions for common issues
        if (event.code === 1006) {
            console.warn('[WebSocket] Tip: Code 1006 often indicates network/firewall issues or server unavailability');
        } else if (event.code === 1015) {
            console.warn('[WebSocket] Tip: Code 1015 indicates SSL/TLS issues. Check your system time and date.');
        }
    });

    const deriv_api = new DerivAPIBasic({
        connection: deriv_socket,
        middleware: new APIMiddleware({}),
    });

    return deriv_api;
};

export const getLoginId = () => {
    const login_id = localStorage.getItem('active_loginid');
    if (login_id && login_id !== 'null') return login_id;
    return null;
};

export const V2GetActiveToken = () => {
    const token = localStorage.getItem('authToken');
    if (token && token !== 'null') return token;
    return null;
};

export const V2GetActiveClientId = () => {
    const token = V2GetActiveToken();

    if (!token) return null;
    const account_list = JSON.parse(localStorage.getItem('accountsList'));
    if (account_list && account_list !== 'null') {
        const active_clientId = Object.keys(account_list).find(key => account_list[key] === token);
        return active_clientId;
    }
    return null;
};

export const getToken = () => {
    const active_loginid = getLoginId();
    const client_accounts = JSON.parse(localStorage.getItem('accountsList')) ?? undefined;
    const active_account = (client_accounts && client_accounts[active_loginid]) || {};
    return {
        token: active_account ?? undefined,
        account_id: active_loginid ?? undefined,
    };
};
