import { useMemo } from 'react';
import { useStore } from './useStore';

const currency_to_icon_mapper: Record<string, Record<'light' | 'dark', string>> = {
    Demo: {
        dark: 'IcWalletDerivDemoDark',
        light: 'IcWalletDerivDemoLight',
    },
    USD: {
        dark: 'IcWalletCurrencyUsd',
        light: 'IcWalletCurrencyUsd',
    },
    EUR: {
        dark: 'IcWalletCurrencyEur',
        light: 'IcWalletCurrencyEur',
    },
    AUD: {
        dark: 'IcWalletCurrencyAud',
        light: 'IcWalletCurrencyAud',
    },
    GBP: {
        dark: 'IcWalletCurrencyGbp',
        light: 'IcWalletCurrencyGbp',
    },
    BTC: {
        dark: 'IcWalletBitcoinDark',
        light: 'IcWalletBitcoinLight',
    },
    ETH: {
        dark: 'IcWalletEthereumDark',
        light: 'IcWalletEthereumLight',
    },
    USDT: {
        dark: 'IcWalletTetherDark',
        light: 'IcWalletTetherLight',
    },
    eUSDT: {
        dark: 'IcWalletTetherDark',
        light: 'IcWalletTetherLight',
    },
    tUSDT: {
        dark: 'IcWalletTetherDark',
        light: 'IcWalletTetherLight',
    },
    UST: {
        dark: 'IcWalletTetherDark',
        light: 'IcWalletTetherLight',
    },
    LTC: {
        dark: 'IcWalletLiteCoinDark',
        light: 'IcWalletLiteCoinLight',
    },
    USDC: {
        dark: 'IcWalletUsdCoinDark',
        light: 'IcWalletUsdCoinLight',
    },
    XRP: {
        dark: 'IcWalletXrpDark',
        light: 'IcWalletXrpLight',
    },
};

/** A custom hook to get the list of wallets for the current user. */
const useStoreWalletAccountsList = () => {
    const store = useStore();

    // Use empty objects as fallbacks when store is null
    const client = store?.client || { accounts: {}, all_accounts_balance: { accounts: {} } };
    const { accounts, all_accounts_balance } = client;

    // Add additional information to each wallet.
    const wallets = useMemo(() => {
        if (!store) return [];

        return (
            Object.keys(accounts)
                ?.filter(id => accounts[id].account_category === 'trading')
                ?.map(id => {
                    const account = accounts?.[id];

                    const loginid = id;
                    const currency = account.currency;
                    const is_disabled = Boolean(account.is_disabled);
                    const is_virtual = Boolean(account.is_virtual);
                    const is_wallet = account.account_category === 'wallet';

                    const icon_type = is_virtual && 'demo';
                    const landing_company_name = account.landing_company_name?.replace('maltainvest', 'malta');
                    const is_malta_wallet = landing_company_name === 'malta';

                    const dtrade_loginid = is_wallet
                        ? (account?.linked_to?.find(acc => acc?.platform === 'dtrade')?.loginid || loginid)
                        : loginid;

                    // Improved balance retrieval with comprehensive fallback chain
                    let dtrade_balance = 0;

                    // Source priority:
                    // 1. all_accounts_balance (the most reliable source for non-active accounts)
                    // 2. Client object's current balance (if it's the active account)
                    // 3. The account object's balance property
                    // 4. Any other balance indicators

                    const balanceFromAllAccounts = all_accounts_balance?.accounts?.[dtrade_loginid ?? '']?.balance;

                    if (balanceFromAllAccounts !== undefined) {
                        dtrade_balance = parseFloat(balanceFromAllAccounts.toString());
                    } else if (dtrade_loginid === client.loginid) {
                        // Active account fallback
                        dtrade_balance = parseFloat(client.balance) || 0;
                    } else {
                        // Other fallbacks
                        const balanceFromAccount = (accounts?.[dtrade_loginid ?? ''] as any)?.balance;
                        const dtradeBalanceFromAccount = (accounts?.[dtrade_loginid ?? ''] as any)?.dtrade_balance;
                        const balanceFromWallet = (account as any).balance;

                        dtrade_balance = balanceFromAccount ??
                            dtradeBalanceFromAccount ??
                            balanceFromWallet ??
                            0;

                        // Ensure it's a number
                        if (typeof dtrade_balance !== 'number') {
                            const strValue = String(dtrade_balance);
                            dtrade_balance = parseFloat(strValue) || 0;
                        }
                    }

                    const is_dtrader_account_disabled = Boolean(accounts?.[dtrade_loginid ?? '']?.is_disabled) || is_disabled;

                    const wallet_currency_type = is_virtual ? 'Demo' : currency || '';
                    const icons = currency_to_icon_mapper[wallet_currency_type];

                    const gradients = {
                        /** The gradient class name for the wallet header background. */
                        header: {
                            dark: `wallet-header__${wallet_currency_type.toLowerCase()}-bg--dark`,
                            light: `wallet-header__${wallet_currency_type.toLowerCase()}-bg`,
                        },
                        /** The gradient class name for the wallet card background. */
                        card: {
                            dark: `wallet-card__${wallet_currency_type.toLowerCase()}-bg--dark`,
                            light: `wallet-card__${wallet_currency_type.toLowerCase()}-bg`,
                        },
                    };

                    return {
                        ...account,
                        dtrade_loginid,
                        dtrade_balance,
                        icons,
                        icon_type,
                        is_disabled,
                        is_virtual,
                        is_malta_wallet,
                        landing_company_name,
                        loginid,
                        gradients,
                        is_dtrader_account_disabled,
                        is_wallet,
                    } as const;
                }) || []
        );
    }, [store, accounts, all_accounts_balance?.accounts, client.balance]);

    // Sort wallet accounts alphabetically by fiat, crypto, then virtual.
    const sorted_wallets = useMemo(() => {
        if (!wallets || wallets.length === 0) return [];

        return [...wallets].sort((a, b) => {
            if (a.is_virtual !== b.is_virtual) {
                return a.is_virtual ? -1 : 1;
            }

            return (a.currency || 'USD').localeCompare(b.currency || 'USD');
        });
    }, [wallets]);

    return {
        /** List of wallets for current user. */
        data: sorted_wallets,
        /** Indicating whether the user has a wallet */
        has_wallet: sorted_wallets && sorted_wallets.length > 0,
    };
};

export default useStoreWalletAccountsList;
