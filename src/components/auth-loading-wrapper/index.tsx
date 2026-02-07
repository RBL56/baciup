import React from 'react';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useAuth } from '@/contexts/AuthContext';
import useTMB from '@/hooks/useTMB';
import LoadingScreen from '@/components/loading-screen/loading-screen';

type AuthLoadingWrapperProps = {
    children: React.ReactNode;
};

const AuthLoadingWrapper = ({ children }: AuthLoadingWrapperProps) => {
    const { isSingleLoggingIn } = useOauth2();
    const { isLoadingUserData, hasToken } = useAuth();
    const { isTmbEnabled } = useTMB();
    const [forceComplete, setForceComplete] = React.useState(false);

    const is_tmb_enabled = isTmbEnabled() || window.is_tmb_enabled === true;

    // Safety timeout for single sign-on
    React.useEffect(() => {
        if (isSingleLoggingIn && !is_tmb_enabled) {
            const timeout = setTimeout(() => {
                console.log('[AuthLoadingWrapper] SSO safety timeout reached, forcing completion');
                setForceComplete(true);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [isSingleLoggingIn, is_tmb_enabled]);

    // Show loading screen during single sign-on process
    if (isSingleLoggingIn && !is_tmb_enabled && !forceComplete) {
        return <LoadingScreen message="Signing in..." />;
    }

    // Show loading screen when we have a token but user data is still loading
    // This ensures we wait for complete initialization after OAuth redirect
    if (isLoadingUserData && hasToken) {
        return <LoadingScreen message="Loading your account..." />;
    }

    return <>{children}</>;
};

export default AuthLoadingWrapper;
