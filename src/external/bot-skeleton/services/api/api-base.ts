import Cookies from 'js-cookie';
import { Subject } from 'rxjs';
import CommonStore from '@/stores/common-store';
import { TAuthData } from '@/types/api-types';
import { clearAuthData } from '@/utils/auth-utils';
import { observer as globalObserver } from '../../utils/observer';
import { doUntilDone, socket_state } from '../tradeEngine/utils/helpers';
import {
    CONNECTION_STATUS,
    setAccountList,
    setAllAccountsBalance,
    setAuthData,
    setConnectionStatus,
    setIsAuthorized,
    setIsAuthorizing,
} from './observables/connection-status-stream';
import ApiHelpers from './api-helpers';
import { generateDerivApiInstance, V2GetActiveClientId, V2GetActiveToken } from './appId';
import chart_api from './chart-api';
import copy_trading_service from '@/services/copy-trading-service';

type CurrentSubscription = {
    id: string;
    unsubscribe: () => void;
};

type SubscriptionPromise = Promise<{
    subscription: CurrentSubscription;
}>;

type TApiBaseApi = {
    connection: {
        readyState: keyof typeof socket_state;
        addEventListener: (event: string, callback: () => void) => void;
        removeEventListener: (event: string, callback: () => void) => void;
    };
    send: (data: unknown) => void;
    disconnect: () => void;
    authorize: (token: string) => Promise<{ authorize: TAuthData; error: unknown }>;
    getSelfExclusion: () => Promise<unknown>;
    onMessage: () => {
        subscribe: (callback: (message: unknown) => void) => {
            unsubscribe: () => void;
        };
    };
} & ReturnType<typeof generateDerivApiInstance>;

class APIBase {
    api: TApiBaseApi | null = null;
    token: string = '';
    account_id: string = '';
    pip_sizes = {};
    account_info = {};
    is_running = false;
    subscriptions: CurrentSubscription[] = [];
    time_interval: ReturnType<typeof setInterval> | null = null;
    has_active_symbols = false;
    is_stopping = false;
    active_symbols = [];
    current_auth_subscriptions: SubscriptionPromise[] = [];
    is_authorized = false;
    active_symbols_promise: Promise<void> | null = null;
    subscriptions_ready = false;
    is_trading_ready = false;
    common_store: CommonStore | undefined;
    landing_company: string | null = null;
    bridge_subject = new Subject<any>();
    bridge_socket: WebSocket | null = null;

    unsubscribeAllSubscriptions = () => {
        this.current_auth_subscriptions?.forEach(subscription_promise => {
            subscription_promise.then(({ subscription }) => {
                if (subscription?.id) {
                    this.api?.send({
                        forget: subscription.id,
                    });
                }
            });
        });
        this.current_auth_subscriptions = [];
    };

    onsocketopen() {
        setConnectionStatus(CONNECTION_STATUS.OPENED);
    }

    onsocketclose() {
        setConnectionStatus(CONNECTION_STATUS.CLOSED);
        this.reconnectIfNotConnected();
    }

