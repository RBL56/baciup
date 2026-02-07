
import { api_base } from '../api/api-base';
import { observer as globalObserver } from '../../utils/observer';
import { generateDerivApiInstance } from '../api/appId';

class VirtualHookManager {
    constructor() {
        this.vh_variables = {
            mode: 'VIRTUAL',
            consecutive_losses: 0,
            real_trades_count: 0,
            initial_trades_count: 0,
            has_started: false,
        };
        this.simulations = new Map();
        this.simulator_api = null;
        this.simulator_auth_promise = null;

        console.log('[VH] Singleton Ready');

        globalObserver.register('bot.running', () => {
            const settings = this.getSettings();
            if (settings && settings.is_enabled) {
                this.reset();
                const account_label = api_base.account_id?.startsWith('VRT') ? 'Demo' : 'Real';
                globalObserver.emit('ui.log.success', `[Virtual Hook] ACTIVE on ${account_label} account. Monitoring for pattern.`);

                // Pre-warm simulator connection if we find a demo account
                this.initSimulator();
            }
        });

        globalObserver.register('bot.contract', (contract) => {
            const settings = this.getSettings();
            if (!settings || !settings.is_enabled) return;
            if (contract.is_sold || (contract.status && contract.status !== 'open')) {
                this.onContractClosed(contract);
            }
        });
    }

    reset() {
        this.vh_variables = {
            mode: 'VIRTUAL',
            consecutive_losses: 0,
            real_trades_count: 0,
            initial_trades_count: 0,
            has_started: false,
        };
        this.simulations.clear();
        console.log('[VH] State Reset');
    }

    getSettings() {
        try {
            const DBotStore = require('../../scratch/dbot-store').default;
            return DBotStore.instance?.client?.virtual_hook_settings;
        } catch (e) {
            return null;
        }
    }

    getDemoToken() {
        try {
            const accounts_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
            const demo_loginid = Object.keys(accounts_list).find(id => id.startsWith('VRT'));
            return demo_loginid ? accounts_list[demo_loginid] : null;
        } catch (e) {
            return null;
        }
    }

    async initSimulator() {
        const token = this.getDemoToken();
        if (!token) return null;

        if (this.simulator_api) return this.simulator_api;

        console.log('[VH] Initializing background simulator session...');
        this.simulator_api = generateDerivApiInstance();

        // Handle autorization
        this.simulator_auth_promise = this.simulator_api.authorize(token)
            .then(response => {
                console.log('[VH] Simulator Session Authorized:', response.authorize.loginid);
                return true;
            })
            .catch(e => {
                console.error('[VH] Simulator Auth Error:', e);
                this.simulator_api = null;
                return false;
            });

        return this.simulator_api;
    }

