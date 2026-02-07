import React, { createContext, useContext, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import LoadingScreen from '@/components/loading-screen/loading-screen';
import { localize } from '@deriv-com/translations';

interface AuthContextType {
    isInitialized: boolean;
    hasToken: boolean;
    isLoadingUserData: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = observer(({ children }) => {
    const store = useStore();
    const [hasToken, setHasToken] = useState(false);
    const [isOAuthRedirect, setIsOAuthRedirect] = useState(false);

    // Check for auth token in localStorage
    useEffect(() => {
        // Check if we just completed OAuth redirect
        const oauthComplete = sessionStorage.getItem('oauth_redirect_complete');
        if (oauthComplete === 'true') {
            console.log('[AuthContext] OAuth redirect detected via sessionStorage flag');
            setIsOAuthRedirect(true);
            // Clear the flag after detection
            sessionStorage.removeItem('oauth_redirect_complete');
        }

        const checkToken = () => {
            const token = localStorage.getItem('authToken');
            const accountsList = localStorage.getItem('accountsList');
            const hasTokens = !!(token && accountsList);

            if (hasTokens) {
                console.log('[AuthContext] Tokens detected in localStorage');
            }

            setHasToken(hasTokens);
            return hasTokens;
        };

        // Initial check
        const initialTokens = checkToken();

        // Listen for storage changes (in case token is set in another tab or by callback)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'authToken' || e.key === 'accountsList') {
                console.log('[AuthContext] Storage change detected:', e.key);
                checkToken();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Adaptive polling: faster after OAuth redirect, slower during normal operation
        let pollInterval = 500; // Default polling interval
        let pollCount = 0;
        const maxFastPolls = 100; // Fast poll for 10 seconds (100 * 100ms)

        // Use fast polling (100ms) for first 10 seconds after OAuth redirect or if no tokens yet
        if (isOAuthRedirect || !initialTokens) {
            pollInterval = 100;
            console.log('[AuthContext] Using fast polling (100ms) for OAuth redirect');
        }

        const interval = setInterval(() => {
            pollCount++;

            // Switch to slower polling after initial period
            if (pollInterval === 100 && pollCount > maxFastPolls) {
                console.log('[AuthContext] Switching to normal polling (500ms)');
                clearInterval(interval);
                // Restart with slower interval
                const slowInterval = setInterval(checkToken, 500);
                return () => clearInterval(slowInterval);
            }

            checkToken();
        }, pollInterval);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [isOAuthRedirect]);

    if (!store) {
        return <LoadingScreen message={localize('Initializing application...')} />;
    }

    const { client } = store;
    const isInitialized = client.is_client_initialized;
    const isLoggedIn = client.is_logged_in;
    const isLoadingUserData = hasToken && isLoggedIn && !isInitialized;

    // Show loading screen when we have a token but user data isn't loaded yet
    if (isLoadingUserData) {
        return <LoadingScreen message={localize('Loading account data...')} />;
    }

    return (
        <AuthContext.Provider value={{ isInitialized, hasToken, isLoadingUserData }}>
            {children}
        </AuthContext.Provider>
    );
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
