import { useMemo } from 'react';
import { CurrencyIcon } from '@/components/currency/currency-icon';
import { addComma, getDecimalPlaces } from '@/components/shared';
import { useApiBase } from '@/hooks/useApiBase';
import { Balance } from '@deriv/api-types';
import { localize } from '@deriv-com/translations';

/** A custom hook that returns the account object for the current active account. */
const useActiveAccount = ({ allBalanceData }: { allBalanceData: Balance | null }) => {
    const { accountList, activeLoginid } = useApiBase();

    const activeAccount = useMemo(
        () =>
            accountList?.find(account => account.loginid === activeLoginid) ||
            (activeLoginid ? { loginid: activeLoginid, currency: 'USD', is_virtual: activeLoginid.includes('VRT') } : undefined),
        [activeLoginid, accountList]
    );

    const currentBalanceData =
        allBalanceData?.accounts?.[activeAccount?.loginid ?? ''] ||
        (allBalanceData?.loginid === activeAccount?.loginid ? allBalanceData : undefined);

    const modifiedAccount = useMemo(() => {
        const displayCurrency = activeAccount?.currency || 'USD';

        // Improved balance retrieval with multiple fallback strategies
        let balanceValue = 0;
        if (currentBalanceData?.balance !== undefined) {
            balanceValue = currentBalanceData.balance;
        } else if (activeAccount?.balance !== undefined) {
            // Fallback to account balance if available
            balanceValue = typeof activeAccount.balance === 'number'
                ? activeAccount.balance
                : parseFloat(activeAccount.balance.toString()) || 0;
        }

        const formattedBalance = addComma(
            balanceValue.toFixed(getDecimalPlaces(currentBalanceData?.currency || displayCurrency))
        );

        return activeAccount
            ? {
                ...activeAccount,
                currency: displayCurrency,
                balance: formattedBalance,
                currencyLabel: activeAccount?.is_virtual ? localize('Demo') : displayCurrency,
                icon: (
                    <CurrencyIcon
                        currency={displayCurrency?.toLowerCase()}
                        isVirtual={Boolean(activeAccount?.is_virtual)}
                    />
                ),
                isVirtual: Boolean(activeAccount?.is_virtual),
                isActive: activeAccount?.loginid === activeLoginid,
            }
            : undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAccount, activeLoginid, allBalanceData]);

    return {
        /** User's current active account. */
        data: modifiedAccount,
    };
};

export default useActiveAccount;
