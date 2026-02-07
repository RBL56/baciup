
import { api_base } from '../api/api-base';

class VirtualHookManager {
    constructor() {
        this.vh_variables = {
            mode: 'VIRTUAL', // Start in Virtual
            consecutive_losses: 0,
            real_trades_count: 0
        };
    }

    async onPurchase(engine, contract_type) {
        try {
            // Need to require here to avoid circular dependencies if any, though likely safe to import at top if DBotStore is structured well.
            // Using require to be safe and consistent with previous code.
            const DBotStore = require('../../scratch/dbot-store').default;
            const { client } = DBotStore.instance || {};
            const { is_enabled, virtual_trades_condition, real_trades_condition } = client?.virtual_hook_settings || {};

            if (!is_enabled) return null;

            // Log checking
            // console.log('[VH] Checking Virtual Hook conditions...');

            const accounts = Object.values(client.accounts);
            const virtual_account = accounts.find(a => a.is_virtual);
            const real_account = accounts.find(a => !a.is_virtual);

            if (!virtual_account || !real_account) {
                console.warn('[VH] Missing Virtual or Real account. Virtual Hook disabled.');
                return null;
            }

            let target_token = api_base.token;
            let should_switch = false;
            let new_mode = this.vh_variables.mode;

            // LOGIC: Mode Switching
            if (this.vh_variables.mode === 'VIRTUAL') {
                // Check conditions to switch to REAL
                if (this.vh_variables.consecutive_losses >= virtual_trades_condition) {
                    console.log(`[VH] Condition met (${virtual_trades_condition} consecutive losses). Switching to REAL mode.`);
                    new_mode = 'REAL';
                    this.vh_variables.real_trades_count = 0;
                    target_token = real_account.token;
                    should_switch = true;
                } else {
                    // Ensure we are on virtual account
                    if (api_base.account_id !== virtual_account.loginid) {
                        target_token = virtual_account.token;
                        should_switch = true;
                    }
                }
            } else {
                // REAL Mode
                // Check conditions to switch back to VIRTUAL
                const limit = real_trades_condition === 'Immediately' ? 1 : parseInt(real_trades_condition);

                // We check if we have completed the required trades
                if (this.vh_variables.real_trades_count >= limit) {
                    console.log(`[VH] Real trades limit (${limit}) reached. Switching back to VIRTUAL mode.`);
                    new_mode = 'VIRTUAL';
                    this.vh_variables.consecutive_losses = 0;
                    target_token = virtual_account.token;
                    should_switch = true;
                } else {
                    // Ensure we are on real account
                    if (api_base.account_id !== real_account.loginid) {
                        target_token = real_account.token;
                        should_switch = true;
                    }
                }
            }

            // Execute Switch if needed
            if (should_switch && target_token) {
                console.log(`[VH] Switching account to: ${target_token === virtual_account.token ? 'DEMO' : 'REAL'}`);

                // 1. Authorize
                const auth_res = await api_base.api.authorize(target_token);

                if (auth_res.authorize) {
                    const { loginid, balance, currency } = auth_res.authorize;

                    // 2. Update API Base state
                    api_base.token = target_token;
                    api_base.account_id = loginid;
                    api_base.account_info = auth_res.authorize;

                    // 3. Update Client Store (UI)
                    client.setLoginId(loginid);
                    client.setBalance(balance);
                    client.setCurrency(currency);
                    client.setIsLoggedIn(true);

                    // Persist active loginid
                    localStorage.setItem('active_loginid', loginid);
                    localStorage.setItem('authToken', target_token);

                    // 4. Refresh Subscriptions for new account (important for balance updates)
                    api_base.unsubscribeAllSubscriptions();
                    await api_base.subscribe();

                    // 5. Update VH Mode
                    this.vh_variables.mode = new_mode;

                    // 6. Notify UI
                    const account_type = loginid.startsWith('CR') ? 'Real' : 'Demo';
                    console.log(`[VH] Switched to ${account_type} (${loginid}). Mode: ${new_mode}`);

                    // 7. Refresh Proposals for new account
                    // We need a fresh proposal ID for the new account to avoid InvalidContractProposal errors
                    engine.renewProposalsOnPurchase();

                    // Wait for proposals to be ready
                    await new Promise(resolve => {
                        const check = () => {
                            if (engine.store.getState().proposalsReady) {
                                resolve();
                            } else {
                                setTimeout(check, 200);
                            }
                        };
                        check();
                    });

                    // Select new proposal
                    const { id: newId, askPrice: newAskPrice } = engine.selectProposal(contract_type);

                    // Execute trade with NEW proposal
                    // RETURN the trade promise so Purchase.js uses this instead of proceeding
                    return api_base.api.send({ buy: newId, price: newAskPrice });
                }
            }
        } catch (e) {
            console.error('[VH] Error in Virtual Hook logic:', e);
        }

        // Return null to indicate no special action was taken, proceed with normal flow
        return null;
    }

    onContractClosed(contract) {
        // Only track if we have initialized vh_variables (which we have in constructor)
        // But we should double check if VH is enabled to avoid unnecessary logic? 
        // Actually, we might want to track always or check store.

        try {
            const DBotStore = require('../../scratch/dbot-store').default;
            const { client } = DBotStore.instance || {};
            const { is_enabled } = client?.virtual_hook_settings || {};

            if (!is_enabled) return;

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
