import { ReactNode } from 'react';
import { standalone_routes } from '@/components/shared';
import {
    LegacyCashierIcon as CashierLogo,
    LegacyHomeNewIcon as TradershubLogo,
    LegacyReportsIcon as ReportsLogo,
} from '@deriv/quill-icons/Legacy';
import { DerivProductBrandLightDerivBotLogoWordmarkIcon as DerivBotLogo } from '@deriv/quill-icons/Logo';
import { localize } from '@deriv-com/translations';

export type PlatformsConfig = {
    active: boolean;
    buttonIcon: ReactNode;
    description: string;
    href: string;
    icon: ReactNode;
    showInEU: boolean;
};

export type MenuItemsConfig = {
    as: 'a' | 'button';
    href: string;
    icon: ReactNode;
    label: string;
};

export type TAccount = {
    balance: string;
    currency: string;
    icon: React.ReactNode;
    isActive: boolean;
    isEu: boolean;
    isVirtual: boolean;
    loginid: string;
    token: string;
    type: string;
};

export const platformsConfig: PlatformsConfig[] = [
    {
        active: true,
        buttonIcon: <DerivBotLogo height={25} width={94} />,
        description: localize('Automated trading at your fingertips. No coding needed.'),
        href: standalone_routes.bot,
        icon: <DerivBotLogo height={32} width={121} />,
        showInEU: false,
    },
];

export const TRADERS_HUB_LINK_CONFIG = {
    as: 'a',
    href: standalone_routes.traders_hub,
    icon: <TradershubLogo iconSize='xs' />,
    label: "Trader's Hub",
};

export const MenuItems: MenuItemsConfig[] = [
    {
        as: 'a',
        href: standalone_routes.cashier,
        icon: <CashierLogo iconSize='xs' />,
        label: localize('Cashier'),
    },
    {
        as: 'a',
        href: standalone_routes.reports,
        icon: <ReportsLogo iconSize='xs' />,
        label: localize('Reports'),
    },
];
