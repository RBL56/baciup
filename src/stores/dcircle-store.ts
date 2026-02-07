import { action, makeObservable, observable, reaction, runInAction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import RootStore from './root-store';

interface TickFeedItem {
    timestamp: string;
    price: string;
    digit: number;
    isUp: boolean;
}

export default class DcircleStore {
    root_store: RootStore;
    volatility = '1HZ100V'; // Volatility 100 (1s) Index
    ticksCount = 1000;
    threshold = 7;
    currentPrice = '0.00';
    priceChange = { value: '0.00', percent: '0.00', isUp: true };
    isLoading = false;
    digitStats: string[] = Array(10).fill('0.0');
    overUnder = { under: '0.0', equal: '0.0', over: '0.0' };
    oddEven = { even: '0.0', odd: '0.0', recent: [] as number[] };
    currentDigit: number | null = null; // Latest tick's digit
    recentTicks: TickFeedItem[] = []; // Live tick feed
    digitCounts: number[] = Array(10).fill(0); // Optimization: Store counts directly
    debugStatus = 'Idle';
    tickRate = 0;
    lastTickTime = Date.now();
    isStalled = false;
    lastReceivedSymbol = ''; // Debug: Track what symbols are coming in

    subscriptionId: string | null = null;
    digitHistory: number[] = [];
    lastPrices: number[] = [];
    messageSubscription: { unsubscribe: () => void } | null = null;
    isInitialized = false;

    constructor(root_store: RootStore) {
        makeObservable(this, {
            volatility: observable,
            ticksCount: observable,
            threshold: observable,
            currentPrice: observable,
            priceChange: observable,
            isLoading: observable,
            digitStats: observable,
            overUnder: observable,
            oddEven: observable,
            currentDigit: observable,
            recentTicks: observable,
            isInitialized: observable,
            debugStatus: observable,
            tickRate: observable,
            isStalled: observable,
            lastReceivedSymbol: observable,
            setVolatility: action.bound,
            setTicksCount: action.bound,
            setThreshold: action.bound,
            updateAnalysis: action.bound,
            initialise: action.bound,
            handleTick: action.bound,
            cleanup: action.bound,
            debugStatus: observable,
        });
        this.root_store = root_store;

        reaction(
            () => this.root_store.common.is_socket_opened,
            is_socket_opened => {
                if (is_socket_opened) {
                    if (!this.isInitialized) {
                        this.initialise();
                    }
                } else {
                    // Socket closed, reset state so we re-init on next open
                    runInAction(() => {
                        this.isInitialized = false;
                        this.isLoading = false;
                    });
                }
            },
            { fireImmediately: true }
        );

        // Verification Reaction for "updates in every tick"
        reaction(
            () => this.recentTicks.length, // Reacts to tick feed updates
            length => {
                if (length > 0) {
                    runInAction(() => {
                        this.lastTickTime = Date.now();
                        this.isStalled = false;
                    });
                }
            }
        );

        // Periodically check for stalls and update tick rate
        setInterval(() => {
            runInAction(() => {
                const now = Date.now();
                const timeSinceLastTick = now - this.lastTickTime;

                if (this.isInitialized && timeSinceLastTick > 5000) {
                    this.isStalled = true;
                    this.debugStatus = 'Warning: Tick stream stalled';

                    // Auto-reconnect after 15 seconds of stalling
                    if (timeSinceLastTick > 15000 && !this.isLoading) {
                        console.log('[Dcircle] Attempting auto-reconnect due to prolonged stall...');
                        this.initialise();
                    }
                }

                // Simple tick rate calculation (every 1000ms)
                // In a real scenario we'd count ticks in the last second
            });
        }, 1000);
    }

    setVolatility(v: string) {
        if (this.volatility !== v) {
            this.volatility = v;
            this.initialise();
        }
    }

    setTicksCount(c: number) {
        if (this.ticksCount !== c) {
            this.ticksCount = c;
            this.updateAnalysis();
            this.initialise();
        }
    }

    setThreshold(t: number) {
        this.threshold = t;
        this.updateAnalysis();
    }

    getPrecision(symbol: string) {
        const fallback: Record<string, number> = {
            R_10: 3,
            R_25: 3,
            R_50: 4,
            R_75: 4,
            R_100: 2,
            '1HZ10V': 2,
            '1HZ25V': 2,
            '1HZ50V': 2,
            '1HZ75V': 2,
            '1HZ100V': 2,
            JD10: 2,
            JD25: 2,
            JD50: 2,
            JD75: 2,
            JD100: 2,
        };
        if ((api_base as any).pip_sizes?.[symbol]) return (api_base as any).pip_sizes[symbol];
        return fallback[symbol] || 3;
    }

    processTickData(quote: number, precision: number) {
        // Robust way to get the last digit
        const stringVal = quote.toFixed(precision);
        const lastChar = stringVal.charAt(stringVal.length - 1);
        return parseInt(lastChar);
    }

    updateAnalysis() {
        const total = this.digitHistory.length;
        if (total === 0) return;

        // Use the persistent digitCounts - extremely fast O(10) instead of O(N)
        const stats = this.digitCounts.map(count => ((count / total) * 100).toFixed(2));

        // Over/Under/Odd/Even can also be optimized, but let's stick to the critical digitStats first.
        // For Over/Under we can iterate the counts array (O(10)) instead of history (O(N)).
        let under = 0,
            equal = 0,
            over = 0;
        let even = 0,
            odd = 0;

        for (let d = 0; d <= 9; d++) {
            const count = this.digitCounts[d];

            // Over/Under
            if (d < this.threshold) under += count;
            else if (d === this.threshold) equal += count;
            else over += count;

            // Odd/Even (Note: This is global odd/even for the whole window, not just recent 60)
            // If we want recent 60 for the grid, we still need to slice history for the grid display.
            if (d % 2 === 0) even += count;
            else odd += count;
        }

        // Recent 60 for visual grid needs actual sequence
        const recentEO = this.digitHistory.slice(-60);

        runInAction(() => {
            (this.digitStats as any).replace(stats);
            // console.log('[Dcircle] updateAnalysis - total:', total, 'stats:', stats);
            this.overUnder = {
                under: ((under / total) * 100).toFixed(2),
                equal: ((equal / total) * 100).toFixed(2),
                over: ((over / total) * 100).toFixed(2),
            };
            this.oddEven = {
                even: ((even / total) * 100).toFixed(2),
                odd: ((odd / total) * 100).toFixed(2),
                recent: recentEO,
            };
        });
    }

    async initialise() {
        if (!api_base.api) {
            this.debugStatus = 'Error: API not ready';
            return;
        }

        this.isLoading = true;
        this.debugStatus = 'Initializing...';
        this.lastTickTime = Date.now(); // Reset timer to give initialization time
        this.isStalled = false;

        // Ensure pip_sizes are available for precision
        if (Object.keys(api_base.pip_sizes).length === 0) {
            console.log('[Dcircle] Fetching active symbols for precision (non-blocking)...');
            api_base.getActiveSymbols().catch(e => console.warn('[Dcircle] Active symbols fetch error:', e));
        }

        console.log(`[Dcircle] Initializing with volatility: ${this.volatility}, ticksCount: ${this.ticksCount}`);

        try {
            // Cleanup existing subscription
            if (this.subscriptionId) {
                api_base.api.send({ forget: this.subscriptionId }).catch(() => { });
                this.subscriptionId = null;
            }
            if (this.messageSubscription) {
                this.messageSubscription.unsubscribe();
                this.messageSubscription = null;
            }

            // Subscribe to message stream BEFORE sending the request to ensure no ticks are missed
            this.messageSubscription = api_base.api.onMessage().subscribe(this.handleTick);
            this.debugStatus = 'Subscribed to stream';
            // console.log('[Dcircle] Subscribed to global message stream');

            const request = {
                ticks_history: this.volatility,
                count: this.ticksCount,
                end: 'latest',
                style: 'ticks',
            };

            const res = (await api_base.api.send(request)) as {
                error?: any;
                history?: { prices: number[]; times: number[] };
            };

            if (res.error) {
                runInAction(() => {
                    this.isLoading = false;
                    this.debugStatus = `API Error: ${res.error.message || JSON.stringify(res.error)}`;
                });
                return;
            }
            this.debugStatus = 'History received';

            // Subscribe to live ticks explicitly
            console.log('[Dcircle] Subscribing to live ticks for symbol:', this.volatility);
            const subRes = (await api_base.api.send({
                ticks: this.volatility,
                subscribe: 1,
            })) as { subscription?: { id: string }; error?: { message: string }; tick?: any };

            console.log('[Dcircle] Subscription response:', {
                hasSubscription: !!subRes.subscription,
                subscriptionId: subRes.subscription?.id,
                hasError: !!subRes.error,
                error: subRes.error?.message,
                hasTick: !!subRes.tick,
                tickSymbol: subRes.tick?.symbol
            });

            runInAction(() => {
                if (subRes.subscription) {
                    this.subscriptionId = subRes.subscription.id;
                    this.debugStatus = 'Live Stream Connected';

                    // Handle the first tick if it came with the subscription response
                    if (subRes.tick) {
                        console.log('[Dcircle] First tick received in subscription response');
                        this.handleTick(subRes);
                    }
                } else if (subRes.error) {
                    this.debugStatus = `Sub Error: ${subRes.error.message}`;
                }

                if (res.history && res.history.prices && res.history.prices.length > 0) {
                    const precision = this.getPrecision(this.volatility);

                    // Reset Rolling Window
                    this.digitHistory = [];
                    this.digitCounts = Array(10).fill(0);

                    // Initialize window with history
                    res.history.prices.forEach((p: number) => {
                        const d = this.processTickData(p, precision);
                        this.digitHistory.push(d);
                        this.digitCounts[d]++;
                    });

                    // Ensure max size
                    while (this.digitHistory.length > this.ticksCount) {
                        const removed = this.digitHistory.shift();
                        if (removed !== undefined) this.digitCounts[removed]--;
                    }

                    this.lastPrices = res.history.prices.slice(-20);

                    const lastPrice = res.history.prices[res.history.prices.length - 1];
                    this.currentPrice = lastPrice.toFixed(precision);
                    this.currentDigit = this.processTickData(lastPrice, precision);

                    // Backfill recentTicks from history (last 50)
                    const historyLength = res.history.prices.length;
                    const backfillCount = Math.min(historyLength, 50);
                    const backfillPrices = res.history.prices.slice(-backfillCount).reverse();
                    const backfillTimes = res.history.times.slice(-backfillCount).reverse();

                    this.recentTicks = backfillPrices.map((price: number, index: number) => {
                        const digit = this.processTickData(price, precision);
                        // Approximate change for history or just mark simple
                        // Note: history.times gives unix epoch in seconds
                        const date = new Date(backfillTimes[index] * 1000);
                        const timestamp = date.toLocaleTimeString('en-US', { hour12: false });

                        // Determine direction (simple check vs next item in reverse list, effectively prev item time-wise)
                        // Actually backfillPrices is reversed (Latest ... Oldest)
                        // So next item in array is the 'previous' tick
                        const prevPrice = backfillPrices[index + 1] !== undefined ? backfillPrices[index + 1] : price;
                        const isUp = price >= prevPrice;

                        return {
                            timestamp,
                            price: price.toFixed(precision),
                            digit,
                            isUp,
                        };
                    });

                    this.updateAnalysis();
                    console.log(`[Dcircle] Loaded ${res.history.prices.length} historical ticks`);
                }
                this.isLoading = false;
                this.isInitialized = true;
                this.debugStatus = 'Ready (Live)';
            });

            // Ticks are already being handled by the subscription at the start of initialise
        } catch (err) {
            console.error('[Dcircle] Initialization error:', err);
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    handleTick(response: any) {
        // Handle BOTH direct responses and wrapped { data: { ... } } responses
        const msg = response.data || response;
        const tick = msg.tick || msg.ohlc;

        if (!tick) {
            // Log non-tick messages periodically for debugging
            if (this.isStalled) {
                console.log('[Dcircle] Non-tick message received while stalled:', msg.msg_type);
            }
            return;
        }

        // Normalize symbols for comparison - remove common suffixes and convert to lowercase
        const normalizeSymbol = (symbol: string) => {
            return symbol
                .toLowerCase()
                .replace(/_index$/, '')
                .replace(/index$/, '')
                .trim();
        };

        const incomingSymbol = normalizeSymbol(tick.symbol);
        const currentSymbol = normalizeSymbol(this.volatility);

        runInAction(() => {
            this.lastReceivedSymbol = `${tick.symbol} (${incomingSymbol})`;
        });

        // Debug: Log symbol comparison
        if (this.digitHistory.length < 5) {
            console.log('[Dcircle] Symbol Match Check:', {
                incoming: tick.symbol,
                normalized_incoming: incomingSymbol,
                current: this.volatility,
                normalized_current: currentSymbol,
                match: incomingSymbol === currentSymbol
            });
        }

        if (incomingSymbol === currentSymbol) {
            const quote = tick.quote || tick.close;
            if (quote === undefined) {
                console.warn('[Dcircle] Tick matched but no quote/close value:', tick);
                return;
            }

            const precision = this.getPrecision(this.volatility);
            const digit = this.processTickData(quote, precision);

            // Update status
            this.debugStatus = `Live: ${quote} (${digit})`;

            // Debug: Confirm tick processing
            if (this.digitHistory.length < 10) {
                console.log('[Dcircle] Processing tick:', { quote, digit, precision });
            }

            const prevPrice = this.lastPrices[this.lastPrices.length - 1] || quote;
            const change = quote - prevPrice;
            const changePercent = (change / (prevPrice || 1)) * 100;
            const isUp = change >= 0;

            runInAction(() => {
                this.currentPrice = quote.toFixed(precision);
                this.currentDigit = digit; // Highlight current digit
                this.priceChange = {
                    value: (change >= 0 ? '+' : '') + change.toFixed(precision),
                    percent: (change >= 0 ? '+' : '') + changePercent.toFixed(2),
                    isUp: isUp,
                };

                this.lastPrices.push(quote);
                if (this.lastPrices.length > 20) this.lastPrices.shift();

                // --- O(1) Rolling Window Update ---
                this.digitHistory.push(digit);
                this.digitCounts[digit]++;

                if (this.digitHistory.length > this.ticksCount) {
                    const removed = this.digitHistory.shift();
                    if (removed !== undefined) this.digitCounts[removed]--;
                }

                // Add to tick feed
                const now = Date.now();
                const timestamp = new Date(now).toLocaleTimeString('en-US', { hour12: false });

                // Update tick rate logic
                const timeDiff = now - this.lastTickTime;
                if (timeDiff > 0) {
                    this.tickRate = Number((1000 / timeDiff).toFixed(1));
                }
                this.lastTickTime = now;
                this.isStalled = false;

                this.recentTicks.unshift({
                    timestamp,
                    price: quote.toFixed(precision),
                    digit,
                    isUp,
                });
                if (this.recentTicks.length > 50) this.recentTicks.pop();

                this.updateAnalysis();
            });
        } else {
            // Debug: Log non-matching symbols
            if (tick.symbol && this.digitHistory.length < 10) {
                console.log('[Dcircle] Symbol mismatch - ignoring tick:', {
                    incoming: tick.symbol,
                    expected: this.volatility,
                    normalized_incoming: incomingSymbol,
                    normalized_expected: currentSymbol
                });
            }
        }
    }

    cleanup() {
        if (this.subscriptionId && api_base.api) {
            api_base.api.send({ forget: this.subscriptionId }).catch(() => { });
            this.subscriptionId = null;
        }
        if (this.messageSubscription) {
            this.messageSubscription.unsubscribe();
            this.messageSubscription = null;
        }
        runInAction(() => {
            this.digitHistory = [];
            this.lastPrices = [];
            this.isInitialized = false;
        });
    }
}
