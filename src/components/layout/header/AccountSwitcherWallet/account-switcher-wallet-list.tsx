import React from 'react';
import { TStores } from '@deriv/stores/types';
import { AccountSwitcherWalletItem } from './account-switcher-wallet-item';
import './account-switcher-wallet-list.scss';

type TAccountSwitcherWalletListProps = {
    wallets: TStores['client']['wallet_list'];
    closeAccountsDialog: () => void;
};

export const AccountSwitcherWalletList = ({ wallets, closeAccountsDialog }: TAccountSwitcherWalletListProps) => {
    const sortedWallets = [...wallets].sort((a, b) => {
        // Prioritize virtual accounts (Demo)
        if (a.is_virtual !== b.is_virtual) {
            return a.is_virtual ? -1 : 1;
        }
        // Remove commas from balance strings before converting to numbers
        const balanceA = Number(a.dtrade_balance?.toString().replace(/,/g, '') || 0);
        const balanceB = Number(b.dtrade_balance?.toString().replace(/,/g, '') || 0);
        return balanceB - balanceA;
    });
    return (
        <div className='account-switcher-wallet-list'>
            {sortedWallets?.map(account => {
                if (account.is_dtrader_account_disabled) return null;
                return (
                    <AccountSwitcherWalletItem
                        key={account.dtrade_loginid}
                        account={account}
                        closeAccountsDialog={closeAccountsDialog}
                        show_badge={account?.is_virtual}
                    />
                );
            })}
        </div>
    );
};
