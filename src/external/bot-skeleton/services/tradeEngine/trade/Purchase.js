import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            const onSuccess = response => {
                // Don't unnecessarily send a forget request for a purchased contract.
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
                    this.renewProposalsOnPurchase();
                }

                // Immediately update balance to reflect the trade
                if (buy.buy_price) {
                    const balance_update_start = performance.now();
                    try {
                        const DBotStore = require('../../../scratch/dbot-store').default;
                        const { client } = DBotStore.instance || {};
                        if (client && client.updateBalanceOnTrade) {
                            client.updateBalanceOnTrade(parseFloat(buy.buy_price));

                            const optimistic_update_time = performance.now() - balance_update_start;
                            console.log(`[Purchase] Optimistic balance update in ${optimistic_update_time.toFixed(2)}ms`);
                        }

                        // Force balance refresh for accurate update - immediate, no delay
                        if (this.forceBalanceUpdate) {
                            // Use Promise.resolve to ensure this runs immediately
                            Promise.resolve().then(() => {
                                this.forceBalanceUpdate();
                            });
                        }
                    } catch (error) {
                        console.error('Failed to update balance on trade:', error);
                    }
                }

                delayIndex = 0;
                log(LogTypes.PURCHASE, { longcode: buy.longcode, transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            if (this.is_proposal_subscription_required) {
                const { id, askPrice } = this.selectProposal(contract_type);

                const action = async () => {
                    // VIRTUAL HOOK LOGIC START
                    try {
                        const DBotStore = require('../../../scratch/dbot-store').default;
                        const { client } = DBotStore.instance || {};
                        const { is_enabled, virtual_trades_condition, real_trades_condition } = client?.virtual_hook_settings || {};

                        if (is_enabled) {
                            // Initialize VH state if not present
                            if (!this.vh_variables) {
                                this.vh_variables = {
                                    mode: 'VIRTUAL', // Start in Virtual
                                    consecutive_losses: 0,
                                    real_trades_count: 0
                                };
                            }

                            const accounts = Object.values(client.accounts);
                            const virtual_account = accounts.find(a => a.is_virtual);
                            const real_account = accounts.find(a => !a.is_virtual);

                            if (!virtual_account || !real_account) {
                                console.warn('[VH] Missing Virtual or Real account. Virtual Hook disabled.');
                            } else {
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
                                        // We need to re-subscribe to balance/transaction/proposals for the new account
                                        api_base.unsubscribeAllSubscriptions();
                                        await api_base.subscribe();

                                        // 5. Update VH Mode
                                        this.vh_variables.mode = new_mode;

                                        // 6. Notify UI
                                        const account_type = loginid.startsWith('CR') ? 'Real' : 'Demo';
                                        console.log(`[VH] Switched to ${account_type} (${loginid}). Mode: ${new_mode}`);
                                        // 7. Refresh Proposals for new account
                                        // We need a fresh proposal ID for the new account to avoid InvalidContractProposal errors
                                        this.renewProposalsOnPurchase();

                                        // Wait for proposals to be ready
                                        await new Promise(resolve => {
                                            const check = () => {
                                                if (this.store.getState().proposalsReady) {
                                                    resolve();
                                                } else {
                                                    setTimeout(check, 200);
                                                }
                                            };
                                            check();
                                        });

                                        // Select new proposal
                                        const { id: newId, askPrice: newAskPrice } = this.selectProposal(contract_type);

                                        // Execute trade with NEW proposal
                                        return api_base.api.send({ buy: newId, price: newAskPrice });
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[VH] Error in Virtual Hook logic:', e);
                    }
                    // VIRTUAL HOOK LOGIC END

                    return api_base.api.send({ buy: id, price: askPrice });
                };

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                if (!this.options.timeMachineEnabled) {
                    return doUntilDone(action).then(onSuccess).then(() => {
                        // UPDATE VH INVALID STATE ON COMPLETION
                        const DBotStore = require('../../../scratch/dbot-store').default;
                        const { client } = DBotStore.instance || {};
                        const vh_settings = client?.virtual_hook_settings;

                        // We check contract result
                        // The `onSuccess` callback receives `response`.
                        // But here we are IN the promise chain.
                        // We need to capture the result.
                    });
                }

                return recoverFromError(
                    action,
                    (errorCode, makeDelay) => {
                        // if disconnected no need to resubscription (handled by live-api)
                        if (errorCode !== 'DisconnectError') {
                            this.renewProposalsOnPurchase();
                        } else {
                            this.clearProposals();
                        }

                        const unsubscribe = this.store.subscribe(() => {
                            const { scope, proposalsReady } = this.store.getState();
                            if (scope === BEFORE_PURCHASE && proposalsReady) {
                                makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                                unsubscribe();
                            }
                        });
                    },
                    ['PriceMoved', 'InvalidContractProposal'],
                    delayIndex++
                ).then(onSuccess);
            }
            const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);
            const action = () => api_base.api.send(trade_option);

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return doUntilDone(action).then(onSuccess);
            }

            return recoverFromError(
                action,
                (errorCode, makeDelay) => {
                    if (errorCode === 'DisconnectError') {
                        this.clearProposals();
                    }
                    const unsubscribe = this.store.subscribe(() => {
                        const { scope } = this.store.getState();
                        if (scope === BEFORE_PURCHASE) {
                            makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                            unsubscribe();
                        }
                    });
                },
                ['PriceMoved', 'InvalidContractProposal'],
                delayIndex++
            ).then(onSuccess);
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