    async init(force_create_connection = false) {
        this.toggleRunButton(true);

        if (this.api) {
            this.unsubscribeAllSubscriptions();
        }

        if (!this.api || this.api?.connection.readyState !== 1 || force_create_connection) {
            if (this.api?.connection) {
                ApiHelpers.disposeInstance();
                setConnectionStatus(CONNECTION_STATUS.CLOSED);
                this.api.disconnect();
                this.api.connection.removeEventListener('open', this.onsocketopen.bind(this));
                this.api.connection.removeEventListener('close', this.onsocketclose.bind(this));
            }

            this.has_active_symbols = false;
            this.api = generateDerivApiInstance();
            this.api?.connection.addEventListener('open', this.onsocketopen.bind(this));
            this.api?.connection.addEventListener('close', this.onsocketclose.bind(this));

            // Unified message stream: combine Deriv API messages with Python Bridge messages
            if (this.api) {
                const originalOnMessage = this.api.onMessage.bind(this.api);
                this.api.onMessage = () => ({
                    subscribe: (callback: (message: any) => void) => {
                        const deriv_sub = originalOnMessage().subscribe(callback);
                        const bridge_sub = this.bridge_subject.subscribe(callback);
                        return {
                            unsubscribe: () => {
                                deriv_sub?.unsubscribe();
                                bridge_sub.unsubscribe();
                            },
                        };
                    },
                });

                // Monkey-patch api.send to intercept symbol requests and notify the Python bridge
                const originalSend = this.api.send.bind(this.api);
                this.api.send = (request: any) => {
                    const symbol = request.ticks || request.ticks_history;
                    if (symbol && typeof symbol === 'string') {
                        if (this.bridge_socket && this.bridge_socket.readyState === 1) {
                            // console.log(`[Python Bridge] Notifying symbol change: ${symbol}`);
                            this.bridge_socket.send(JSON.stringify({ action: 'change_symbol', symbol }));
                        }
                    }
                    return originalSend(request);
                };
            }
        }

        if (!this.has_active_symbols) {
            this.active_symbols_promise = this.getActiveSymbols();
        }

        this.initEventListeners();

        if (this.time_interval) clearInterval(this.time_interval);
        this.time_interval = null;

        if (V2GetActiveToken()) {
            setIsAuthorizing(true);
            await this.authorizeAndSubscribe();
        }

        // Global message listener
        this.api?.onMessage().subscribe(this.handleMessage.bind(this));

        // Periodic connection health check (every 30 seconds)
        if (this.time_interval) clearInterval(this.time_interval);
        this.time_interval = setInterval(() => {
            this.reconnectIfNotConnected();
        }, 30000);

        chart_api.init(force_create_connection);
        this.initPythonBridge();
    }

    initPythonBridge() {
        if (this.bridge_socket && this.bridge_socket.readyState === 1) return;

        // Skip Python bridge initialization if not on localhost to prevent console spam on Vercel/Production
        const isLocal = /localhost(:\d+)?$/i.test(window.location.hostname);
        if (!isLocal) {
            // console.log('[Python Bridge] Skipping initialization on non-localhost environment');
            return;
        }

        try {
            this.bridge_socket = new WebSocket('ws://localhost:8770');
            this.bridge_socket.onmessage = (msg: MessageEvent) => {
                try {
                    const data = JSON.parse(msg.data);
                    this.handleMessage(data);
                    this.bridge_subject.next(data);
                } catch (e) {
                    // console.error('Error parsing bridge message', e);
                }
            };
            this.bridge_socket.onopen = () => {
                // eslint-disable-next-line no-console
                console.log('%c[Python Bridge] Connected to ws://localhost:8770', 'color: #4caf50; font-weight: bold;');
            };
            this.bridge_socket.onclose = () => {
                this.bridge_socket = null;
                setTimeout(() => this.initPythonBridge(), 5000);
            };
            this.bridge_socket.onerror = () => {
                // Silently handle error as it might be frequent if bridge is not running
            };
        } catch (e) {
            // Silently handle error
        }
    }

    handleMessage(response: any) {
        if (response.msg_type === 'balance') {
            console.log('[APIBase] ✓ Balance update received:', {
                balance: response.balance?.balance,
                currency: response.balance?.currency,
                loginid: response.balance?.loginid,
            });
            setAllAccountsBalance(response.balance);
        }

        if (response.msg_type === 'transaction') {
            const tx = response.transaction;
            if (tx.action === 'buy' || tx.action === 'sell') {
                // Update balance if present in transaction for immediate UI feedback
                if (tx.balance_after !== undefined) {
                    console.log(`[APIBase] ✓ Balance update from transaction (${tx.action}):`, tx.balance_after);
                    setAllAccountsBalance({
                        balance: tx.balance_after,
                        currency: tx.currency,
                        loginid: this.account_id,
                    });
                }

                if (tx.action === 'buy') {
                    console.log('[APIBase] ⟴ Master Transaction detected, forwarding to CopyTradingService', tx);
                    copy_trading_service.onMasterTrade({
                        contract_type: tx.contract_type,
                        amount: tx.amount,
                        symbol: tx.symbol,
                        transaction_id: tx.transaction_id,
                    });
                }
            }
        }
    }

