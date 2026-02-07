/**
 * Utility functions for authentication-related operations
 */
import Cookies from 'js-cookie';

/**
 * Clears authentication data from local storage and reloads the page
 */
export const clearAuthData = (is_reload: boolean = true): void => {
    localStorage.removeItem('accountsList');
    localStorage.removeItem('clientAccounts');
    localStorage.removeItem('callback_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('active_loginid');
    localStorage.removeItem('client.accounts');
    localStorage.removeItem('client.country');
    localStorage.removeItem('is_manual_auth');
    sessionStorage.removeItem('query_param_currency');
    if (is_reload) {
        location.reload();
    }
};

/**
 * Handles OIDC authentication failure by clearing auth data and showing logged out view
 * @param error - The error that occurred during OIDC authentication
 */
export const handleOidcAuthFailure = (error: any): void => {
    // Log the error
    console.error('OIDC authentication failed:', error);

    // Clear auth data
    localStorage.removeItem('authToken');
    localStorage.removeItem('active_loginid');
    localStorage.removeItem('clientAccounts');
    localStorage.removeItem('accountsList');

    // Set logged_state cookie to false
    const hostname = window.location.hostname;
    const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const isLocalhost = hostname === 'localhost';

    Cookies.set('logged_state', 'false', {
        ...(isIp || isLocalhost ? {} : { domain: hostname.split('.').slice(-2).join('.') }),
        expires: 30,
        path: '/',
        secure: true,
    });

    // Reload the page to show the logged out view
    window.location.reload();
};