    async onPurchase(engine, contract_type) {
        const settings = this.getSettings();
        if (!settings || !settings.is_enabled) return null;

        const { enable_after_initial, virtual_trades_condition, real_trades_condition } = settings;

        try {
            const is_demo = api_base.account_id?.startsWith('VRT');
            const account_type = is_demo ? 'Demo' : 'Real';

            // 1. Initial Delay Phase
            const initial_limit = enable_after_initial === 'Immediately' ? 0 : parseInt(enable_after_initial);
            if (!this.vh_variables.has_started) {
                if (this.vh_variables.initial_trades_count < initial_limit) {
                    const remaining = initial_limit - this.vh_variables.initial_trades_count;
                    globalObserver.emit('ui.log.notify', `[Virtual Hook] Initial Delay: ${remaining} trades remaining on ${account_type} account.`);
                    return null;
                } else {
                    this.vh_variables.has_started = true;
                    globalObserver.emit('ui.log.success', '[Virtual Hook] ACTIVATED. Starting bot simulation.');
                }
            }

            // 2. Mode Management
            if (this.vh_variables.mode === 'VIRTUAL') {
                if (this.vh_variables.consecutive_losses >= virtual_trades_condition) {
                    this.vh_variables.mode = 'REAL';
                    this.vh_variables.real_trades_count = 0;
                    globalObserver.emit('ui.log.success', `[Virtual Hook] Pattern found (${virtual_trades_condition} losses). SWITCHING TO ${account_type.toUpperCase()} TRADES!`);
                }
            } else if (this.vh_variables.mode === 'REAL') {
                const limit = real_trades_condition === 'Immediately' ? 1 : parseInt(real_trades_condition);
                if (this.vh_variables.real_trades_count >= limit) {
                    this.vh_variables.mode = 'VIRTUAL';
                    this.vh_variables.consecutive_losses = 0;
                    globalObserver.emit('ui.log.notify', `[Virtual Hook] ${account_type} cycle finished. Returning to bot simulator.`);
                }
            }

            // 3. Trade Execution
            if (this.vh_variables.mode === 'VIRTUAL') {
                let proposal;
                try { proposal = engine.selectProposal(contract_type); } catch (e) { }

                const underlying = proposal?.underlying || engine.tradeOptions?.symbol || engine.symbol;
                if (!underlying) return null;

                // Prepare Simulator buy request if demo account is active
                const simulator_token = this.getDemoToken();
                if (simulator_token && this.simulator_api) {
                    await this.simulator_auth_promise;

                    globalObserver.emit('ui.log.notify', `[Virtual Hook] Simulator: Placing accurate ${contract_type} on background Demo...`);
                    this.runSimulatorTrade(this.simulator_api, contract_type, proposal);

                    // Return a fake response to satisfy the engine while we trade in background
                    const contract_id = `GHOST_${Date.now()}`;
                    return Promise.resolve({
                        buy: {
                            contract_id,
                            transaction_id: `GHOST_TX_${Date.now()}`,
                            longcode: `[API Simulated] ${proposal?.longcode || contract_type}`,
                            shortcode: `GHOST_${contract_type}_${underlying}_${Date.now()}_S0P_0`,
                            buy_price: 0,
                            is_virtual_hook: true,
                            contract_type,
                            underlying,
                            currency: 'USD'
                        }
                    });
                }

                // Fallback to tick simulation
                const contract_id = `GHOST_${Date.now()}`;
                const buy_response = {
                    buy: {
                        contract_id,
                        transaction_id: `GHOST_TX_${Date.now()}`,
                        longcode: `[Tick Simulated] ${proposal?.longcode || contract_type}`,
                        shortcode: `GHOST_${contract_type}_${underlying}_${Date.now()}_S0P_0`,
                        buy_price: 0,
                        is_virtual_hook: true,
                        contract_type,
                        underlying,
                        currency: 'USD'
                    }
                };

                globalObserver.emit('ui.log.notify', `[Virtual Hook] Simulator: Placing tick ghost ${contract_type}...`);
                this.runGhostSimulation(engine, contract_type, proposal, buy_response.buy);
                return Promise.resolve(buy_response);
            }

            console.log(`[VH] Mode: REAL. Executing real trade on ${account_type} account (${api_base.account_id})`);
            return null;

        } catch (e) {
            console.error('[VH] onPurchase Error:', e);
        }
        return null;
    }

    async runSimulatorTrade(api, contract_type, proposal) {
        if (!proposal) return;

        try {
            const buy_req = {
                buy: proposal.id,
                price: proposal.ask_price || 0
            };

            const buy_response = await api.send(buy_req);
            const { contract_id } = buy_response.buy;

            // Subscribe to this background contract
            api.onMessage().subscribe(({ data: raw_data }) => {
                const data = raw_data;
                if (data.msg_type === 'proposal_open_contract') {
                    const contract = data.proposal_open_contract;
                    if (contract.contract_id !== contract_id) return;

                    // Inject updates into the main bridge so the user sees progress
                    this.injectSimulatorContract(contract);

                    // We don't need to manually check win/loss because the global observer
                    // in the main session doesn't see these background messages.
                    // But we DO need to update our internal logic when it finishes.
                    if (contract.is_sold || (contract.status && contract.status !== 'open')) {
                        // The background API gets the real profit/loss
                        this.onContractClosed({
                            ...contract,
                            is_virtual_hook: true
                        });
                    }
                }
            });

            // Start subscription
            api.send({ proposal_open_contract: 1, contract_id, subscribe: 1 });

        } catch (e) {
            console.error('[VH] Simulator Trade Error:', e);
        }
    }