    getConnectionStatus() {
        if (this.api?.connection) {
            const ready_state = this.api.connection.readyState;
            return socket_state[ready_state as keyof typeof socket_state] || 'Unknown';
        }
        return 'Socket not initialized';
    }

    terminate() {
        // eslint-disable-next-line no-console
        if (this.api) this.api.disconnect();
    }

    initEventListeners() {
        if (window) {
            window.addEventListener('online', this.reconnectIfNotConnected);
            window.addEventListener('focus', this.reconnectIfNotConnected);
        }
    }

    async createNewInstance(account_id: string) {
        if (this.account_id !== account_id) {
            await this.init();
        }
    }

    reconnectIfNotConnected = () => {
        const readyState = this.api?.connection?.readyState;
        const stateNames = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
        };

        console.log('[APIBase] Connection check:', {
            readyState,
            stateName: stateNames[readyState as keyof typeof stateNames] || 'UNKNOWN',
            needsReconnect: readyState !== undefined && readyState > 1
        });

        if (readyState !== undefined && readyState > 1) {
            console.log('%c[APIBase] Connection lost - attempting to reconnect...', 'color: #ff9800; font-weight: bold');

            // Add a small delay before reconnecting to avoid rapid reconnection attempts
            setTimeout(() => {
                this.init(true);
            }, 1000);
        } else if (readyState === 1) {
            console.log('[APIBase] Connection is healthy (OPEN)');
        }
    };

    async authorizeAndSubscribe() {
        const token = V2GetActiveToken();
        if (!token || !this.api) {
            console.log('[APIBase] No token or API instance, skipping authorization');
            return;
        }

        console.log('[APIBase] Starting authorization with token:', token.substring(0, 8) + '...');
        this.token = token;
        this.account_id = V2GetActiveClientId() ?? 'MANUAL';
        setIsAuthorizing(true);
        setIsAuthorized(false);

        try {
            // Add a timeout to the authorize call
            const authPromise = this.api.authorize(this.token);
            const timeoutPromise = new Promise(
                (_, reject) => setTimeout(() => reject(new Error('Authorization timed out')), 15000) // Increased to 15s
            );

            const { authorize, error } = (await Promise.race([authPromise, timeoutPromise])) as any;

            if (error) {
                console.error('[APIBase] Authorization error response:', error);
                if (error.code === 'InvalidToken') {
                    const is_tmb_enabled = window.is_tmb_enabled === true;
                    // Standard InvalidToken handling - trigger logout/re-login flow
                    if (Cookies.get('logged_state') === 'true' && !is_tmb_enabled) {
                        globalObserver.emit('InvalidToken', { error });
                    }
                }
                setIsAuthorizing(false);
                return error;
            }

            console.log('[APIBase] ✓ Authorization successful for:', authorize.loginid);
            this.account_info = authorize;
            this.token = token;
            this.account_id = authorize.loginid;
            this.is_authorized = true;

            // 1. Update balances first so store is ready
            if (authorize.balance !== undefined) {
                // IMPORTANT: Do NOT overwrite the entire all_accounts_balance structure with a single account
                // Just update the specific account's balance using the store method which handles the merging
                setAllAccountsBalance({
                    balance: authorize.balance,
                    currency: authorize.currency,
                    loginid: authorize.loginid,
                } as any);
            }

            // 2. Set account list and auth data (this triggers most store updates)
            setAccountList(authorize?.account_list || []);
            setAuthData(authorize);
            setIsAuthorized(true);

            // 3. Sync localStorage for persistence
            const currentLoginId = localStorage.getItem('active_loginid');
            localStorage.setItem('active_loginid', authorize.loginid);
            localStorage.setItem('authToken', token);
            localStorage.setItem('client.country', authorize.country);
            localStorage.setItem('client_account_details', JSON.stringify(authorize?.account_list));

            // Sync account management structures
            const existingAccountsList = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
            localStorage.setItem('accountsList', JSON.stringify({
                ...existingAccountsList,
                [authorize.loginid]: token
            }));

            const existingClientAccounts = JSON.parse(localStorage.getItem('clientAccounts') ?? '{}');
            localStorage.setItem('clientAccounts', JSON.stringify({
                ...existingClientAccounts,
                [authorize.loginid]: {
                    token: token,
                    currency: authorize.currency,
                    landing_company_name: authorize.landing_company_name,
                    is_virtual: authorize.is_virtual,
                    loginid: authorize.loginid,
                    email: authorize.email,
                    balance: authorize.balance,
                    residence: authorize.country,
                    created_at: authorize.created_at, // Ensure created_at is saved
                }
            }));

            if (this.has_active_symbols) {
                this.toggleRunButton(false);
            } else {
                this.active_symbols_promise = this.getActiveSymbols();
            }

            // Subscribe to balance and other streams
            console.log('[APIBase] Setting up subscriptions...');
            await this.subscribe();

            // Wait for active symbols if not already loaded
            if (!this.has_active_symbols && this.active_symbols_promise) {
                console.log('[APIBase] Waiting for active symbols...');
                await this.active_symbols_promise;
            }

            // Initialize ApiHelpers if not already done
            await this.ensureApiHelpersInitialized();

            // Verify complete trading readiness
            await this.verifyTradingReadiness();

            // Explicitly request balance update to ensure immediate display
            console.log('[APIBase] Requesting initial balance update (all accounts)...');
            try {
                // We use a small delay to ensure the socket is ready for the next request
                setTimeout(async () => {
                    try {
                        await this.api.send({ balance: 1, subscribe: 1, account: 'all' });
                        console.log('[APIBase] ✓ Initial balance request (' + this.account_id + ') sent successfully');
                    } catch (error) {
                        console.error('[APIBase] Failed to request balance:', error);
                    }
                }, 500);
            } catch (error) {
                console.error('[APIBase] Error in balance request setup:', error);
            }
        } catch (e: any) {
            console.error('[APIBase] Authorization failed with exception:', e);
            // Only clear and fail if it's NOT a timeout
            if (e.message !== 'Authorization timed out') {
                this.is_authorized = false;
                setIsAuthorized(false);
                globalObserver.emit('Error', e);
            } else {
                console.warn('[APIBase] Authorization timed out - this may be a network issue');
            }
        } finally {
            setIsAuthorizing(false);
        }
    }

    async verifyTradingReadiness() {
        console.log('[APIBase] Verifying trading readiness...');

        const checks = {
            authorized: this.is_authorized,
            activeSymbols: this.has_active_symbols,
            subscriptionsActive: this.subscriptions_ready,
            apiConnected: this.api?.connection?.readyState === 1
        };

        console.log('[APIBase] Readiness checks:', checks);

        const allReady = Object.values(checks).every(check => check === true);

        if (allReady) {
            this.is_trading_ready = true;
            console.log('%c[APIBase] ✓ Trading is READY!', 'color: #4caf50; font-weight: bold; font-size: 14px;');
            globalObserver.emit('TradingReady', { ready: true });
        } else {
            this.is_trading_ready = false;
            const failedChecks = Object.entries(checks)
                .filter(([_, value]) => !value)
                .map(([key]) => key);
            console.warn('[APIBase] Trading NOT ready. Failed checks:', failedChecks);
        }

        return this.is_trading_ready;
    }

    async getSelfExclusion() {
        if (!this.api || !this.is_authorized) return;
        await this.api.getSelfExclusion();
        // TODO: fix self exclusion
    }

    async ensureApiHelpersInitialized() {
        console.log('[APIBase] Ensuring ApiHelpers is initialized...');

        // Dynamically import ApiHelpers to avoid circular dependency
        const { default: ApiHelpers } = await import('./api-helpers');

        // Check if ApiHelpers is already set
        if (ApiHelpers?.instance) {
            console.log('[APIBase] ApiHelpers already initialized');

            // Retrieve active symbols to populate the instance
            if (ApiHelpers.instance.active_symbols) {
                try {
                    await ApiHelpers.instance.active_symbols.retrieveActiveSymbols(true);
                    console.log('[APIBase] ✓ Active symbols retrieved in ApiHelpers');

                    // Trigger block refresh if Blockly workspace exists
                    this.refreshMarketBlocks();
                } catch (error) {
                    console.error('[APIBase] Failed to retrieve active symbols:', error);
                }
            }
        } else {
            console.warn('[APIBase] ApiHelpers not initialized yet - will be set by app-store');
        }
    }

    refreshMarketBlocks() {
        // Refresh all trade_definition_market blocks to populate dropdowns
        if (typeof window !== 'undefined' && window.Blockly?.derivWorkspace) {
            console.log('[APIBase] Refreshing market blocks...');

            try {
                const market_blocks = window.Blockly.derivWorkspace
                    .getAllBlocks()
                    .filter((block: any) => block.type === 'trade_definition_market');

                if (market_blocks.length > 0) {
                    // Import runIrreversibleEvents dynamically
                    import('../../utils/observer').then(({ runIrreversibleEvents }) => {
                        market_blocks.forEach((block: any) => {
                            runIrreversibleEvents(() => {
                                const fake_create_event = new window.Blockly.Events.BlockCreate(block);
                                window.Blockly.Events.fire(fake_create_event);
                            });
                        });
                        console.log(`[APIBase] ✓ Refreshed ${market_blocks.length} market block(s)`);
                    });
                } else {
                    console.log('[APIBase] No market blocks to refresh');
                }
            } catch (error) {
                console.error('[APIBase] Error refreshing market blocks:', error);
            }
        }
    }

    async subscribe() {
        const subscribeToStream = (streamName: string) => {
            return doUntilDone(
                () => {
                    const subscription = this.api?.send({
                        [streamName]: 1,
                        subscribe: 1,
                        ...(streamName === 'balance' ? { account: 'all' } : {}),
                    });
                    if (subscription) {
                        this.current_auth_subscriptions.push(subscription);
                    }
                    return subscription;
                },
                [],
                this
            );
        };

        const streamsToSubscribe = ['balance', 'transaction', 'proposal_open_contract'];

        try {
            await Promise.all(streamsToSubscribe.map(subscribeToStream));
            this.subscriptions_ready = true;
            console.log('[APIBase] ✓ All subscriptions active');
        } catch (error) {
            this.subscriptions_ready = false;
            console.error('[APIBase] Subscription setup failed:', error);
            throw error;
        }
    }

    getActiveSymbols = async () => {
        await doUntilDone(() => this.api?.send({ active_symbols: 'brief' }), [], this).then(
            ({ active_symbols = [], error = {} }) => {
                const pip_sizes = {};
                if (active_symbols.length) {
                    this.has_active_symbols = true;
                    console.log('[APIBase] ✓ Active symbols loaded:', active_symbols.length);
                }
                active_symbols.forEach(({ symbol, pip }: { symbol: string; pip: string }) => {
                    (pip_sizes as Record<string, number>)[symbol] = +(+pip).toExponential().substring(3);
                });
                this.pip_sizes = pip_sizes as Record<string, number>;
                this.toggleRunButton(false);
                this.active_symbols = active_symbols;

                // Check readiness after symbols load
                if (this.is_authorized && this.subscriptions_ready) {
                    this.verifyTradingReadiness();
                }

                return active_symbols || error;
            }
        );
    };

    toggleRunButton = (toggle: boolean) => {
        const run_button = document.querySelector('#db-animation__run-button');
        if (!run_button) return;
        (run_button as HTMLButtonElement).disabled = toggle;
    };

    setIsRunning(toggle = false) {
        this.is_running = toggle;
    }

    pushSubscription(subscription: CurrentSubscription) {
        this.subscriptions.push(subscription);
    }

    clearSubscriptions() {
        this.subscriptions.forEach(s => s.unsubscribe());
        this.subscriptions = [];

        // Resetting timeout resolvers
        const global_timeouts = globalObserver.getState('global_timeouts') ?? [];

        global_timeouts.forEach((_: unknown, i: number) => {
            clearTimeout(i);
        });
    }

    isTradingReady() {
        return this.is_trading_ready;
    }

    getTradingReadinessStatus() {
        return {
            is_trading_ready: this.is_trading_ready,
            is_authorized: this.is_authorized,
            has_active_symbols: this.has_active_symbols,
            subscriptions_ready: this.subscriptions_ready,
            api_connected: this.api?.connection?.readyState === 1
        };
    }
}

export const api_base = new APIBase();
