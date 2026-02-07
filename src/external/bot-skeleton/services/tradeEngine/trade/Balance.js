import { getFormattedText } from '@/components/shared';
import DBotStore from '../../../scratch/dbot-store';
import { api_base } from '../../api/api-base';
import { info } from '../utils/broadcast';

let balance_string = '';
let balance_update_in_flight = false;
let last_balance_update_time = 0;

export default Engine =>
    class Balance extends Engine {
        observeBalance() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data?.msg_type === 'balance' && data?.balance) {
                    const start_time = performance.now();
                    const {
                        balance: { balance: b, currency },
                    } = data;

                    balance_string = getFormattedText(b, currency);

                    // Immediately update the client store for faster UI refresh
                    const { client } = DBotStore.instance || {};
                    if (client && client.setBalance) {
                        const { getDecimalPlaces } = require('@/components/shared');

                        // Use requestAnimationFrame for immediate UI update
                        requestAnimationFrame(() => {
                            client.setBalance(b.toFixed(getDecimalPlaces(currency)));
                            client.setCurrency(currency);

                            const update_time = performance.now() - start_time;
                            console.log(`[Balance] UI updated in ${update_time.toFixed(2)}ms`);
                        });
                    }

                    // Clear in-flight flag
                    balance_update_in_flight = false;
                    last_balance_update_time = Date.now();

                    if (this.accountInfo) info({ accountID: this.accountInfo.loginid, balance: balance_string });
                }
            });
            api_base.pushSubscription(subscription);
        }

        // Force balance refresh - useful during active trading
        // Optimized with request deduplication to prevent redundant API calls
        forceBalanceUpdate() {
            if (!api_base.api) return;

            // Prevent redundant requests if one is already in-flight
            const time_since_last_update = Date.now() - last_balance_update_time;
            if (balance_update_in_flight && time_since_last_update < 100) {
                console.log('[Balance] Skipping redundant balance update request');
                return Promise.resolve();
            }

            balance_update_in_flight = true;
            const request_start = performance.now();

            // Request immediate balance update
            return api_base.api.send({ balance: 1, subscribe: 1 })
                .then(response => {
                    const request_time = performance.now() - request_start;
                    console.log(`[Balance] Refresh completed in ${request_time.toFixed(2)}ms`);
                    return response;
                })
                .catch(error => {
                    balance_update_in_flight = false;
                    console.error('Failed to force balance update:', error);
                    throw error;
                });
        }

        // eslint-disable-next-line class-methods-use-this
        getBalance(type) {
            const { client } = DBotStore.instance;
            const balance = (client && client.balance) || 0;

            balance_string = getFormattedText(balance, client.currency, false);
            return type === 'STR' ? balance_string : balance;
        }
    };
