import React from 'react';
import Cookies from 'js-cookie';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { clearAuthData } from '@/utils/auth-utils';
import { localize } from '@deriv-com/translations';
import { URLUtils } from '@deriv-com/utils';
import LoadingScreen from '@/components/loading-screen/loading-screen';
import App from './App';

// Extend Window interface to include is_tmb_enabled property
declare global {
    interface Window {
        is_tmb_enabled?: boolean;
    }
}

const setLocalStorageToken = async (
    loginInfo: URLUtils.LoginInfo[],
    paramsToDelete: string[],
    setIsAuthComplete: React.Dispatch<React.SetStateAction<boolean>>,
    isOnline: boolean
) => {
    if (loginInfo.length) {
        try {
            const defaultActiveAccount = URLUtils.getDefaultActiveAccount(loginInfo);
            if (!defaultActiveAccount) return;

            const accountsList: Record<string, string> = {};
            const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

            loginInfo.forEach((account: { loginid: string; token: string; currency: string }) => {
                accountsList[account.loginid] = account.token;
                clientAccounts[account.loginid] = account;
            });

            localStorage.setItem('accountsList', JSON.stringify(accountsList));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

            URLUtils.filterSearchParams(paramsToDelete);

            // Skip API connection when offline
            if (!isOnline) {
                console.log('[Auth] Offline mode - skipping API connection');
                localStorage.setItem('authToken', loginInfo[0].token);
                localStorage.setItem('active_loginid', loginInfo[0].loginid);
                return;
            }

            try {
                const api = await generateDerivApiInstance();
                if (api) {
                    console.log('[Auth] API instance created, attempting authorization...');
                    const { authorize, error } = await api.authorize(loginInfo[0].token);

                    if (!error && authorize) {
                        console.log('[Auth] Authorization successful for:', authorize.loginid);
                        localStorage.setItem('client.country', authorize.country);

                        // Update accounts list from API response
                        const apiAccountsList: Record<string, string> = {};
                        const apiClientAccounts: Record<string, any> = {};

                        authorize.account_list.forEach((account: any) => {
                            apiAccountsList[account.loginid] = account.token || loginInfo[0].token;
                            apiClientAccounts[account.loginid] = {
                                ...account,
                                token: account.token || loginInfo[0].token,
                            };
                        });

                        localStorage.setItem('accountsList', JSON.stringify(apiAccountsList));
                        localStorage.setItem('clientAccounts', JSON.stringify(apiClientAccounts));

                        const activeLoginId = authorize.loginid || authorize.account_list[0]?.loginid;
                        localStorage.setItem('active_loginid', activeLoginId);
                        localStorage.setItem('authToken', loginInfo[0].token);

                        api.disconnect();
                        return;
                    }

                    if (error) {
                        console.error('[Auth] Authorization error:', error);
                        if (error.code === 'InvalidToken') {
                            setIsAuthComplete(true);
                            const is_tmb_enabled = window.is_tmb_enabled === true;
                            const isManualToken = loginInfo[0]?.loginid === 'MANUAL';

                            if (isManualToken) {
                                console.warn('[Auth] Manual token invalid - but keeping session for trading');
                                // Do NOT clear auth data or emit event for manual tokens
                            } else if (Cookies.get('logged_state') === 'true' && !is_tmb_enabled) {
                                globalObserver.emit('InvalidToken', { error });
                            } else if (Cookies.get('logged_state') === 'false') {
                                // Shield manual auth from OIDC-triggered clearance
                                const is_manual_auth = localStorage.getItem('is_manual_auth') === 'true';
                                if (!is_manual_auth) {
                                    clearAuthData();
                                } else {
                                    console.log('[Auth] Shielding manual session from OIDC clearance');
                                    setIsAuthComplete(true);
                                }
                            }
                        }
                    }

                    api.disconnect();
                }
            } catch (apiError) {
                console.error('[Auth] API connection/authorization error:', apiError);
                // Still set token for fallback - app can proceed
                localStorage.setItem('authToken', loginInfo[0].token);
                localStorage.setItem('active_loginid', loginInfo[0].loginid);
            }

            localStorage.setItem('authToken', loginInfo[0].token);
            localStorage.setItem('active_loginid', loginInfo[0].loginid);
        } catch (error) {
            console.error('Error setting up login info:', error);
        }
    }
};

