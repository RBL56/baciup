
import { api_base } from '../api/api-base';
import { observer as globalObserver } from '../../utils/observer';

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
        console.log('[VH] Singleton Ready');

        // Ensure state is clean when bot starts
        globalObserver.register('bot.running', () => {
            const settings = this.getSettings();
            if (settings && settings.is_enabled) {
                this.reset(); // Reset counters on every bot run
                globalObserver.emit('ui.log.success', '[Virtual Hook] ACTIVE. Monitoring for pattern.');
            }
        });

        // Global watcher for all contract completions (Real and Ghost)
        globalObserver.register('bot.contract', (contract) => {
            const settings = this.getSettings();
            if (!settings || !settings.is_enabled) return;

            // Trigger closure logic when contract is finished
            if (contract.is_sold || (contract.status && contract.status !== 'open')) {
                // Prevent duplicate processing if it's already in our simulations map
                // (though onContractClosed handles this gracefully)
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

    async onPurchase(engine, contract_type) {
        const settings = this.getSettings();
        if (!settings || !settings.is_enabled) return null;

        const { enable_after_initial, virtual_trades_condition, real_trades_condition } = settings;

        try {
            // 1. Initial Delay Phase
            const initial_limit = enable_after_initial === 'Immediately' ? 0 : parseInt(enable_after_initial);
            if (!this.vh_variables.has_started) {
                if (this.vh_variables.initial_trades_count < initial_limit) {
                    const remaining = initial_limit - this.vh_variables.initial_trades_count;
                    globalObserver.emit('ui.log.notify', `[Virtual Hook] Initial Delay: ${remaining} real trades remaining before activation.`);
                    return null;
                } else {
                    this.vh_variables.has_started = true;
                    globalObserver.emit('ui.log.success', '[Virtual Hook] ACTIVATED. Starting first simulation.');
                }
            }

            // 2. Mode Management
            if (this.vh_variables.mode === 'VIRTUAL') {
                if (this.vh_variables.consecutive_losses >= virtual_trades_condition) {
                    this.vh_variables.mode = 'REAL';
                    this.vh_variables.real_trades_count = 0;
                    globalObserver.emit('ui.log.success', `[Virtual Hook] Condition met (${virtual_trades_condition} losses). SWITCHING TO REAL TRADES!`);
                }
            } else if (this.vh_variables.mode === 'REAL') {
                const limit = real_trades_condition === 'Immediately' ? 1 : parseInt(real_trades_condition);
                if (this.vh_variables.real_trades_count >= limit) {
                    this.vh_variables.mode = 'VIRTUAL';
                    this.vh_variables.consecutive_losses = 0;
                    globalObserver.emit('ui.log.notify', `[Virtual Hook] Real trades cycle finished (${limit}). Returning to virtual simulation.`);
                }
            }

            // 3. Trade Execution
            if (this.vh_variables.mode === 'VIRTUAL') {
                let proposal;
                try { proposal = engine.selectProposal(contract_type); } catch (e) { }

                const underlying = proposal?.underlying || engine.tradeOptions?.symbol || engine.symbol;
                if (!underlying) return null;

                const contract_id = `GHOST_${Date.now()}`;
                const buy_response = {
                    buy: {
                        contract_id,
                        transaction_id: `GHOST_TX_${Date.now()}`,
                        longcode: `[Simulated] ${proposal?.longcode || contract_type}`,
                        shortcode: `GHOST_${contract_type}_${underlying}_${Date.now()}_S0P_0`,
                        buy_price: 0,
                        is_virtual_hook: true,
                        contract_type,
                        underlying,
                        currency: 'USD'
                    }
                };

                globalObserver.emit('ui.log.notify', `[Virtual Hook] Simulating ${contract_type}...`);
                this.runGhostSimulation(engine, contract_type, proposal, buy_response.buy);
                return Promise.resolve(buy_response);
            }

            console.log(`[VH] Mode: REAL. Executing contract on account ${api_base.account_id}`);
            return null;

        } catch (e) {
            console.error('[VH] onPurchase Error:', e);
        }
        return null;
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

                    // Removed explicit onContractClosed call as the global listener will handle it 
                    // when OpenContract.js broadcasts the mock contract result.
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
            // Check if we've already processed this contract to avoid double increments
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
                console.log(`[VH] Real trade completed. Count: ${this.vh_variables.real_trades_count}`);
            }
        } catch (e) { }
    }
}

export default new VirtualHookManager();
