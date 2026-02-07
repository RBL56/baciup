import { initializeI18n } from '@deriv-com/translations';
import ReactDOM from 'react-dom/client';
import { AuthWrapper } from './app/AuthWrapper';
import { checkAndSetEndpointFromUrl } from './components/shared';
import { AnalyticsInitializer } from './utils/analytics';
import { registerPWA } from './utils/pwa-utils';
import './styles/index.scss';

// Initialize i18n before any other code runs to ensure localize is available
// This prevents ReferenceError in async chunks that use localize
const { TRANSLATIONS_CDN_URL, R2_PROJECT_NAME, CROWDIN_BRANCH_NAME } = process.env;
initializeI18n({
    cdnUrl: `${TRANSLATIONS_CDN_URL}/${R2_PROJECT_NAME}/${CROWDIN_BRANCH_NAME}`,
});

if (checkAndSetEndpointFromUrl()) {
    // Break the execution to wait for page reload
} else {
    AnalyticsInitializer();
    registerPWA()
        .then(registration => {
            if (registration) {
                console.log('PWA service worker registered successfully for Chrome');
            } else {
                console.log('PWA service worker disabled for non-Chrome browser');
            }
        })
        .catch(error => {
            console.error('PWA service worker registration failed:', error);
        });

    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
}
