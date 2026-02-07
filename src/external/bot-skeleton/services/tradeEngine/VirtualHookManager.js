
import { api_base } from '../api/api-base';

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
    }

    async onPurchase(engine, contract_type) {
        try {
            const DBotStore = require('../../scratch/dbot-store').default;
            const { client } = DBotStore.instance || {};
            const { is_enabled, enable_after_initial, virtual_trades_condition, real_trades_condition } = client?.virtual_hook_settings || {};

            if (!is_enabled) return null;

            // 1. Initial Trades Delay logic
            const initial_limit = enable_after_initial === 'Immediately' ? 0 : parseInt(enable_after_initial);
            if (!this.vh_variables.has_started) {
                if (this.vh_variables.initial_trades_count < initial_limit) {
                    console.log(`[VH] Initial Delay Mode: Waiting for ${initial_limit - this.vh_variables.initial_trades_count} more trades.`);
                    // Fallthrough to simulation
                } else {
                    this.vh_variables.has_started = true;
                    console.log('[VH] Initial delay finished. Virtual Hook active.');
                }
            }

            // 2. Determine Mode
            let new_mode = this.vh_variables.mode;
            if (this.vh_variables.has_started) {
                if (this.vh_variables.mode === 'VIRTUAL') {
                    if (this.vh_variables.consecutive_losses >= virtual_trades_condition) {
                        console.log(`[VH] Condition met (${virtual_trades_condition} losses). Target REAL mode.`);
                        new_mode = 'REAL';
                        this.vh_variables.real_trades_count = 0;
                    }
                } else {
                    const limit = real_trades_condition === 'Immediately' ? 1 : parseInt(real_trades_condition);
                    if (this.vh_variables.real_trades_count >= limit) {
                        console.log(`[VH] Real trades limit (${limit}) reached. Returning to VIRTUAL mode.`);
                        new_mode = 'VIRTUAL';
                        this.vh_variables.consecutive_losses = 0;
                    }
                }
            }

            this.vh_variables.mode = new_mode;

            // 3. Execution: If VIRTUAL, Simulate. If REAL, allow normal purchase.
            if (this.vh_variables.mode === 'VIRTUAL') {
                const proposal = engine.selectProposal(contract_type);
                const contract_id = `GHOST_${Date.now()}`;

                console.log(`[VH] Triggering Ghost Trade (Simulation) for ${contract_type}. ID: ${contract_id}`);

                const buy_response = {
                    buy: {
                        contract_id,
                        transaction_id: `GHOST_TX_${Date.now()}`,
                        longcode: `[Simulated] ${proposal.longcode}`,
                        buy_price: 0,
                        is_virtual_hook: true, // Flag for UI
                        contract_type,
                        underlying: proposal.underlying,
                        currency: 'USD'
                    }
                };

                // Start Paper Trading Task
                this.runGhostSimulation(engine, contract_type, proposal, buy_response.buy);

                return Promise.resolve(buy_response);
            }

            // REAL Mode: Allow Purchase.js to continue to api.send
            console.log(`[VH] REAL Mode: Placing real trade on your logged-in account ${api_base.account_id}`);
            return null;
        } catch (e) {
            console.error('[VH] Error in Virtual Hook logic:', e);
        }

        return null;
    }

    async runGhostSimulation(engine, contract_type, proposal, buy_info) {
        const { contract_id, underlying } = buy_info;
        const entry_tick = await engine.getLastTick(false);
        const duration = 5; // Simulation duration in ticks
        let ticks_count = 0;
        const start_time = Math.floor(Date.now() / 1000);

        // Inject INITIAL mock message to start UI tracking
        this.injectMockContract(buy_info, {
            status: 'open',
            date_start: start_time,
            entry_tick,
            entry_tick_time: start_time,
        });

        const tick_sub = api_base.api.onMessage().subscribe(({ data }) => {
            if (data.msg_type === 'tick' && data.tick.symbol === underlying) {
                ticks_count++;

                if (ticks_count >= duration) {
                    tick_sub.unsubscribe();
                    const exit_tick = data.tick.quote;
                    const profit = this.calculateGhostProfit(contract_type, entry_tick, exit_tick);

                    console.log(`[VH] Ghost Trade Result: ${profit > 0 ? 'WON' : 'LOST'} (Entry: ${entry_tick}, Exit: ${exit_tick})`);

                    // Inject FINAL mock message
                    this.injectMockContract(buy_info, {
                        status: profit > 0 ? 'won' : 'lost',
                        profit,
                        is_completed: true,
                        is_sold: true,
                        exit_tick,
                        exit_tick_time: Math.floor(Date.now() / 1000),
                    });

                    // Trigger close logic
                    this.onContractClosed({ profit, is_virtual_hook: true });
                }
            }
        });
    }

    calculateGhostProfit(type, entry, exit) {
        if (type.includes('CALL') || type.includes('UP')) {
            return exit > entry ? 1 : -1;
        }
        if (type.includes('PUT') || type.includes('DOWN')) {
            return exit < entry ? 1 : -1;
        }
        // Basic Digits Simulation
        if (type.includes('DIGIT')) {
            const last_digit = parseInt(exit.toString().split('').pop());
            // This is just a placeholder simulation
            return last_digit % 2 === 0 ? 1 : -1;
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
                currency: 'USD',
                is_virtual_hook: true,
                display_name: buy_info.underlying,
                ...overrides
            }
        };

        // Global Injection: Triggers UI updates and store updates
        api_base.bridge_subject.next(mock_msg);
    }

    onContractClosed(contract) {
        try {
            const DBotStore = require('../../scratch/dbot-store').default;
            const { client } = DBotStore.instance || {};
            const { is_enabled } = client?.virtual_hook_settings || {};

            if (!is_enabled) return;

            if (!this.vh_variables.has_started) {
                this.vh_variables.initial_trades_count++;
            }

            const profit = Number(contract.profit);
            if (this.vh_variables.mode === 'VIRTUAL') {
                if (profit < 0) {
                    this.vh_variables.consecutive_losses++;
                    console.log(`[VH] Virtual Loss. Total Consecutive: ${this.vh_variables.consecutive_losses}`);
                } else if (profit > 0) {
                    this.vh_variables.consecutive_losses = 0;
                    console.log(`[VH] Virtual Win. Counter reset.`);
                }
            } else if (this.vh_variables.mode === 'REAL') {
                this.vh_variables.real_trades_count++;
                console.log(`[VH] Real Trade. Total: ${this.vh_variables.real_trades_count}`);
            }
        } catch (e) {
            console.error('[VH] Error in onContractClosed:', e);
        }
    }
}

export default new VirtualHookManager();
