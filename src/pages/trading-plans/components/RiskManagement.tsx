import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { localize } from '@deriv-com/translations';
import { Text } from '@deriv-com/ui';

const RiskManagement = () => {
    const [balance, setBalance] = useState<number>(1000);
    const [balanceInput, setBalanceInput] = useState<string>('1000.00');
    const [stakeInput, setStakeInput] = useState<string>('20.00');
    const [lossCount, setLossCount] = useState<number>(3);
    const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(2);
    const [takeProfit, setTakeProfit] = useState<number>(3);
    const [stopLoss, setStopLoss] = useState<number>(9);
    const [sessionsPerDay, setSessionsPerDay] = useState<number>(1);
    const [activePercentage, setActivePercentage] = useState<number | null>(0.02);

    const formatMoney = (num: number) => num.toFixed(2);

    const handleSetBalance = () => {
        const val = parseFloat(balanceInput);
        if (val > 0) {
            setBalance(val);
            setBalanceInput(formatMoney(val));
        }
    };

    const handleSetStakePercentage = (percentage: number) => {
        if (balance <= 0) return;
        const stake = balance * percentage;
        setStakeInput(formatMoney(stake));
        setActivePercentage(percentage);
    };

    const appendDigit = (digit: string) => {
        setActivePercentage(null);
        setStakeInput(prev => {
            if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
            if (digit === '0' && (prev === '0' || prev === '')) return '0';
            if (prev === '0') return digit;
            let next = prev + digit;
            if (next.startsWith('0') && !next.includes('.') && next.length > 1) {
                next = next.slice(1);
            }
            return next;
        });
    };

    const appendDecimal = () => {
        setActivePercentage(null);
        setStakeInput(prev => {
            if (!prev.includes('.')) {
                return prev ? prev + '.' : '0.';
            }
            return prev;
        });
    };

    const clearStake = () => {
        setStakeInput('');
        setActivePercentage(null);
    };

    const backspace = () => {
        setActivePercentage(null);
        setStakeInput(prev => prev.slice(0, -1));
    };

    const changeLossCount = (delta: number) => {
        setLossCount(prev => Math.max(1, Math.min(10, prev + delta)));
    };

    const stakeSteps = React.useMemo(() => {
        const base = parseFloat(stakeInput) || 0;
        const steps = [];
        let total = 0;
        for (let i = 0; i <= lossCount; i++) {
            const stake = base * Math.pow(martingaleMultiplier, i);
            total += stake;
            steps.push({
                index: i + 1,
                amount: formatMoney(stake),
                label: i === 0 ? localize('Base') : `x${martingaleMultiplier.toFixed(1)}`,
            });
        }
        return { steps, total };
    }, [stakeInput, lossCount, martingaleMultiplier]);

    const potentialPL = React.useMemo(() => {
        const base = parseFloat(stakeInput) || 0;
        return {
            profit: formatMoney(base + takeProfit),
            loss: formatMoney(Math.max(0, base - stopLoss)),
        };
    }, [stakeInput, takeProfit, stopLoss]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') appendDigit(e.key);
            else if (e.key === '.') appendDecimal();
            else if (e.key === 'Backspace') backspace();
            else if (e.key === 'Delete' || e.key === 'Escape') clearStake();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const percentageOptions = [0.01, 0.02, 0.05, 0.1, 0.15, 0.25, 0.5, 1];

    return (
        <div className='risk-management-calculator'>
            <div className='calculator-container'>
                <div className='balance-section'>
                    <div className='balance-display'>
                        <span className='balance-label'>{localize('ACCOUNT BALANCE')}</span>
                        <span className='balance-amount'>${formatMoney(balance)}</span>
                    </div>

                    <div className='balance-input-group'>
                        <input
                            type='number'
                            value={balanceInput}
                            onChange={e => setBalanceInput(e.target.value)}
                            placeholder={localize('Enter balance')}
                        />
                        <button onClick={handleSetBalance}>{localize('SET BALANCE')}</button>
                    </div>

                    <div className='stake-percentage-buttons'>
                        {percentageOptions.map(p => (
                            <button
                                key={p}
                                className={clsx('percentage-btn', { active: activePercentage === p })}
                                onClick={() => handleSetStakePercentage(p)}
                            >
                                {p * 100}%
                            </button>
                        ))}
                    </div>
                </div>

                <div className='stake-summary'>
                    <div className='stake-label'>{localize('CURRENT STAKE')}</div>
                    <div className='stake-amount'>${stakeInput || '0.00'}</div>
                    <div className='stake-info'>
                        {balance > 0 ? (((parseFloat(stakeInput) || 0) / balance) * 100).toFixed(2) : 0}%{' '}
                        {localize('of balance')}
                    </div>
                </div>

                <div className='keypad'>
                    {[7, 8, 9, 'C', 4, 5, 6, '⌫', 1, 2, 3, '.', 0].map((key, i) => (
                        <button
                            key={i}
                            className={clsx('key', {
                                clear: key === 'C',
                                backspace: key === '⌫',
                                zero: key === 0,
                                decimal: key === '.',
                            })}
                            onClick={() => {
                                if (typeof key === 'number') appendDigit(key.toString());
                                else if (key === 'C') clearStake();
                                else if (key === '⌫') backspace();
                                else if (key === '.') appendDecimal();
                            }}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                <div className='settings-section'>
                    <div className='section-title'>
                        <i className='fas fa-cog'></i>
                        <Text weight='bold'>{localize('Martingale Settings')}</Text>
                    </div>

                    <div className='martingale-grid'>
                        <div className='martingale-item'>
                            <span className='label'>{localize('Multiplier')}</span>
                            <span className='value'>{martingaleMultiplier.toFixed(1)}x</span>
                        </div>
                        <div className='martingale-strategies'>
                            {[1.5, 2, 3].map(m => (
                                <button
                                    key={m}
                                    className={clsx('strategy-btn', { active: martingaleMultiplier === m })}
                                    onClick={() => setMartingaleMultiplier(m)}
                                >
                                    {m}x
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='risk-inputs'>
                        <div className='risk-group'>
                            <label>{localize('Take Profit ($)')}</label>
                            <input
                                type='number'
                                value={takeProfit}
                                onChange={e => setTakeProfit(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className='risk-group'>
                            <label>{localize('Stop Loss ($)')}</label>
                            <input
                                type='number'
                                value={stopLoss}
                                onChange={e => setStopLoss(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className='consecutive-losses'>
                        <button onClick={() => changeLossCount(-1)}>−</button>
                        <div className='loss-display'>
                            <span className='count'>{lossCount}</span>
                            <span className='text'>{localize('Consecutive Losses')}</span>
                        </div>
                        <button onClick={() => changeLossCount(1)}>+</button>
                    </div>

                    <div className='sessions-selector-container'>
                        <div className='section-subtitle'>{localize('SESSIONS PER DAY')}</div>
                        <div className='sessions-buttons'>
                            {[1, 2, 3].map(s => (
                                <button
                                    key={s}
                                    className={sessionsPerDay === s ? 'active' : ''}
                                    onClick={() => setSessionsPerDay(s)}
                                >
                                    {s} {s === 1 ? localize('Session') : localize('Sessions')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='results-section'>
                    <div className='sequence-header'>
                        <i className='fas fa-list-ol'></i>
                        <span>{localize('Stake Sequence')}</span>
                    </div>
                    <div className='sequence-container'>
                        {stakeSteps.steps.map(step => (
                            <div key={step.index} className='sequence-step'>
                                <span className='step-num'>{step.index}</span>
                                <span className='step-amount'>${step.amount}</span>
                                <span className='step-label'>{step.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className='capital-info'>
                        <div className='info-row'>
                            <span>{localize('Required Capital')}</span>
                            <span className='total-capital'>${formatMoney(stakeSteps.total)}</span>
                        </div>
                        <div className='pl-grid'>
                            <div className='pl-item profit'>
                                <span className='label'>{localize('Win Scenario')}</span>
                                <span className='value'>+${potentialPL.profit}</span>
                            </div>
                            <div className='pl-item loss'>
                                <span className='label'>{localize('Loss Scenario')}</span>
                                <span className='value'>-${potentialPL.loss}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskManagement;
