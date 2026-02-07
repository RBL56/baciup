
import { api_base } from '../api/api-base';

class VirtualHookManager {
    constructor() {
        this.vh_variables = {
            mode: 'VIRTUAL', // Start in Virtual
            consecutive_losses: 0,
            real_trades_count: 0,
            initial_trades_count: 0,
            has_started: false
        };
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
                    // We continue below, but we will STAY in VIRTUAL mode and skip streak checks
                } else {
                    this.vh_variables.has_started = true;
                    console.log('[VH] Initial delay finished. Virtual Hook tracking active.');
                }
            }

            const accounts = Object.values(client.accounts || {});
            const virtual_account = accounts.find(a => a.is_virtual);
            const real_account = accounts.find(a => !a.is_virtual);
            const current_account_id = api_base.account_id || localStorage.getItem('active_loginid');

            let new_mode = this.vh_variables.mode;
            let target_account = null;

            // 2. Logic: Mode Switching Condition Check
            // We ONLY check streak conditions if the initial delay has passed
            if (this.vh_variables.has_started) {
                if (this.vh_variables.mode === 'VIRTUAL') {
                    if (this.vh_variables.consecutive_losses >= virtual_trades_condition) {
                        console.log(`[VH] Condition met (${virtual_trades_condition} losses). Target REAL mode.`);
                        new_mode = 'REAL';
                        this.vh_variables.real_trades_count = 0;
                        target_account = real_account || accounts.find(a => a.loginid === current_account_id);
                    } else {
                        target_account = virtual_account || accounts.find(a => a.loginid === current_account_id);
                    }
                } else {
                    // REAL Mode
                    const limit = real_trades_condition === 'Immediately' ? 1 : parseInt(real_trades_condition);
                    if (this.vh_variables.real_trades_count >= limit) {
                        console.log(`[VH] Real trades limit (${limit}) reached. Returning to VIRTUAL mode.`);
                        new_mode = 'VIRTUAL';
                        this.vh_variables.consecutive_losses = 0;
                        target_account = virtual_account || accounts.find(a => a.loginid === current_account_id);
                    } else {
                        target_account = real_account || accounts.find(a => a.loginid === current_account_id);
                    }
                }
            } else {
                // During initial delay, ALWAYS target the virtual account to start safely if Virtual Hook is on
                target_account = virtual_account || accounts.find(a => a.loginid === current_account_id);
                new_mode = 'VIRTUAL';
            }

            // 3. Execution: Determine if a systemic switch is required
            const is_different_account = target_account && target_account.loginid !== current_account_id;

            if (is_different_account) {
                console.log(`[VH] Switching account: ${current_account_id} -> ${target_account.loginid}`);

                // CRITICAL: Update token in api_base BEFORE authorizing, otherwise it will re-auth the old account
                api_base.token = target_account.token;

                // Prepare persistence
                localStorage.setItem('active_loginid', target_account.loginid);
                localStorage.setItem('authToken', target_account.token);

                // Update Client Store (UI)
                client.setLoginId(target_account.loginid);
                client.setIsLoggedIn(true);

                // Systemic Switch
                await api_base.authorizeAndSubscribe();

                // Sync Engine
                engine.token = api_base.token;
                engine.accountInfo = api_base.account_info;

                // Sync Mode
                this.vh_variables.mode = new_mode;

                console.log(`[VH] Switched to ${target_account.loginid}. Mode: ${new_mode}`);

                // Refresh Proposals for NEW account
                engine.renewProposalsOnPurchase();
                await this.waitForProposals(engine);

                // Execute trade with NEW proposal
                const { id: newId, askPrice: newAskPrice } = engine.selectProposal(contract_type);
                return api_base.api.send({ buy: newId, price: newAskPrice });
            } else {
                // Same account (Normal flow or Single-account loss filtering)
                if (this.vh_variables.mode !== new_mode) {
                    this.vh_variables.mode = new_mode;
                    console.log(`[VH] Mode Changed: ${new_mode} (Staying on account ${current_account_id})`);
                }

                return null;
            }
        } catch (e) {
            console.error('[VH] Error in Virtual Hook logic:', e);
        }

        return null;
    }

    async waitForProposals(engine) {
        return new Promise(resolve => {
            const check = () => {
                const state = engine.store.getState();
                if (state?.proposalsReady) {
                    resolve();
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    }

    onContractClosed(contract) {
        try {
            const DBotStore = require('../../scratch/dbot-store').default;
            const { client } = DBotStore.instance || {};
            const { is_enabled } = client?.virtual_hook_settings || {};

            if (!is_enabled) return;

            // Increment initial count if not started
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
