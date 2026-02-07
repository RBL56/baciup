import { getRoundedNumber } from '@/components/shared';
import { api_base } from '../../api/api-base';
import { contract as broadcastContract, contractStatus } from '../utils/broadcast';
import { openContractReceived, sell } from './state/actions';

export default Engine =>
    class OpenContract extends Engine {
        observeOpenContract() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'proposal_open_contract') {
                    const contract = data.proposal_open_contract;

                    if (!contract || !this.expectedContractId(contract?.contract_id)) {
                        return;
                    }

                    this.setContractFlags(contract);

                    this.data.contract = contract;

                    broadcastContract({ accountID: api_base.account_info.loginid, ...contract });

                    if (this.isSold) {
                        this.contractId = '';
                        clearTimeout(this.transaction_recovery_timeout);
                        this.updateTotals(contract);

                        // Optimistically update balance when contract is sold
                        // We add the sell_price (payout) back to balance (pass negative to subtract logic)
                        const sellPrice = contract.sell_price || contract.bid_price;
                        if (sellPrice) {
                            const balance_update_start = performance.now();
                            try {
                                const DBotStore = require('../../../scratch/dbot-store').default;
                                const { client } = DBotStore.instance || {};
                                if (client && client.updateBalanceOnTrade) {
                                    client.updateBalanceOnTrade(-parseFloat(sellPrice));

                                    const optimistic_update_time = performance.now() - balance_update_start;
                                    console.log(`[OpenContract] Optimistic balance update on sell in ${optimistic_update_time.toFixed(2)}ms`);
                                }

                                // Force balance refresh for accurate update - immediate, no delay
                                if (this.forceBalanceUpdate) {
                                    // Use Promise.resolve to ensure this runs immediately
                                    Promise.resolve().then(() => {
                                        this.forceBalanceUpdate();
                                    });
                                }
                            } catch (e) {
                                console.error('Optimistic balance update on sell failed', e);
                            }
                        }

                        contractStatus({
                            id: 'contract.sold',
                            data: contract.transaction_ids.sell,
                            contract,
                        });

                        // VIRTUAL HOOK LOGIC START
                        const VirtualHookManager = require('../VirtualHookManager').default;
                        VirtualHookManager.onContractClosed(contract);
                        // VIRTUAL HOOK LOGIC END

                        if (this.afterPromise) {
                            this.afterPromise();
                        }

                        this.store.dispatch(sell());
                    } else {
                        this.store.dispatch(openContractReceived());
                    }
                }
            });
            api_base.pushSubscription(subscription);
        }

        waitForAfter() {
            return new Promise(resolve => {
                this.afterPromise = resolve;
            });
        }

        setContractFlags(contract) {
            const { is_expired, is_valid_to_sell, is_sold, entry_tick } = contract;

            this.isSold = Boolean(is_sold);
            this.isSellAvailable = !this.isSold && Boolean(is_valid_to_sell);
            this.isExpired = Boolean(is_expired);
            this.hasEntryTick = Boolean(entry_tick);
        }

        expectedContractId(contractId) {
            return this.contractId && contractId === this.contractId;
        }

        getSellPrice() {
            const { bid_price: bidPrice, buy_price: buyPrice, currency } = this.data.contract;
            return getRoundedNumber(Number(bidPrice) - Number(buyPrice), currency);
        }
    };
