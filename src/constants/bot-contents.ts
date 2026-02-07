type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    FREE_BOTS: 3,
    DCIRCLE: 4,
    SPEED_BOT: 5,
    COPY_TRADING: 6,
    TRADINGVIEW: 7,
    TRADING_PLANS: 8,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-free-bots',
    'id-dcircle',
    'id-speed-bot',
    'id-copy-trading',
    'id-tradingview',
    'id-trading-plans',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
