import { isStaging } from '../url/helpers';

export const APP_IDS = {
    LOCALHOST: 106684,
    TMP_STAGING: 106684,
    STAGING: 106684,
    STAGING_BE: 106684,
    STAGING_ME: 106684,
    PRODUCTION: 106684,
    PRODUCTION_BE: 106684,
    PRODUCTION_ME: 106684,
};

export const livechat_license_id = 12049137;
export const livechat_client_id = '66aa088aad5a414484c1fd1fa8a5ace7';

export const domain_app_ids = {
    'master.bot-standalone.pages.dev': APP_IDS.TMP_STAGING,
    'staging-dbot.deriv.com': APP_IDS.STAGING,
    'staging-dbot.deriv.be': APP_IDS.STAGING_BE,
    'staging-dbot.deriv.me': APP_IDS.STAGING_ME,
    'dbot.deriv.com': APP_IDS.PRODUCTION,
    'dbot.deriv.be': APP_IDS.PRODUCTION_BE,
    'dbot.deriv.me': APP_IDS.PRODUCTION_ME,
    'bot-master-three.vercel.app': APP_IDS.PRODUCTION,
    'baciup.vercel.app': APP_IDS.PRODUCTION,
    'bot-master-qbw97edi-rbls-projects.vercel.app': APP_IDS.PRODUCTION,
};

export const getCurrentProductionDomain = () =>
    !/^staging\./.test(window.location.hostname) &&
    Object.keys(domain_app_ids).find(domain => window.location.hostname === domain);

export const isProduction = () => {
    const all_domains = Object.keys(domain_app_ids).map(domain => `(www\\.)?${domain.replace('.', '\\.')}`);
    return new RegExp(`^(${all_domains.join('|')})$`, 'i').test(window.location.hostname);
};

export const isTestLink = () => {
    return (
        window.location.origin?.includes('.binary.sx') ||
        window.location.origin?.includes('bot-65f.pages.dev') ||
        window.location.hostname.includes('.vercel.app') ||
        window.location.hostname.includes('.pages.dev') ||
        isLocal()
    );
};

export const isLocal = () =>
    /localhost(:\d+)?$/i.test(window.location.hostname) ||
    /^(?:127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?$/i.test(
        window.location.host
    );

const getDefaultServerURL = () => {
    return 'ws.derivws.com';
};

export const getDefaultAppIdAndUrl = () => {
    const server_url = getDefaultServerURL();

    if (isTestLink()) {
        return { app_id: APP_IDS.LOCALHOST, server_url };
    }

    const current_domain = getCurrentProductionDomain() ?? '';
    const app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids] ?? APP_IDS.PRODUCTION;

    return { app_id, server_url };
};

export const getAppId = () => {
    let app_id = null;
    const config_app_id = window.localStorage.getItem('config.app_id');
    const current_domain = getCurrentProductionDomain() ?? '';

    // If the user explicitly set an ID in their current session, respect it
    if (config_app_id) {
        app_id = config_app_id;
    } else if (isLocal() && !config_app_id) {
        // Fallback to the user's preferred app_id for localhost
        app_id = '106684';
    } else if (isStaging()) {
        app_id = APP_IDS.STAGING;
    } else if (isTestLink()) {
        app_id = APP_IDS.LOCALHOST;
    } else {
        app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids] ?? APP_IDS.PRODUCTION;
    }

    return app_id;
};

export const getSocketURL = () => {
    const local_storage_server_url = window.localStorage.getItem('config.server_url');
    if (local_storage_server_url) return local_storage_server_url;

    const server_url = getDefaultServerURL();

    return server_url;
};

export const checkAndSetEndpointFromUrl = () => {
    const url_params = new URLSearchParams(location.search.slice(1));

    if (url_params.has('app_id')) {
        const app_id = url_params.get('app_id') || '';
        const qa_server = url_params.get('qa_server') || '';

        if (/^[0-9]+$/.test(app_id)) {
            localStorage.setItem('config.app_id', app_id);
            if (qa_server && /^(^(www\.)?qa[0-9]{1,4}\.deriv.dev|(.*)\.derivws\.com)$/.test(qa_server)) {
                localStorage.setItem('config.server_url', qa_server.replace(/"/g, ''));
            }

            url_params.delete('app_id');
            url_params.delete('qa_server');

            const params = url_params.toString();
            const hash = location.hash;

            location.href = `${location.protocol}//${location.hostname}${location.pathname}${params ? `?${params}` : ''}${hash || ''}`;

            return true;
        }
    }

    return false;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = () => {
    const hostname = window.location.hostname;
    const app_id = getAppId();
    let oauth_domain = 'deriv.com';

    // Explicitly handle known Deriv-owned domains for correctly localized OAuth
    if (hostname.includes('.deriv.me')) {
        oauth_domain = 'deriv.me';
    } else if (hostname.includes('.deriv.be')) {
        oauth_domain = 'deriv.be';
    }
    // For Vercel, Localhost, or other custom domains, we MUST use deriv.com
    // as the OAuth provider. Previous logic incorrectly tried oauth.vercel.app.

    return `https://oauth.${oauth_domain}/oauth2/authorize?app_id=${app_id}&l=EN&brand=deriv&redirect_uri=https://baciup.vercel.app/callback`;
};
