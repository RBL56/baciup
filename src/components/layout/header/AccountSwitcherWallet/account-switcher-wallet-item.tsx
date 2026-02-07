import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { formatMoney, getCurrencyDisplayCode } from '@/components/shared';
import { AppLinkedWithWalletIcon } from '@/components/shared_ui/app-linked-with-wallet-icon';
import Text from '@/components/shared_ui/text';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import useStoreWalletAccountsList from '@/hooks/useStoreWalletAccountsList';
import { Analytics } from '@deriv-com/analytics';
import { Localize, localize } from '@deriv-com/translations';
import WalletBadge from '../wallets/wallet-badge';
import './account-switcher-wallet-item.scss';

type TAccountSwitcherWalletItemProps = {
    account: Exclude<ReturnType<typeof useStoreWalletAccountsList>['data'], undefined>[number];
    closeAccountsDialog: () => void;
    show_badge?: boolean;
};

export const AccountSwitcherWalletItem = observer(
    ({ closeAccountsDialog, account, show_badge = false }: TAccountSwitcherWalletItemProps) => {
        const {
            currency,
            dtrade_loginid,
            dtrade_balance,
            gradients,
            icons,
            is_virtual,
            landing_company_name,
            icon_type,
            is_wallet,
        } = account;

        const {
            ui: { is_dark_mode_on },
            client,
        } = useStore();

        const { loginid: active_loginid, is_eu, is_switching } = client;

        const theme = is_dark_mode_on ? 'dark' : 'light';
        const app_icon = is_dark_mode_on ? 'IcWalletOptionsDark' : 'IcWalletOptionsLight';
        const is_dtrade_active = dtrade_loginid === active_loginid;
        const is_switching_this_account = is_switching && is_dtrade_active;

        const handleSwitchAccount = async (loginId: string | number) => {
            // Use the centralized switchAccount from ClientStore to ensure consistency
            if (client && !is_switching) {
                await client.switchAccount(loginId.toString());
                closeAccountsDialog();
            }
        };

        return (
            <button
                className={classNames('acc-switcher-wallet-item__container', {
                    'acc-switcher-wallet-item__container--active': is_dtrade_active,
                    'acc-switcher-wallet-item__container--switching': is_switching_this_account,
                })}
                data-testid='account-switcher-wallet-item'
                onClick={() => handleSwitchAccount(dtrade_loginid)}
                disabled={is_switching}
            >
                <div className='acc-switcher-wallet-item__icon-container'>
                    {is_wallet ? (
                        <AppLinkedWithWalletIcon
                            app_icon={app_icon}
                            gradient_class={gradients?.card[theme] ?? ''}
                            type={icon_type}
                            wallet_icon={icons?.[theme] ?? ''}
                            hide_watermark
                        />
                    ) : (
                        <div className='acc-switcher-wallet-item__trading-icon'>
                            <AppLinkedWithWalletIcon
                                app_icon={app_icon}
                                gradient_class='trading-account-card'
                                type={icon_type}
                                wallet_icon={icons?.[theme] ?? ''}
                                hide_watermark
                            />
                        </div>
                    )}
                </div>
                <div className='acc-switcher-wallet-item__content'>
                    <Text size='xxxs' color='less-prominent' align='left'>
                        {is_eu ? (
                            <Localize i18n_default_text='Multipliers' />
                        ) : (
                            <Localize i18n_default_text='Options' />
                        )}
                    </Text>
                    <Text size='xxxs' weight='bold' align='left'>
                        {is_virtual ? (
                            <Localize i18n_default_text='Demo Account' />
                        ) : (
                            <Localize
                                i18n_default_text='{{currency}} {{account_type}}'
                                values={{
                                    currency: getCurrencyDisplayCode(currency),
                                    account_type: is_wallet ? localize('Wallet') : localize('Account'),
                                }}
                            />
                        )}
                    </Text>
                    <Text size='xs' weight='bold' align='left'>
                        {is_switching_this_account ? (
                            <Localize i18n_default_text='Switching...' />
                        ) : (
                            `${formatMoney(currency ?? '', dtrade_balance || 0, true)} ${getCurrencyDisplayCode(
                                currency
                            )}`
                        )}
                    </Text>
                </div>
                {show_badge && <WalletBadge is_demo={Boolean(is_virtual)} label={landing_company_name} />}
            </button>
        );
    }
);