    async runGhostSimulation(engine, contract_type, proposal, buy_info) {
        const { underlying } = buy_info;
        await new Promise(r => setTimeout(r, 200));

        let entry_tick;
        try {
            entry_tick = engine.lastTick?.quote || await engine.getLastTick(false);
        } catch (e) { return; }

        const duration = 5;
        let ticks_count = 0;
        const start_time = Math.floor(Date.now() / 1000);

        this.injectMockContract(buy_info, {
            status: 'open',
            date_start: start_time,
            entry_tick,
            entry_tick_display_value: entry_tick.toString(),
            entry_tick_time: start_time,
        });

        const tick_sub = api_base.api.onMessage().subscribe(({ data: raw_data }) => {
            const data = raw_data;
            if (data.msg_type === 'tick' && data.tick.symbol === underlying) {
                ticks_count++;
                if (ticks_count >= duration) {
                    tick_sub.unsubscribe();
                    const exit_tick = data.tick.quote;
                    const profit = this.calculateGhostProfit(contract_type, entry_tick, exit_tick, proposal);

                    this.injectMockContract(buy_info, {
                        status: profit > 0 ? 'won' : 'lost',
                        profit,
                        is_completed: true,
                        is_sold: true,
                        exit_tick,
                        exit_tick_display_value: exit_tick.toString(),
                        exit_tick_time: Math.floor(Date.now() / 1000),
                    });
                }
            }
        });
    }

    calculateGhostProfit(type, entry, exit, proposal) {
        if (type.includes('CALL') || type.includes('UP')) return exit > entry ? 1 : -1;
        if (type.includes('PUT') || type.includes('DOWN')) return exit < entry ? 1 : -1;

        if (type.includes('DIGIT')) {
            const tick_str = (exit || 0).toString();
            const last_digit = parseInt(tick_str.charAt(tick_str.length - 1));
            const prediction = proposal?.barrier || proposal?.last_digit_prediction || 0;
            if (type.includes('DIFF')) return last_digit != prediction ? 1 : -1;
            if (type.includes('MATCH')) return last_digit == prediction ? 1 : -1;
            if (type.includes('OVER')) return last_digit > prediction ? 1 : -1;
            if (type.includes('UNDER')) return last_digit < prediction ? 1 : -1;
            if (type.includes('EVEN')) return last_digit % 2 === 0 ? 1 : -1;
            if (type.includes('ODD')) return last_digit % 2 !== 0 ? 1 : -1;
        }
        return -1;
    }

    injectSimulatorContract(contract) {
        const mock_msg = {
            msg_type: 'proposal_open_contract',
            proposal_open_contract: {
                ...contract,
                is_virtual_hook: true,
                buy_price: 0, // Keep UI showing 0 stake for simulation
            }
        };
        api_base.bridge_subject.next({ data: mock_msg });
    }

    injectMockContract(buy_info, overrides) {
        const mock_msg = {
            msg_type: 'proposal_open_contract',
            proposal_open_contract: {
                contract_id: buy_info.contract_id,
                transaction_ids: { buy: buy_info.transaction_id.replace('TX_', '') },
                buy_price: 0,
                underlying: buy_info.underlying,
                contract_type: buy_info.contract_type,
                shortcode: buy_info.shortcode,
                currency: 'USD',
                is_virtual_hook: true,
                display_name: buy_info.underlying,
                ...overrides
            }
        };
        api_base.bridge_subject.next({ data: mock_msg });
    }

    onContractClosed(contract) {
        try {
            if (this.simulations.has(contract.contract_id)) return;
            this.simulations.set(contract.contract_id, true);

            const settings = this.getSettings();
            if (!settings || !settings.is_enabled) return;

            if (!this.vh_variables.has_started) {
                this.vh_variables.initial_trades_count++;
                return;
            }

            let profit = Number(contract.profit);
            if (isNaN(profit)) {
                profit = Number(contract.sell_price || 0) - Number(contract.buy_price || 0);
            }

            if (this.vh_variables.mode === 'VIRTUAL') {
                if (profit < 0) {
                    this.vh_variables.consecutive_losses++;
                    globalObserver.emit('ui.log.notify', `[Virtual Hook] Simulation Loss. Streak: ${this.vh_variables.consecutive_losses}/${settings.virtual_trades_condition}`);
                } else {
                    this.vh_variables.consecutive_losses = 0;
                    globalObserver.emit('ui.log.notify', '[Virtual Hook] Simulation Win. Resetting streak.');
                }
            } else if (this.vh_variables.mode === 'REAL') {
                this.vh_variables.real_trades_count++;
                const account_type = api_base.account_id?.startsWith('VRT') ? 'Demo' : 'Real';
                console.log(`[VH] Trade completed on ${account_type}. Count: ${this.vh_variables.real_trades_count}`);
            }
        } catch (e) { }
    }
}

export default new VirtualHookManager();
