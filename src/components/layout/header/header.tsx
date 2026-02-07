import { useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { getAppId, redirectToLogin, standalone_routes } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import Modal from '@/components/shared_ui/modal';
import Text from '@/components/shared_ui/text';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import useTMB from '@/hooks/useTMB';
import { useFirebaseCountriesConfig } from '@/hooks/firebase/useFirebaseCountriesConfig';
import { Localize, useTranslations } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import AccountSwitcher from './account-switcher';
import MobileMenu from './mobile-menu';

import './header.scss';

const AppHeader = observer(() => {
    const { isDesktop } = useDevice();
    const { activeLoginid } = useApiBase();
    const { client } = useStore() ?? {};
    const { hubEnabledCountryList } = useFirebaseCountriesConfig();

    const { data: activeAccount } = useActiveAccount({ allBalanceData: client?.all_accounts_balance });
    const { accounts, getCurrency, is_virtual, all_loginids, switchAccount } = client ?? {};
    const has_wallet = Object.keys(accounts ?? {}).some(id => accounts?.[id].account_category === 'wallet');

    const virtual_account = all_loginids?.find(id => accounts?.[id]?.is_virtual);
    const real_account = all_loginids?.find(id => !accounts?.[id]?.is_virtual);

    const currency = getCurrency?.();
    const { localize, currentLang } = useTranslations();

    const { onRenderTMBCheck, isTmbEnabled } = useTMB();





    // No need for additional state management here since we're handling it in the layout component

    if (client?.should_hide_header) return null;
    return (
        <Header
            className={clsx('app-header', {
                'app-header--desktop': isDesktop,
                'app-header--mobile': !isDesktop,
            })}
        >
            <Wrapper variant='left'>
                {!isDesktop && <MobileMenu />}
                <AppLogo />
            </Wrapper>
            <Wrapper variant='right'>
                {activeLoginid && (
                    <>
                        {isDesktop && (
                            <>
                                {has_wallet ? (
                                    <Button
                                        className='manage-funds-button'
                                        has_effect
                                        text={localize('Manage funds')}
                                        onClick={() => {
                                            let redirect_url = new URL(standalone_routes.wallets_transfer);
                                            const is_hub_enabled_country = hubEnabledCountryList.includes(
                                                client?.residence || ''
                                            );
                                            if (is_hub_enabled_country) {
                                                redirect_url = new URL(standalone_routes.recent_transactions);
                                            }
                                            if (is_virtual) {
                                                redirect_url.searchParams.set('account', 'demo');
                                            } else if (currency) {
                                                redirect_url.searchParams.set('account', currency);
                                            }
                                            window.location.assign(redirect_url.toString());
                                        }}
                                        primary
                                    />
                                ) : null}



                                <Button
                                    tertiary
                                    onClick={() => {
                                        client.logout();
                                    }}
                                    className='logout-button'
                                >
                                    <Localize i18n_default_text='Log out' />
                                </Button>
                            </>
                        )}

                        <AccountSwitcher activeAccount={activeAccount} />
                    </>
                )}
                <div className='auth-actions'>
                    {!activeLoginid ? (
                        <>
                            <Button
                                primary
                                onClick={() => {
                                    redirectToLogin(false, currentLang);
                                }}
                            >
                                <Localize i18n_default_text='Log in' />
                            </Button>

                            <Button
                                primary
                                onClick={() => {
                                    window.open(standalone_routes.signup);
                                }}
                            >
                                <Localize i18n_default_text='Sign up' />
                            </Button>
                        </>
                    ) : null}
                </div>
            </Wrapper>





        </Header>
    );
});

export default AppHeader;