export const AuthWrapper = () => {
    const [isAuthComplete, setIsAuthComplete] = React.useState(false);
    const { loginInfo, paramsToDelete } = URLUtils.getLoginInfoFromURL();
    const { isOnline } = useOfflineDetection();

    React.useEffect(() => {
        const initializeAuth = async () => {
            console.log('[Auth] Initializing authentication...');
            try {
                const urlParams = new URL(window.location.href).searchParams;
                const manualToken = urlParams.get('token');

                if (manualToken && manualToken.length > 5) {
                    console.log('[Auth] Manual token detected:', manualToken.substring(0, 8) + '...');
                    console.log('[Auth] Setting up manual token login...');
                    console.log(
                        '%c⚠️ IMPORTANT: Enable CORS Extension!',
                        'color: #ff9800; font-size: 14px; font-weight: bold;'
                    );
                    console.log(
                        '%cFor manual token login to work, you need a CORS extension:',
                        'color: #ff9800; font-size: 12px;'
                    );
                    console.log(
                        '%c1. Install "Allow CORS: Access-Control-Allow-Origin" Chrome extension',
                        'color: #4caf50; font-size: 12px;'
                    );
                    console.log(
                        '%c2. Click the extension icon and enable it for this site',
                        'color: #4caf50; font-size: 12px;'
                    );
                    console.log('%c3. Refresh the page after enabling', 'color: #4caf50; font-size: 12px;');

                    // Set localStorage IMMEDIATELY so app can proceed
                    localStorage.setItem('authToken', manualToken);
                    localStorage.setItem('active_loginid', 'MANUAL');
                    localStorage.setItem('is_manual_auth', 'true');
                    localStorage.setItem('accountsList', JSON.stringify({ MANUAL: manualToken }));
                    localStorage.setItem(
                        'clientAccounts',
                        JSON.stringify({
                            MANUAL: {
                                loginid: 'MANUAL',
                                token: manualToken,
                                currency: 'USD',
                            },
                        })
                    );

                    const manualLoginInfo = [
                        {
                            loginid: 'MANUAL',
                            token: manualToken,
                            currency: 'USD',
                        },
                    ];

                    // Attempt API authorization in background (no timeout race)
                    // Let api-base.ts handle its own timeout
                    console.log('[Auth] Attempting API authorization...');
                    setLocalStorageToken(manualLoginInfo, ['token'], setIsAuthComplete, isOnline)
                        .then(() => {
                            console.log('[Auth] Manual token API authorization completed successfully');
                        })
                        .catch(e => {
                            console.warn('[Auth] Manual token API authorization failed, but app will proceed:', e);
                            console.log(
                                '%c❌ If you see CORS errors, make sure the CORS extension is enabled!',
                                'color: #f44336; font-size: 14px; font-weight: bold;'
                            );
                        });
                } else {
                    console.log('[Auth] No manual token, checking URL for OAuth info');
                    await setLocalStorageToken(loginInfo, paramsToDelete, setIsAuthComplete, isOnline);
                }

                URLUtils.filterSearchParams(['lang']);
                console.log('[Auth] Authentication setup complete, rendering app');
                setIsAuthComplete(true);
            } catch (error) {
                console.error('[Auth] Authentication initialization failed:', error);
                setIsAuthComplete(true);
            }
        };

        // If offline, set auth complete immediately but still run initializeAuth
        // to save login info to localStorage for offline use
        if (!isOnline) {
            console.log('[Auth] Offline detected, proceeding with minimal auth');
            setIsAuthComplete(true);
        }

        initializeAuth();
    }, [loginInfo, paramsToDelete, isOnline]);

    // Add timeout for online scenarios to prevent infinite loading
    React.useEffect(() => {
        if (isOnline && !isAuthComplete) {
            console.log('[Auth] Setting online safety timeout');
            const timeout = setTimeout(() => {
                console.warn('[Auth] Online timeout reached, forcing completion');
                setIsAuthComplete(true);
            }, 10000); // 10 second timeout for online

            return () => clearTimeout(timeout);
        }
    }, [isOnline, isAuthComplete]);

    // Add timeout for offline scenarios to prevent infinite loading
    React.useEffect(() => {
        if (!isOnline && !isAuthComplete) {
            console.log('[Auth] Offline detected, setting auth timeout');
            const timeout = setTimeout(() => {
                console.log('[Auth] Offline timeout reached, proceeding without full auth');
                setIsAuthComplete(true);
            }, 2000); // 2 second timeout for offline

            return () => clearTimeout(timeout);
        }
    }, [isOnline, isAuthComplete]);

    const getLoadingMessage = () => {
        if (!isOnline) return localize('Loading offline mode...');
        return localize('Initializing...');
    };

    if (!isAuthComplete) {
        return <LoadingScreen message={getLoadingMessage()} />;
    }

    return <App />;
};
