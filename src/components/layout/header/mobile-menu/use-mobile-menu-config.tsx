import { ComponentProps, ReactNode, useMemo } from 'react';
import Livechat from '@/components/chat/Livechat';
import useIsLiveChatWidgetAvailable from '@/components/chat/useIsLiveChatWidgetAvailable';
import { generateOAuthURL, standalone_routes } from '@/components/shared';
import { useFirebaseCountriesConfig } from '@/hooks/firebase/useFirebaseCountriesConfig';
import useRemoteConfig from '@/hooks/growthbook/useRemoteConfig';
import { useIsIntercomAvailable } from '@/hooks/useIntercom';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import useTMB from '@/hooks/useTMB';
import RootStore from '@/stores/root-store';
import {
    LegacyAccountLimitsIcon,
    LegacyCashierIcon,
    LegacyChartsIcon,
    LegacyHelpCentreIcon,
    LegacyHomeOldIcon,
    LegacyLogout1pxIcon,
    LegacyProfileSmIcon,
    LegacyReportsIcon,
    LegacyResponsibleTradingIcon,
    LegacyTheme1pxIcon,
    LegacyWhatsappIcon,
} from '@deriv/quill-icons/Legacy';
import { BrandDerivLogoCoralIcon } from '@deriv/quill-icons/Logo';
import { useTranslations } from '@deriv-com/translations';
import { ToggleSwitch } from '@deriv-com/ui';
import { URLConstants } from '@deriv-com/utils';

export type TSubmenuSection = 'accountSettings' | 'cashier' | 'reports';

//IconTypes
type TMenuConfig = {
    LeftComponent: React.ElementType;
    RightComponent?: ReactNode;
    as: 'a' | 'button';
    href?: string;
    label: ReactNode;
    onClick?: () => void;
    removeBorderBottom?: boolean;
    submenu?: TSubmenuSection;
    target?: ComponentProps<'a'>['target'];
    isActive?: boolean;
}[];

const useMobileMenuConfig = (client?: RootStore['client']) => {
    const { localize } = useTranslations();
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();

    const { data } = useRemoteConfig(true);
    const { cs_chat_whatsapp } = data;

    const { is_livechat_available } = useIsLiveChatWidgetAvailable();
    const icAvailable = useIsIntercomAvailable();

    // Get current account information for dependency tracking
    const is_logged_in = client?.is_logged_in;
    const accounts = client?.accounts || {};

    const menuConfig = useMemo(
        (): TMenuConfig[] => {
            const config: TMenuConfig[] = [
                [
                    {
                        as: 'button',
                        label: localize('Dark theme'),
                        LeftComponent: LegacyTheme1pxIcon,
                        RightComponent: <ToggleSwitch value={is_dark_mode_on} onChange={toggleTheme} />,
                    },
                ],
            ];

            if (is_logged_in) {
                config.push([
                    {
                        as: 'button',
                        label: localize('Log out'),
                        LeftComponent: LegacyLogout1pxIcon,
                        onClick: () => client?.logout(),
                    },
                ]);
            } else {
                config.push([
                    {
                        as: 'button',
                        label: localize('Log in'),
                        LeftComponent: LegacyLogout1pxIcon, // Reusing icon for simplicity or find another
                        onClick: () => {
                            const loginButton = document.querySelector('.auth-actions button:first-child') as HTMLButtonElement;
                            if (loginButton) {
                                loginButton.click();
                            } else {
                                // Fallback to generateOAuthURL if button not found
                                window.location.assign(generateOAuthURL());
                            }
                        },
                    },
                    {
                        as: 'button',
                        label: localize('Sign up'),
                        LeftComponent: LegacyProfileSmIcon,
                        onClick: () => {
                            window.open(URLConstants.signup);
                        },
                    },
                ]);
            }

            return config;
        },
        [is_dark_mode_on, toggleTheme, is_logged_in, client, localize]
    );

    return {
        config: menuConfig,
    };
};

export default useMobileMenuConfig;
