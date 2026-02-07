import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { ContentFlag, getDecimalPlaces, isEmptyObject } from '@/components/shared';
import { isEuCountry, isMultipliersOnly, isOptionsBlocked } from '@/components/shared/common/utility';
import { removeCookies } from '@/components/shared/utils/storage/storage';
import { api_base } from '@/external/bot-skeleton';
import {
    authData$,
    balance$,
    setAccountList,
    setAuthData,
    setIsAuthorized,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import type { TAuthData, TLandingCompany } from '@/types/api-types';
import type { Balance, GetAccountStatus, GetSettings, WebsiteStatus } from '@deriv/api-types';
import { Analytics } from '@deriv-com/analytics';

const eu_shortcode_regex = /^maltainvest$/;
const eu_excluded_regex = /^mt$/;
export default class ClientStore {
    loginid = '';
    account_list: TAuthData['account_list'] = [];
    balance = '0';
    currency = 'AUD';
    is_logged_in = false;
    account_status: GetAccountStatus | undefined;
    account_settings: GetSettings | undefined;
    website_status: WebsiteStatus | undefined;
    landing_companies: TLandingCompany | undefined;
    upgradeable_landing_companies: string[] = [];
    accounts: Record<string, TAuthData['account_list'][number]> = {};
    is_landing_company_loaded: boolean | undefined;
    all_accounts_balance: Balance | null = null;
    is_logging_out = false;
    is_switching = false;
    is_client_initialized = false;

    // TODO: fix with self exclusion
    updateSelfExclusion = () => { };

    virtual_hook_settings = {
        is_enabled: false,
        enable_after_initial: 'Immediately', // 'Immediately' or number of trades
        virtual_trades_condition: 2, // Number of consecutive losses
        real_trades_condition: 'Immediately', // 'Immediately' or number of trades
    };

    setVirtualHookSettings = (settings: Partial<typeof this.virtual_hook_settings>) => {
        this.virtual_hook_settings = { ...this.virtual_hook_settings, ...settings };
    };

    is_virtual_hook_modal_open = false;

    setVirtualHookModalOpen = (is_open: boolean) => {
        this.is_virtual_hook_modal_open = is_open;
    };

    private authDataSubscription: { unsubscribe: () => void } | null = null;
    private balanceSubscription: { unsubscribe: () => void } | null = null;

    constructor() {
        // Hydrate from localStorage immediately
        const active_loginid = localStorage.getItem('active_loginid');
        const auth_token = localStorage.getItem('authToken');
        const client_accounts = localStorage.getItem('clientAccounts');
        const accounts_list = localStorage.getItem('accountsList');

        if (active_loginid && auth_token) {
            this.loginid = active_loginid;
            this.is_logged_in = true;
            this.is_client_initialized = false;

            // Try to hydrate from the dedicated all_accounts_balance key first
            const stored_all_balances = localStorage.getItem('client.all_accounts_balance');
            if (stored_all_balances) {
                try {
                    this.all_accounts_balance = JSON.parse(stored_all_balances);
                } catch (e) {
                    console.error('Failed to parse client.all_accounts_balance', e);
                }
            }

            if (client_accounts && !this.all_accounts_balance) {
                try {
                    this.accounts = JSON.parse(client_accounts);

                    // Hydrate all_accounts_balance from client_accounts to ensure last known balances are visible
                    const hydrated_balances: Record<string, { balance: number; currency: string }> = {};
                    Object.values(this.accounts).forEach(account => {
                        if (account.loginid && (account.balance !== undefined || (account as any).dtrade_balance !== undefined)) {
                            hydrated_balances[account.loginid] = {
                                balance: parseFloat(account.balance?.toString() || (account as any).dtrade_balance?.toString() || '0'),
                                currency: account.currency || 'USD'
                            };
                        }
                    });

                    if (Object.keys(hydrated_balances).length > 0) {
                        this.all_accounts_balance = {
                            accounts: hydrated_balances,
                        } as any;
                    }
                } catch (e) {
                    console.error('Failed to parse clientAccounts during hydration', e);
                }
            } else if (client_accounts) {
                // Even if we loaded balances, we still need to load accounts
                try {
                    this.accounts = JSON.parse(client_accounts);
                } catch (e) {
                    console.error('Failed to parse clientAccounts for accounts', e);
                }
            }

            if (accounts_list) {
                try {
                    this.account_list = Object.keys(JSON.parse(accounts_list)).map(loginid => ({
                        loginid,
                        token: JSON.parse(accounts_list)[loginid],
                    }));
                } catch (e) {
                    console.error('Failed to parse accountsList during hydration', e);
                }
            }
        }

        // Subscribe to auth data changes
        this.authDataSubscription = authData$.subscribe(authData => {
            if (authData) {
                this.setLoginId(authData.loginid);
                this.setIsLoggedIn(true);
                this.setAccountList(authData.account_list);

                if (authData.currency) {
                    this.setCurrency(authData.currency);
                }

                if (authData.balance !== undefined) {
                    this.setBalance(authData.balance.toString());
                    this.setAllAccountsBalance({
                        balance: authData.balance,
                        currency: authData.currency ?? this.currency,
                        loginid: authData.loginid,
                    });
                }

                if (authData.upgradeable_landing_companies) {
                    this.setUpgradeableLandingCompanies(authData.upgradeable_landing_companies);
                }

                if (authData.country) {
                    this.setAccountSettings({
                        ...this.account_settings,
                        country_code: authData.country,
                    } as any);
                }
            }
        });

        this.balanceSubscription = balance$.subscribe(balance => {
            if (balance) {
                this.setAllAccountsBalance(balance);
            }
        });

        makeObservable(this, {
            accounts: observable,
            account_list: observable,
            account_settings: observable,
            account_status: observable,
            all_accounts_balance: observable,
            balance: observable,
            currency: observable,
            is_landing_company_loaded: observable,
            is_logged_in: observable,
            landing_companies: observable,
            loginid: observable,
            upgradeable_landing_companies: observable,
            website_status: observable,
            is_logging_out: observable,
            is_switching: observable,
            virtual_hook_settings: observable,
            setVirtualHookSettings: action,
            is_virtual_hook_modal_open: observable,
            setVirtualHookModalOpen: action,
            active_accounts: computed,
            clients_country: computed,
            is_bot_allowed: computed,
            is_eu: computed,
            is_eu_country: computed,
            is_eu_or_multipliers_only: computed,
            is_low_risk: computed,
            is_multipliers_only: computed,
            is_options_blocked: computed,
            is_virtual: computed,
            landing_company_shortcode: computed,
            residence: computed,
            real_account_loginid: computed,
            should_show_eu_error: computed,
            logout: action,
            setAccountList: action,
            setAccountSettings: action,
            setAccountStatus: action,
            setAllAccountsBalance: action,
            setBalance: action,
            updateBalanceOnTrade: action,
            setCurrency: action,
            setIsLoggedIn: action,
            setIsLoggingOut: action,
            setLandingCompany: action,
            setLoginId: action,
            setWebsiteStatus: action,
            setUpgradeableLandingCompanies: action,
            updateTncStatus: action,
            switchAccount: action,
            is_client_initialized: observable,
            setClientInitialized: action,
            is_trading_experience_incomplete: computed,
            is_cr_account: computed,
            account_open_date: computed,
        });
    }

    get active_accounts() {
        return this.accounts instanceof Object
            ? Object.values(this.accounts).filter(account => !account.is_disabled)
            : [];
    }

    get clients_country() {
        return this.website_status?.clients_country;
    }

    get is_bot_allowed() {
        return this.isBotAllowed();
    }
    get is_trading_experience_incomplete() {
        return this.account_status?.status?.some(status => status === 'trading_experience_not_complete');
    }

    get is_eu() {
        if (!this.landing_companies) return false;
        const { gaming_company, financial_company, mt_gaming_company } = this.landing_companies;
        const financial_shortcode = financial_company?.shortcode;
        const gaming_shortcode = gaming_company?.shortcode;
        const mt_gaming_shortcode = mt_gaming_company?.financial.shortcode || mt_gaming_company?.swap_free.shortcode;
        const is_current_mf = this.landing_company_shortcode === 'maltainvest';
        return (
            is_current_mf || //is_currently logged in mf account via tradershub
            (financial_shortcode || gaming_shortcode || mt_gaming_shortcode
                ? (eu_shortcode_regex.test(financial_shortcode) && gaming_shortcode !== 'svg') ||
                eu_shortcode_regex.test(gaming_shortcode)
                : eu_excluded_regex.test(this.residence))
        );
    }

    get is_eu_country() {
        const country = this.website_status?.clients_country;
        if (country) return isEuCountry(country);
        return false;
    }

    get is_low_risk() {
        const { gaming_company, financial_company } = this.landing_companies ?? {};
        const low_risk_landing_company =
            financial_company?.shortcode === 'maltainvest' && gaming_company?.shortcode === 'svg';
        return low_risk_landing_company;
    }

    get should_show_eu_error() {
        if (!this.is_landing_company_loaded) {
            return false;
        }
        return this.is_eu && !this.is_low_risk;
    }

    get landing_company_shortcode() {
        if (this.accounts[this.loginid]) {
            return this.accounts[this.loginid].landing_company_name;
        }
        return undefined;
    }

    get residence() {
        if (this.is_logged_in) {
            return this.account_settings?.country_code ?? '';
        }
        return '';
    }

    get is_options_blocked() {
        return isOptionsBlocked(this.residence);
    }

    get is_multipliers_only() {
        return isMultipliersOnly(this.residence);
    }

    get is_eu_or_multipliers_only() {
        // Check whether account is multipliers only and if the account is from eu countries
        return !this.is_multipliers_only ? !isEuCountry(this.residence) : !this.is_multipliers_only;
    }

    get is_virtual() {
        return !isEmptyObject(this.accounts) && this.accounts[this.loginid] && !!this.accounts[this.loginid].is_virtual;
    }

    get all_loginids() {
        return !isEmptyObject(this.accounts) ? Object.keys(this.accounts) : [];
    }

    get virtual_account_loginid() {
        return this.all_loginids.find(loginid => !!this.accounts[loginid].is_virtual);
    }

    get real_account_loginid() {
        return this.all_loginids.find(loginid => !this.accounts[loginid].is_virtual);
    }

    get content_flag() {
        const { is_logged_in, landing_companies, residence, is_landing_company_loaded } = this;
        if (is_landing_company_loaded) {
            const { financial_company, gaming_company } = landing_companies ?? {};

            //this is a conditional check for countries like Australia/Norway which fulfills one of these following conditions
            const restricted_countries = financial_company?.shortcode === 'svg' || gaming_company?.shortcode === 'svg';

            if (!is_logged_in) return '';
            if (!gaming_company?.shortcode && financial_company?.shortcode === 'maltainvest') {
                if (this.is_virtual) return ContentFlag.EU_DEMO;
                return ContentFlag.EU_REAL;
            } else if (
                financial_company?.shortcode === 'maltainvest' &&
                gaming_company?.shortcode === 'svg' &&
                !this.is_virtual
            ) {
                if (this.is_eu) return ContentFlag.LOW_RISK_CR_EU;
                return ContentFlag.LOW_RISK_CR_NON_EU;
            } else if (
                ((financial_company?.shortcode === 'svg' && gaming_company?.shortcode === 'svg') ||
                    restricted_countries) &&
                !this.is_virtual
            ) {
                return ContentFlag.HIGH_RISK_CR;
            }

            // Default Check
            if (isEuCountry(residence)) {
                if (this.is_virtual) return ContentFlag.EU_DEMO;
                return ContentFlag.EU_REAL;
            }
            if (this.is_virtual) return ContentFlag.CR_DEMO;
        }
        return ContentFlag.LOW_RISK_CR_NON_EU;
    }

    get is_cr_account() {
        return this.loginid?.startsWith('CR');
    }

    get should_hide_header() {
        return (this.is_eu && this.should_show_eu_error) || (!this.is_logged_in && this.is_eu_country);
    }

    get account_open_date() {
        if (isEmptyObject(this.accounts) || !this.accounts[this.loginid]) return undefined;
        return Object.keys(this.accounts[this.loginid]).includes('created_at')
            ? this.accounts[this.loginid].created_at
            : undefined;
    }

    isBotAllowed = () => {
        // Stop showing Bot, DBot, DSmartTrader for logged out EU IPs
        if (!this.is_logged_in && this.is_eu_country) return false;
        const is_mf = this.landing_company_shortcode === 'maltainvest';
        return this.is_virtual ? this.is_eu_or_multipliers_only : !is_mf && !this.is_options_blocked;
    };

    setLoginId = (loginid: string) => {
        this.loginid = loginid;
    };

    setAccountList = (account_list?: TAuthData['account_list']) => {
        console.log('ClientStore: setAccountList', account_list);
        this.accounts = {};
        account_list?.forEach(account => {
            this.accounts[account.loginid] = account;
        });
        if (account_list) this.account_list = account_list;
    };

    setBalance = (balance: string) => {
        const start_time = performance.now();
        this.balance = balance;
        const update_time = performance.now() - start_time;

        // Log only if update takes longer than expected (> 1ms indicates potential issue)
        if (update_time > 1) {
            console.warn(`[ClientStore] setBalance took ${update_time.toFixed(2)}ms (expected < 1ms)`);
        }
    };

    updateBalanceOnTrade = (tradeAmount: number) => {
        const start_time = performance.now();

        // Optimistically update balance when a trade is placed
        const currentBalance = parseFloat(this.balance) || 0;
        const newBalance = currentBalance - tradeAmount;
        this.setBalance(newBalance.toFixed(getDecimalPlaces(this.currency)));
        this.setAllAccountsBalance({
            balance: newBalance,
            currency: this.currency,
            loginid: this.loginid,
        });

        const update_time = performance.now() - start_time;

        console.log(`[ClientStore] Balance updated on trade in ${update_time.toFixed(2)}ms:`, {
            previousBalance: currentBalance,
            tradeAmount,
            newBalance,
            currency: this.currency
        });
    };

    setCurrency = (currency: string) => {
        this.currency = currency;
    };

    setIsLoggedIn = (is_logged_in: boolean) => {
        this.is_logged_in = is_logged_in;
    };

    getCurrency = () => {
        const clientAccounts = JSON.parse(localStorage.getItem('clientAccounts') ?? '{}');
        return clientAccounts[this.loginid]?.currency ?? '';
    };

    getToken = () => {
        const accountList = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
        return accountList[this.loginid] ?? '';
    };

    setAccountStatus(status: GetAccountStatus | undefined) {
        this.account_status = status;
    }

    setAccountSettings(settings: GetSettings | undefined) {
        try {
            const is_equal_settings = JSON.stringify(settings) === JSON.stringify(this.account_settings);
            if (!is_equal_settings) {
                this.account_settings = settings;
            }
        } catch (error) {
            console.error('setAccountSettings error', error);
        }
    }

    updateTncStatus(landing_company_shortcode: string, status: number) {
        try {
            if (!this.account_settings) return;

            const updated_settings = {
                ...this.account_settings,
                tnc_status: {
                    ...this.account_settings.tnc_status,
                    [landing_company_shortcode]: status,
                },
            };

            this.setAccountSettings(updated_settings);
        } catch (error) {
            console.error('updateTncStatus error', error);
        }
    }

    setWebsiteStatus(status: WebsiteStatus | undefined) {
        this.website_status = status;
    }

    setLandingCompany(landing_companies: TLandingCompany) {
        this.landing_companies = landing_companies;
        this.is_landing_company_loaded = true;
    }

    setUpgradeableLandingCompanies = (upgradeable_landing_companies: string[]) => {
        this.upgradeable_landing_companies = upgradeable_landing_companies;
    };

    setAllAccountsBalance = (balance_data: Balance | undefined) => {
        if (!balance_data) return;

        // Initialize all_accounts_balance if it's null
        if (!this.all_accounts_balance) {
            this.all_accounts_balance = { accounts: {} } as any;
        }

        // Create a completely new object to ensure MobX reactivity
        let newAllAccountsBalance: Balance;

        if (balance_data.accounts) {
            // Bulk update from 'account: all'
            console.log('[ClientStore] Processing bulk balance update (all accounts)');
            newAllAccountsBalance = {
                ...balance_data,
                accounts: {
                    ...(this.all_accounts_balance?.accounts || {}),
                    ...balance_data.accounts
                }
            };
        } else if (balance_data.loginid) {
            // Single account update (often from ticks or authorize)
            const updatedAccounts = {
                ...(this.all_accounts_balance?.accounts || {}),
                [balance_data.loginid]: {
                    balance: balance_data.balance,
                    currency: balance_data.currency
                }
            } as any;

            newAllAccountsBalance = {
                ...this.all_accounts_balance,
                ...balance_data,
                accounts: updatedAccounts
            };
        } else {
            // Fallback: just update the top-level balance data
            newAllAccountsBalance = {
                ...this.all_accounts_balance,
                ...balance_data
            };
        }

        // Assign the completely new object
        this.all_accounts_balance = newAllAccountsBalance;

        // Persist to localStorage
        try {
            localStorage.setItem('client.all_accounts_balance', JSON.stringify(this.all_accounts_balance));
        } catch (e) {
            console.error('Failed to persist all_accounts_balance', e);
        }

        // Sync local flat properties for ALL accounts in the store
        if (newAllAccountsBalance.accounts) {
            Object.entries(newAllAccountsBalance.accounts).forEach(([accLoginId, accData]) => {
                if (this.accounts[accLoginId] && accData.balance !== undefined) {
                    const parsedBalance = parseFloat(accData.balance.toString());
                    if (this.accounts[accLoginId].balance !== parsedBalance) {
                        console.log(`[ClientStore] Syncing account balance for ${accLoginId}: ${parsedBalance}`);
                        this.accounts[accLoginId].balance = parsedBalance;
                    }
                }
            });
        }

        // Sync local flat properties for the active account (ensure it is definitely updated)
        const activeAccountBalance = this.all_accounts_balance?.accounts?.[this.loginid];
        if (activeAccountBalance) {
            const newBalance = activeAccountBalance.balance.toString();
            const newCurrency = activeAccountBalance.currency;

            if (this.balance !== newBalance || this.currency !== newCurrency) {
                console.log('ClientStore: Updating active account balance', {
                    loginid: this.loginid,
                    oldBalance: this.balance,
                    newBalance,
                    currency: newCurrency
                });

                this.setBalance(newBalance);
                this.setCurrency(newCurrency);
            }
        }
    };

    setIsLoggingOut = (is_logging_out: boolean) => {
        this.is_logging_out = is_logging_out;
    };

    logout = async () => {
        // reset all the states
        this.account_list = [];
        this.account_status = undefined;
        this.account_settings = undefined;
        this.landing_companies = undefined;
        this.accounts = {};
        this.is_logged_in = false;
        this.loginid = '';
        this.balance = '0';
        this.currency = 'USD';

        this.is_landing_company_loaded = false;

        this.all_accounts_balance = null;

        localStorage.removeItem('active_loginid');
        localStorage.removeItem('accountsList');
        localStorage.removeItem('authToken');
        localStorage.removeItem('clientAccounts');
        removeCookies('client_information');

        setIsAuthorized(false);
        setAccountList([]);
        setAuthData(null);

        this.setIsLoggingOut(false);

        Analytics.reset();

        // disable livechat
        window.LC_API?.close_chat?.();
        window.LiveChatWidget?.call('hide');

        // shutdown and initialize intercom
        if (window.Intercom) {
            window.Intercom('shutdown');
            window.DerivInterCom.initialize({
                hideLauncher: true,
                token: null,
            });
        }

        const resolveNavigation = () => {
            if (window.history.length > 1) {
                history.back();
            } else {
                window.location.replace('/');
            }
        };
        return api_base?.api
            ?.logout()
            .then(() => {
                resolveNavigation();
                return Promise.resolve();
            })
            .catch((error: Error) => {
                console.error('test Logout failed:', error);
                resolveNavigation();
                return Promise.reject(error);
            });
    };

    switchAccount = async (loginId: string) => {
        if (loginId === this.loginid) return;

        const account_list = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
        const token = account_list[loginId];

        if (!token) {
            console.error(`[ClientStore] No token found for loginId: ${loginId}`);
            return;
        }

        runInAction(() => {
            this.is_switching = true;
        });

        console.log(`[ClientStore] Switching to account: ${loginId}`);

        // 1. Update localStorage first
        localStorage.setItem('authToken', token);
        localStorage.setItem('active_loginid', loginId);

        // 2. Update store state immediately and sync observables
        runInAction(() => {
            this.loginid = loginId;
            this.is_logged_in = true;
            setAuthData(null); // Clear previous auth data to trigger re-authorization flow in observers
        });

        // 3. Re-initialize API
        if (api_base) {
            await api_base.init(true);
        }

        // 4. Update URL search parameters
        const search_params = new URLSearchParams(window.location.search);
        const account = this.accounts[loginId];
        if (account) {
            const account_param = account.is_virtual ? 'demo' : (account.currency || 'USD');
            search_params.set('account', account_param);
            sessionStorage.setItem('query_param_currency', account_param);
            window.history.pushState({}, '', `${window.location.pathname}?${search_params.toString()}`);
        }

        const account_type =
            loginId
                .match(/[a-zA-Z]+/g)
                ?.join('') || '';

        Analytics.setAttributes({
            account_type,
        });

        // 5. Force a reload to ensure clean state across the entire app and bot skeleton
        window.location.reload();
    };

    setClientInitialized = (is_initialized: boolean) => {
        this.is_client_initialized = is_initialized;
    };
}
