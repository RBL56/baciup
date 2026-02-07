import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { contract_stages } from '@/constants/contract-stage';
import { api_base, observer as botObserver, updateWorkspaceName } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import './speed-bot.scss';

// Transaction Type
type Transaction = {
    id: number;
    ref: string;
    contract_type: string;
    stake: number;
    payout: number;
    profit: string;
    status: 'pending' | 'won' | 'lost' | 'running';
    timestamp: number;
    barrier?: number | string;
    entry_digit?: number;
    exit_digit?: number;
    batch_id?: number;
    batch_size?: number;
};


// Journal Entry Type
type JournalEntry = {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'trade';
    timestamp: number;
    is_demo?: boolean;
    volatility?: string;
    barrier?: number | string;
};

const SpeedBot = observer(() => {
    const { connectionStatus, isAuthorized } = useApiBase();
    const { client, run_panel, summary_card, transactions: transactionsStore, dashboard } = useStore();

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2200);
    }, []);

    // -- State --
    const [volatility, setVolatility] = useState('R_10');
    const [tradeType, setTradeType] = useState('DIGITMATCH');
    const [ticks, setTicks] = useState(1);
    const [stake, setStake] = useState(0.5);

    // Bulk
    const [bulkEnabled, setBulkEnabled] = useState(false);
    const [bulkTrades, setBulkTrades] = useState(1);

    // Entry
    const [entryEnabled, setEntryEnabled] = useState(false);
    const [entryPoint, setEntryPoint] = useState('single');
    const [entryDigit, setEntryDigit] = useState(5);
    const [digitRangeStart, setDigitRangeStart] = useState(0);
    const [digitRangeEnd, setDigitRangeEnd] = useState(9);

    // Prediction
    const [predictionMode, setPredictionMode] = useState('single');
    const [singleDigit, setSingleDigit] = useState(5);
    const [singleStake, setSingleStake] = useState(0.5);
    const [predPre, setPredPre] = useState<string | number>(5);
    const [predPost, setPredPost] = useState<string | number>(7);
    const [recoveryContractType, setRecoveryContractType] = useState('DIGITOVER');
    const [predictions, setPredictions] = useState<{ digit: number; stake: number; id: number }[]>([]);

    // Martingale
    const [martingaleEnabled, setMartingaleEnabled] = useState(true);
    const [martingaleMultiplier, setMartingaleMultiplier] = useState(1.2);

    // Limits
    const [stopLossTotalEnabled, setStopLossTotalEnabled] = useState(true);
    const [stopLossTotal, setStopLossTotal] = useState(-40);
    const [stopLossConsecutiveEnabled, setStopLossConsecutiveEnabled] = useState(true);
    const [stopLossConsecutive, setStopLossConsecutive] = useState(6);
    const [takeProfitEnabled, setTakeProfitEnabled] = useState(true);
    const [takeProfitTotal, setTakeProfitTotal] = useState(35);

    // Live Data
    const [digits, setDigits] = useState<{ value: number; color: string }[]>([]);
    const [ldpStats, setLdpStats] = useState<number[]>(Array(10).fill(0));
    const [entropy, setEntropy] = useState<string>('—');
    const [lastDigit, setLastDigit] = useState<string | number>('—');

    // Transactions
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isAutoTrading, setIsAutoTrading] = useState(false);
    const [isTrading, setIsTrading] = useState(false);
    const [currentStake, setCurrentStake] = useState(0.5);
    const [consecutiveLosses, setConsecutiveLosses] = useState(0);
    const [totalProfit, setTotalProfit] = useState(0);
    const [totalWins, setTotalWins] = useState(0);
    const [totalLosses, setTotalLosses] = useState(0);
    const [lastResultDisplay, setLastResultDisplay] = useState<'WIN' | 'LOSS' | null>(null);
    const [debugStatus, setDebugStatus] = useState('Idle');
    const [ticksCount, setTicksCount] = useState(0);
    const [lastTickColor, setLastTickColor] = useState('');
    const [journal, setJournal] = useState<JournalEntry[]>([]);


    const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'journal'>('transactions');

    const liveDigitsRef = useRef<HTMLDivElement>(null);
    const lastDigitRef = useRef<HTMLDivElement>(null);
    const liveDigitsBufferRef = useRef<{ value: number; color: string }[]>([]);
    const ldpCellsRef = useRef<(HTMLDivElement | null)[]>([]);

    const pendingBatchRef = useRef<Map<string, { id: number, size: number }>>(new Map());

    const digitHistoryRef = useRef<number[]>([]);
    const lastResultRef = useRef<'won' | 'lost' | null>(null);
    const activeContractIdsRef = useRef<Set<string>>(new Set());
    const subscriptionIdRef = useRef<string | null>(null);

    // Refs for stale closure fixes in transactional monitor & auto engine
    const isAutoTradingRef = useRef(isAutoTrading);
    const martingaleEnabledRef = useRef(martingaleEnabled);
    const martingaleMultiplierRef = useRef(martingaleMultiplier);
    const stakeRef = useRef(stake);
    const currentStakeRef = useRef(currentStake);
    const consecutiveLossesRef = useRef(consecutiveLosses);
    const isTradingRef = useRef(isTrading);
    const totalProfitRef = useRef(totalProfit);
    const stopLossTotalRef = useRef(stopLossTotal);
    const stopLossTotalEnabledRef = useRef(stopLossTotalEnabled);
    const takeProfitTotalRef = useRef(takeProfitTotal);
    const takeProfitEnabledRef = useRef(takeProfitEnabled);
    const stopLossConsecutiveRef = useRef(stopLossConsecutive);
    const stopLossConsecutiveEnabledRef = useRef(stopLossConsecutiveEnabled);
    const transactionsRef = useRef(transactions);

    // -- New Refs for Config to fix stale closures --
    const volatilityRef = useRef(volatility);
    const tradeTypeRef = useRef(tradeType);
    const ticksRef = useRef(ticks);
    const bulkEnabledRef = useRef(bulkEnabled);
    const bulkTradesRef = useRef(bulkTrades);
    const entryEnabledRef = useRef(entryEnabled);
    const entryPointRef = useRef(entryPoint);
    const entryDigitRef = useRef(entryDigit);
    const digitRangeStartRef = useRef(digitRangeStart);
    const digitRangeEndRef = useRef(digitRangeEnd);
    const predictionModeRef = useRef(predictionMode);
    const singleDigitRef = useRef(singleDigit);
    const singleStakeRef = useRef(singleStake);
    const predPreRef = useRef(predPre);
    const predPostRef = useRef(predPost);
    const recoveryContractTypeRef = useRef(recoveryContractType);
    const predictionsRef = useRef(predictions);
    const hasTriggeredEntryRef = useRef(false);

    // -- Run Mode & Mutex --
    const [runMode, setRunMode] = useState<'continuous' | 'once'>('continuous');
    const runModeRef = useRef(runMode);
    const [showRunMenu, setShowRunMenu] = useState(false); // For the dropdown
    const runMenuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (runMenuRef.current && !runMenuRef.current.contains(event.target as Node)) {
                setShowRunMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Stop bot when switching tabs
    useEffect(() => {
        if (dashboard.active_tab !== DBOT_TABS.SPEED_BOT && isAutoTradingRef.current) {
            console.log('[SpeedBot] Tab changed, stopping auto-trader.');
            setIsAutoTrading(false);
            isAutoTradingRef.current = false;
            botObserver.emit('bot.stop');
            run_panel.setIsRunning(false);
            showToast('Auto Trading Stopped (Tab Switched)');
        }
    }, [dashboard.active_tab, run_panel, showToast]);

    useEffect(() => { volatilityRef.current = volatility; }, [volatility]);
    useEffect(() => { tradeTypeRef.current = tradeType; }, [tradeType]);
    useEffect(() => { ticksRef.current = ticks; }, [ticks]);
    useEffect(() => { bulkEnabledRef.current = bulkEnabled; }, [bulkEnabled]);
    useEffect(() => { bulkTradesRef.current = bulkTrades; }, [bulkTrades]);
    useEffect(() => { entryEnabledRef.current = entryEnabled; }, [entryEnabled]);
    useEffect(() => { entryPointRef.current = entryPoint; }, [entryPoint]);
    useEffect(() => { entryDigitRef.current = entryDigit; }, [entryDigit]);
    useEffect(() => { digitRangeStartRef.current = digitRangeStart; }, [digitRangeStart]);
    useEffect(() => { digitRangeEndRef.current = digitRangeEnd; }, [digitRangeEnd]);
    useEffect(() => { predictionModeRef.current = predictionMode; }, [predictionMode]);
    useEffect(() => { singleDigitRef.current = singleDigit; }, [singleDigit]);
    useEffect(() => { singleStakeRef.current = singleStake; }, [singleStake]);
    useEffect(() => { predPreRef.current = predPre; }, [predPre]);
    useEffect(() => { predPostRef.current = predPost; }, [predPost]);
    useEffect(() => { recoveryContractTypeRef.current = recoveryContractType; }, [recoveryContractType]);
    useEffect(() => { predictionsRef.current = predictions; }, [predictions]);
    useEffect(() => { runModeRef.current = runMode; }, [runMode]);

    useEffect(() => { isAutoTradingRef.current = isAutoTrading; }, [isAutoTrading]);
    useEffect(() => { martingaleEnabledRef.current = martingaleEnabled; }, [martingaleEnabled]);
    useEffect(() => { martingaleMultiplierRef.current = martingaleMultiplier; }, [martingaleMultiplier]);
    useEffect(() => { stakeRef.current = stake; }, [stake]);
    useEffect(() => { currentStakeRef.current = currentStake; }, [currentStake]);
    useEffect(() => { consecutiveLossesRef.current = consecutiveLosses; }, [consecutiveLosses]);
    useEffect(() => { isTradingRef.current = isTrading; }, [isTrading]);
    useEffect(() => { totalProfitRef.current = totalProfit; }, [totalProfit]);
    useEffect(() => { stopLossTotalRef.current = stopLossTotal; }, [stopLossTotal]);
    useEffect(() => { stopLossTotalEnabledRef.current = stopLossTotalEnabled; }, [stopLossTotalEnabled]);
    useEffect(() => { takeProfitTotalRef.current = takeProfitTotal; }, [takeProfitTotal]);
    useEffect(() => { takeProfitEnabledRef.current = takeProfitEnabled; }, [takeProfitEnabled]);
    useEffect(() => { stopLossConsecutiveRef.current = stopLossConsecutive; }, [stopLossConsecutive]);
    useEffect(() => { stopLossConsecutiveEnabledRef.current = stopLossConsecutiveEnabled; }, [stopLossConsecutiveEnabled]);
    useEffect(() => { transactionsRef.current = transactions; }, [transactions]);


    const addJournal = useCallback((msg: string, type: JournalEntry['type'] = 'info', barrier?: number | string) => {
        setJournal(prev => [{
            id: Date.now() + Math.random(),
            message: msg,
            type,
            timestamp: Date.now(),
            is_demo: client.is_virtual,
            volatility: volatilityRef.current,
            barrier
        }, ...prev].slice(0, 100)); // Keep last 100
    }, [client.is_virtual]); // volatilityRef.current is used, so no need to depend on volatility state

    const handleTradeCompletion = useCallback((poc: any, status: Transaction['status']) => {
        const contractId = String(poc.contract_id);
        if (!activeContractIdsRef.current.has(contractId)) return;

        lastResultRef.current = status;
        activeContractIdsRef.current.delete(contractId);

        if (activeContractIdsRef.current.size === 0) {
            setIsTrading(false);
            isTradingRef.current = false;
        }

        const profitStr = poc.profit !== undefined ? Number(poc.profit).toFixed(2) : '0.00';
        const exitDigit = status === 'won' || status === 'lost' ? poc.exit_tick_display_value?.slice(-1) : null;

        console.log(`[SpeedBot] Trade completed: ${status.toUpperCase()} | Profit: ${profitStr} | Digit: ${exitDigit}`);
        addJournal(`Trade ${status.toUpperCase()}: Profit ${profitStr}${exitDigit ? `, Digit ${exitDigit}` : ''}`, status === 'won' ? 'success' : 'error');

        if (!isAutoTradingRef.current) {
            showToast(`Trade ${status.toUpperCase()}! ${exitDigit ? `Digit: ${exitDigit}` : ''} Profit: ${profitStr}`);
        }

        // Refresh balance
        if (api_base.api) {
            api_base.api.send({ balance: 1, subscribe: 1 });
        }

        // Process stats
        if (status === 'won') {
            setConsecutiveLosses(0);
            setCurrentStake(stakeRef.current);
            setLastResultDisplay('WIN');
        } else if (status === 'lost') {
            setConsecutiveLosses(prev => prev + 1);
            if (martingaleEnabledRef.current) {
                setCurrentStake(prev =>
                    Number((prev * martingaleMultiplierRef.current).toFixed(2))
                );
            }
            setLastResultDisplay('LOSS');
        }
    }, [showToast]);

    // -- Helpers --
    const getSymbol = (vol: string) => {
        const map: Record<string, string> = {
            R_10: 'R_10',
            R_25: 'R_25',
            R_50: 'R_50',
            R_75: 'R_75',
            R_100: 'R_100',
            R_10_1s: '1HZ10V',
            R_15_1s: '1HZ15V',
            R_25_1s: '1HZ25V',
            R_30_1s: '1HZ30V',
            R_50_1s: '1HZ50V',
            R_75_1s: '1HZ75V',
            R_90_1s: '1HZ90V',
            R_100_1s: '1HZ100V',
            JD10: 'JD10',
            JD25: 'JD25',
            JD50: 'JD50',
            JD75: 'JD75',
            JD100: 'JD100',
        };
        return map[vol] || 'R_10';
    };

    const getPrecision = (symbol: string, packetPipSize?: number) => {
        // 1. Highest priority: explicit pip size from the packet (Live Ticks)
        if (packetPipSize !== undefined && packetPipSize > 0) {
            if (packetPipSize < 1) return Math.round(Math.abs(Math.log10(packetPipSize)));
            return packetPipSize;
        }

        // 2. Second priority: server-provided pip sizes (from active_symbols)
        if (api_base.pip_sizes?.[symbol]) {
            const pip = api_base.pip_sizes[symbol];
            if (pip < 1) return Math.round(Math.abs(Math.log10(pip)));
            return pip;
        }

        // 3. Fallbacks for known asset classes
        if (symbol.includes('1HZ')) return 2;
        if (symbol.includes('R_100')) return 2;
        if (symbol.includes('JD')) return 3; // Jump indices typically use 3 decimals for last digit

        // Better defaults based on common Deriv indices
        if (symbol === 'R_10' || symbol === 'R_25' || symbol === 'R_50') return 3;
        if (symbol === 'R_75') return 4;

        return 2; // Safe default
    };

    const getContractType = () => {
        const type = tradeTypeRef.current;
        if (type === 'DIGITDIFF') return 'DIGITDIFF';
        if (type === 'DIGITEVEN') return 'DIGITEVEN';
        if (type === 'DIGITODD') return 'DIGITODD';
        if (type === 'DIGITOVER') return 'DIGITOVER';
        if (type === 'DIGITUNDER') return 'DIGITUNDER';
        return 'DIGITMATCH';
    };

    const calculateEntropy = (stats: number[], total: number) => {
        if (total === 0) return '0.00';
        let ent = 0;
        for (const count of stats) {
            if (count > 0) {
                const p = count / total;
                ent -= p * Math.log2(p);
            }
        }
        return ent.toFixed(2);
    };

    // -- MOVED LOGIC START --
    const checkEntryCondition = () => {
        if (!entryEnabledRef.current) return true;

        const lastDigits = digitHistoryRef.current;
        if (lastDigits.length === 0) return false;

        const latest = lastDigits[lastDigits.length - 1];

        if (entryPointRef.current === 'single') {
            return latest === entryDigitRef.current;
        }
        if (entryPointRef.current === 'double' && lastDigits.length >= 2) {
            const prev = lastDigits[lastDigits.length - 2];
            const start = digitRangeStartRef.current;
            const end = digitRangeEndRef.current;
            return (
                prev >= start &&
                prev <= end &&
                latest >= start &&
                latest <= end
            );
        }
        if (entryPointRef.current === 'last_even') {
            return latest % 2 === 0;
        }
        if (entryPointRef.current === 'last_odd') {
            return latest % 2 !== 0;
        }
        if (entryPointRef.current === 'last_five_even' && lastDigits.length >= 5) {
            return lastDigits.slice(-5).every(d => d % 2 === 0);
        }
        if (entryPointRef.current === 'even_percent') {
            const evens = ldpStats.reduce((acc, count, d) => (d % 2 === 0 ? acc + count : acc), 0);
            const total = ldpStats.reduce((acc, count) => acc + count, 0);
            return total > 0 && evens / total >= 0.6;
        }

        return false;
    };

    const executeTrade = async (req: any, tradeStake: number, contract_type: string, _prefetchedProposal?: any, batchId?: number, batchSize?: number) => {
        try {
            // Speed bot optimization: Buy by Parameters (Single round-trip)
            console.log(`[SpeedBot] Executing direct buy for ${contract_type}:`, req);
            setDebugStatus(`Purchasing...`);
            addJournal(`Purchasing ${contract_type}...`, 'info', req.barrier);
            run_panel.setContractStage(contract_stages.PURCHASE_SENT);

            const buyRequest = {
                buy: 1,
                price: tradeStake,
                subscribe: 1,
                parameters: {
                    amount: tradeStake,
                    basis: 'stake',
                    contract_type: contract_type,
                    currency: req.currency || 'USD',
                    duration: req.duration,
                    duration_unit: req.duration_unit || 't',
                    symbol: req.symbol,
                    barrier: req.barrier,
                },
                passthrough: req.passthrough
            };

            const buyRes: any = await api_base.api.send(buyRequest);

            if (buyRes.buy) {
                console.log(`[SpeedBot] Buy successful:`, buyRes.buy);
                setDebugStatus(`Success!`);
                addJournal(`Buy successful: Contract ID ${buyRes.buy.contract_id}`, 'trade', req.barrier);
                run_panel.setContractStage(contract_stages.PURCHASE_RECEIVED);

                // Update balance optimistically
                client.updateBalanceOnTrade(tradeStake);

                setTransactions(prev => {
                    const existing = prev.find(tx => String(tx.id) === String(buyRes.buy.contract_id));
                    if (existing) {
                        if (existing.batch_id) return prev;
                        return prev.map(tx => String(tx.id) === String(buyRes.buy.contract_id)
                            ? { ...tx, batch_id: batchId, batch_size: batchSize }
                            : tx
                        );
                    }

                    const newTx: Transaction = {
                        id: buyRes.buy.contract_id,
                        ref: buyRes.buy.transaction_id,
                        contract_type: contract_type,
                        stake: tradeStake,
                        payout: buyRes.buy.payout || 0, // Fallback to 0 if not present
                        profit: '0.00',
                        status: 'running',
                        timestamp: Date.now(),
                        barrier: req.barrier,
                        batch_id: batchId,
                        batch_size: batchSize
                    };
                    return [newTx, ...prev];
                });

                if (batchId) {
                    pendingBatchRef.current.set(String(buyRes.buy.contract_id), { id: batchId, size: batchSize || 1 });
                }
                activeContractIdsRef.current.add(String(buyRes.buy.contract_id));

                // Emit events
                botObserver.emit('bot.running');
                botObserver.emit('contract.status', {
                    id: 'contract.purchase_received',
                    buy: buyRes.buy
                });

                // Only show success toast for single trades to avoid spam
                if (!isAutoTrading && (!bulkEnabled || bulkTrades === 1)) {
                    showToast('Trade placed successfully!');
                }
            } else if (buyRes.error) {
                console.error(`[SpeedBot] Buy error:`, buyRes.error);
                showToast(buyRes.error.message);
                setDebugStatus(`Buy error: ${buyRes.error.code}`);
            }
        } catch (e: any) {
            console.error('[SpeedBot] Execution exception:', e);
            showToast('Trade error: ' + (e.message || e));
            setDebugStatus(`Exec exception`);
        }
    };

    const tradeOnce = async (customStake?: number, customBarrier?: number) => {
        try {
            // Sanitize arguments to prevent Event objects from being passed as stake
            // This fixes the "Converting circular structure to JSON" error if tradeOnce is called as an event handler
            const safeStake = typeof customStake === 'number' ? customStake : undefined;
            const safeBarrier = typeof customBarrier === 'number' ? customBarrier : undefined;

            if (!api_base.api) {
                showToast('API not ready');
                return;
            }

            if (isTrading) return;

            console.log('[SpeedBot] tradeOnce check:', {
                is_virtual: client.is_virtual,
                is_logged_in: client.is_logged_in,
                isAuthorized,
                api_exists: !!api_base.api
            });


            // REMOVED Virtual Account Check
            /*if (!client.is_virtual) {
                showToast('Trading is restricted to Demo Accounts only.');
                return;
            }*/

            if (!client.is_logged_in && !isAuthorized) {
                showToast('Please wait for authorization...');
                return;
            }

            if (!api_base.api) {
                showToast('API instance not found. Reconnecting...');
                api_base.init(true);
                return;
            }

            // Enforce Entry Condition for Manual Trades too
            if (entryEnabledRef.current && !checkEntryCondition()) {
                showToast('Waiting for entry condition...');
                setDebugStatus('Waiting for entry...');
                return;
            }

            const symbol = getSymbol(volatilityRef.current);
            const contract_type = getContractType();
            // Base Stake: usage depends on mode. For 'multi', we use individual stakes.
            // For others, we use customStake (if auto martanigaling) or global 'stake'.
            // UPDATE: If Martingale is enabled, 'Manual Trade' should probably use 'currentStake' 
            // to continue the sequence, unless a specific customStake was passed (e.g. from specific card).
            // If it's a "Global Trade Once", customStake is undefined.
            const defaultStake = safeStake || (martingaleEnabledRef.current ? currentStakeRef.current : stakeRef.current);

            const configs: { barrier?: number; stake: number }[] = [];

            // 1. Determine Trade Configurations
            // If customBarrier is provided, we are trading a SPECIFIC prediction (or single override)
            if (safeBarrier !== undefined) {
                configs.push({ barrier: safeBarrier, stake: defaultStake });
            }
            else if (['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'].includes(contract_type)) {
                if (predictionModeRef.current === 'multi' && predictionsRef.current.length > 0) {
                    // Multi Mode: Trade ALL predictions with their specific stakes (unless customBarrier set)
                    predictionsRef.current.forEach(p => {
                        configs.push({ barrier: p.digit, stake: p.stake });
                    });
                } else if (predictionModeRef.current === 'recovery') {
                    // Recovery Mode Logic
                    const val = consecutiveLossesRef.current > 0 ? Number(predPostRef.current) : Number(predPreRef.current);
                    const contractType = consecutiveLossesRef.current > 0 ? recoveryContractTypeRef.current : contract_type;
                    configs.push({ barrier: val, stake: defaultStake, contract_type: contractType });
                } else {
                    // Single / Default
                    configs.push({ barrier: singleDigitRef.current, stake: defaultStake });
                }
            } else {
                // Non-Digit Trades (Even/Odd etc)
                configs.push({ stake: defaultStake });
            }

            const baseReq: any = {
                proposal: 1,
                basis: 'stake',
                contract_type: contract_type,
                currency: client.currency || 'USD',
                duration: ticksRef.current,
                duration_unit: 't',
                symbol: symbol,
            };

            setIsTrading(true);
            isTradingRef.current = true;

            let count = 1;
            if (bulkEnabledRef.current) {
                count = bulkTradesRef.current;
            }

            const totalTrades = count * configs.length;
            console.log(`[SpeedBot] Preparing to execute ${totalTrades} trades. Configs:`, configs);

            if (totalTrades === 0) {
                setDebugStatus('No trades to run (Config empty)');
                setIsTrading(false);
                isTradingRef.current = false;
                return;
            }

            if (!isAutoTrading) {
                showToast(totalTrades > 1 ? `Placing ${totalTrades} trades...` : 'Placing trade...');
            }

            setDebugStatus(`Preparing ${totalTrades} trade(s)...`);

            // Execution phase: Execute all buy orders simultaneously
            setDebugStatus(`Executing ${totalTrades} trade(s)...`);
            const batchId = totalTrades > 1 ? Date.now() : undefined;
            const promises: Promise<any>[] = [];

            for (let i = 0; i < count; i++) {
                for (const cfg of configs) {
                    const specificReq = {
                        ...baseReq,
                        amount: cfg.stake,
                        // Add unique passthrough for traceability in the batch
                        passthrough: { batch_idx: i, batch_id: batchId || Date.now() }
                    };
                    if (cfg.barrier !== undefined) specificReq.barrier = cfg.barrier;
                    if (cfg.contract_type) specificReq.contract_type = cfg.contract_type;

                    promises.push(executeTrade(specificReq, cfg.stake, specificReq.contract_type, undefined, batchId, totalTrades));
                }
            }

            await Promise.all(promises);

            // Phase 3: Auto-stop if bulk trading is on
            if (bulkEnabledRef.current && isAutoTradingRef.current) {
                console.log('[SpeedBot] Bulk cycle complete. Stopping auto-trader.');
                addJournal('Bulk trading cycle complete. Auto-stop triggered.', 'info');
                setIsAutoTrading(false);
                botObserver.emit('bot.stop');
                run_panel.setIsRunning(false);
            }
        } catch (e: any) {
            console.error('[SpeedBot] tradeOnce Critical Error:', e);
            showToast('System Error: ' + (e.message || e));
            setDebugStatus('System Error');
        } finally {
            // Final check: if no active contracts left, ensure isTrading is false
            if (activeContractIdsRef.current.size === 0) {
                setIsTrading(false);
                isTradingRef.current = false;
                setDebugStatus('Ready');
            }
        }
    };

    const startAuto = useCallback(() => {
        if (isAutoTrading) {
            setIsAutoTrading(false);
            showToast('Auto Trading Stopped');
            botObserver.emit('bot.stop');
            run_panel.setIsRunning(false);
            return;
        }

        console.log('[SpeedBot] startAuto check:', {
            is_virtual: client.is_virtual,
            is_logged_in: client.is_logged_in,
            isAuthorized,
            api_exists: !!api_base.api
        });


        // REMOVED Virtual Account Check
        /*if (!client.is_virtual) {
            showToast('Auto Trading is restricted to Demo Accounts only.');
            return;
        }*/

        if (!client.is_logged_in && !isAuthorized) {
            showToast('Please wait for authorization...');
            return;
        }

        if (!api_base.api) {
            showToast('API instance not found. Reconnecting...');
            api_base.init(true);
            return;
        }

        // Reset stats
        setConsecutiveLosses(0);
        setCurrentStake(stake);
        setTotalProfit(0);
        setTotalWins(0);
        setTotalLosses(0);
        setLastResultDisplay(null);
        lastResultRef.current = null;
        activeContractIdsRef.current.clear();
        setIsTrading(false);
        hasTriggeredEntryRef.current = false;

        setIsAutoTrading(true);
        showToast('Auto Trading Started');
        botObserver.emit('bot.running');
        run_panel.setIsRunning(true);
        run_panel.setContractStage(contract_stages.STARTING);
    }, [isAutoTrading, client.is_virtual, client.is_logged_in, isAuthorized, showToast, stake, run_panel]);

    // -- MOVED LOGIC END --
    const runAutoEngine = useCallback(() => {
        if (!isAutoTradingRef.current || isTradingRef.current) return;

        // Check limits
        if (stopLossTotalEnabledRef.current && totalProfitRef.current <= stopLossTotalRef.current) {
            setIsAutoTrading(false);
            showToast('Stop Loss Reached!');
            return;
        }
        if (takeProfitEnabledRef.current && totalProfitRef.current >= takeProfitTotalRef.current) {
            setIsAutoTrading(false);
            showToast('Take Profit Reached!');
            return;
        }
        if (
            stopLossConsecutiveEnabledRef.current &&
            consecutiveLossesRef.current >= stopLossConsecutiveRef.current
        ) {
            setIsAutoTrading(false);
            showToast('Max Consecutive Losses Reached!');
            return;
        }

        // Check Entry and Execute
        const isEntryMet = checkEntryCondition();

        if (isEntryMet) {
            console.log('[SpeedBot] Entry condition met. Executing trade.');

            setDebugStatus(runModeRef.current === 'once' ? 'Running (Once)' : 'Running (Continuous)');
            tradeOnce(currentStakeRef.current);

            // If in 'once' mode, stop auto-trader after placing the trade
            if (runModeRef.current === 'once') {
                console.log('[SpeedBot] Run Once complete. Stopping auto-trader.');
                setIsAutoTrading(false);
                isAutoTradingRef.current = false;
                botObserver.emit('bot.stop');
                run_panel.setIsRunning(false);
            }
        } else {
            setDebugStatus('Waiting for entry condition...');
        }
    }, []); // Empty deps because it uses refs

    const updateLdpStats = useCallback(() => {
        if (digitHistoryRef.current.length === 0) {
            setLdpStats(Array(10).fill(0));
            setEntropy('0.00');
            return;
        }
        const counts = Array(10).fill(0);
        digitHistoryRef.current.forEach(d => counts[d]++);

        // Calculate Entropy
        const ent = calculateEntropy(counts, digitHistoryRef.current.length);
        setEntropy(ent);
    }, []);

    const updateLdpGrid = useCallback((lastDigit: number) => {
        const total = digitHistoryRef.current.length;
        if (total === 0) return;

        const counts = Array(10).fill(0);
        digitHistoryRef.current.forEach(d => counts[d]++);
        const maxVal = Math.max(...counts);

        counts.forEach((count, d) => {
            const cell = ldpCellsRef.current[d];
            if (cell) {
                // 1. Color
                const intensity = maxVal > 0 ? count / maxVal : 0;
                const hue = 120 - intensity * 100 * 1.2;
                const bgColor = `hsl(${hue}, 75%, ${35 + intensity * 0.3 * 100}%)`;
                cell.style.backgroundColor = bgColor;

                // 2. Percent & Count
                const percentVal = total > 0 ? (count / total) * 100 : 0;

                const percentEl = cell.querySelector('.percent-text');
                const countEl = cell.querySelector('.count');

                if (percentEl) {
                    percentEl.textContent = `${percentVal.toFixed(1)}%`;
                }

                if (countEl) countEl.textContent = String(count);

                // 3. Cursor
                if (d === lastDigit) cell.classList.add('cursor-active');
                else cell.classList.remove('cursor-active');
            }
        });
    }, []);

    const processTick = useCallback((quote: number, precision: number) => {
        const digitStr = quote.toFixed(precision).slice(-1);
        const digit = parseInt(digitStr, 10);
        const color = digit <= 3 ? 'red' : digit <= 6 ? 'orange' : 'green';
        return { digit, color };
    }, []);

    const updateLiveDigits = useCallback((item: { value: number; color: string }) => {
        liveDigitsBufferRef.current.push(item);
        if (liveDigitsBufferRef.current.length > 40) {
            liveDigitsBufferRef.current.shift();
        }

        if (liveDigitsRef.current) {
            const newDigitHtml = `<div class="digit ${item.color}">${item.value}</div>`;
            liveDigitsRef.current.insertAdjacentHTML('beforeend', newDigitHtml);

            // Maintain the limit of 40 in the DOM - remove from the beginning for "down to up" flow
            if (liveDigitsRef.current.children.length > 40) {
                liveDigitsRef.current.firstElementChild?.remove();
            }
        }
    }, []);

    // -- Live Data Subscription --
    useEffect(() => {
        const symbol = getSymbol(volatility);
        let messageConfig: any;
        let isMounted = true;
        let activeSubscriptionId: string | null = null;
        let retryTimeout: NodeJS.Timeout;

        const cleanup = () => {
            isMounted = false;
            // Unsubscribe from stream
            if (activeSubscriptionId && api_base.api) {
                api_base.api.send({ forget: activeSubscriptionId }).catch(() => { });
                activeSubscriptionId = null;
                subscriptionIdRef.current = null;
            }
            // Remove listener
            if (messageConfig) {
                messageConfig.unsubscribe();
                messageConfig = null;
            }
            if (retryTimeout) clearTimeout(retryTimeout);
        };

        const initData = async () => {
            // Guard: waiting for API
            if (!api_base.api || connectionStatus !== 'opened') {
                // Retry logic if needed, but connectionStatus change will re-trigger
                return;
            }

            try {
                setDebugStatus('Initializing...');

                // Wait for active symbols / pip sizes to be ready if they aren't
                if (!api_base.has_active_symbols) {
                    setDebugStatus('Waiting for Market Data...');
                    await api_base.active_symbols_promise;
                }

                // Clear state for new symbol
                setDigits([]);
                liveDigitsBufferRef.current = [];
                if (liveDigitsRef.current) liveDigitsRef.current.innerHTML = '';

                setLdpStats(Array(10).fill(0));
                setEntropy('—');
                setLastDigit('—');
                if (lastDigitRef.current) lastDigitRef.current.textContent = '—';

                digitHistoryRef.current = [];

                // Get Ticks History
                const res: any = await api_base.api.send({
                    ticks_history: symbol,
                    adjust_start_time: 1,
                    count: 1000,
                    end: 'latest',
                    style: 'ticks',
                });

                setDebugStatus('History received');

                if (isMounted && res.history && res.history.prices) {
                    const precision = getPrecision(symbol, res.pip_size || res.history.pip_size);
                    console.log(`[SpeedBot] History initialization for ${symbol}. Using precision: ${precision}`);
                    const historicalDigits: number[] = [];
                    // Populate buffer without rendering yet? Or render everything

                    res.history.prices.forEach((price: number) => {
                        const { digit } = processTick(price, precision);
                        historicalDigits.push(digit);

                        // Populate local buffer only for last 40
                        // Since for loop is old->new, we can just push to a temp array then slice
                    });


                    // We want newest first in the buffer for display
                    // The loop above gave us historical order
                    // Let's re-process last 40 safely
                    const last40 = res.history.prices.slice(-40);
                    // Actually, updateLiveDigits unshifts (adds to front), so we should feed it Oldest -> Newest? 
                    // No, unshift adds to front, so if we feed 1, then 2, buffer is [2, 1].
                    // So we want Oldest -> Newest feed to have Newest at front.

                    last40.forEach((p: number) => {
                        const { digit, color } = processTick(p, precision);
                        updateLiveDigits({ value: digit, color });
                    });

                    // Ensure strict sliding window of 1000
                    digitHistoryRef.current = historicalDigits.slice(-1000);

                    if (digitHistoryRef.current.length > 0) {
                        const lastD = digitHistoryRef.current[digitHistoryRef.current.length - 1];
                        setLastDigit(lastD); // Keep state for consistency
                        if (lastDigitRef.current) lastDigitRef.current.textContent = String(lastD);
                        updateLdpGrid(lastD);
                    }

                    updateLdpStats();
                }

                if (isMounted) {
                    setDebugStatus('Subscribing to live ticks...');
                    const subRes: any = await api_base.api.send({
                        ticks: symbol,
                        subscribe: 1,
                    });
                    if (subRes.subscription) {
                        activeSubscriptionId = subRes.subscription.id;
                        subscriptionIdRef.current = activeSubscriptionId;
                        setDebugStatus('Ready (Live)');
                        addJournal(`Subscribed to ${symbol} (Live)`, 'info');
                    } else if (subRes.error) {
                        setDebugStatus(`Sub Error: ${subRes.error.message}`);
                        addJournal(`Subscription Error: ${subRes.error.code}`, 'error');
                    } else {
                        setDebugStatus('Ready (Polling)');
                        addJournal(`Subscription failed, using polling fallback`, 'info');
                    }
                }
            } catch (err: any) {
                setDebugStatus(`Error: ${err.message || 'Unknown'}`);
                console.error('SpeedBot init error:', err);
            }
        };

        const handleTick = (response: any) => {
            if (!isMounted) return;

            // Normalize response: Deriv API v3 often wraps message in 'data'
            const msg = response.data || response;

            // Look for tick or ohlc in several common locations
            const tick = msg.tick || msg.ohlc || (msg.msg_type === 'tick' ? msg : null);

            if (!tick) return;

            const incomingSymbol = String(tick.symbol || msg.symbol || '').trim().toUpperCase();
            const targetSymbol = symbol.toUpperCase();

            // More robust matching: exact, without _INDEX, or if one contains the other
            const isMatch = incomingSymbol === targetSymbol ||
                incomingSymbol.replace('_INDEX', '') === targetSymbol.replace('_INDEX', '') ||
                (incomingSymbol.length > 3 && targetSymbol.includes(incomingSymbol)) ||
                (targetSymbol.length > 3 && incomingSymbol.includes(targetSymbol));

            if (isMatch) {
                const quote = tick.quote !== undefined ? tick.quote : (tick.close !== undefined ? tick.close : (tick.last_tick !== undefined ? tick.last_tick : undefined));
                if (quote === undefined || quote === null) return;

                setTicksCount(prev => prev + 1);
                setDebugStatus(`Live: ${quote} (${incomingSymbol})`);

                const precision = getPrecision(symbol, tick.pip_size);
                const { digit, color } = processTick(quote, precision);

                setLastTickColor(color);

                // DEBUG LOG: Movement proof
                console.log(`[SpeedBot] Tick received: ${quote} | Precision: ${precision} | Extracted Digit: ${digit} | Symbol: ${incomingSymbol}`);

                // 1. Direct DOM Update for Speed (Live Digits)
                updateLiveDigits({ value: digit, color });

                // 2. Direct DOM Update for Last Digit
                if (lastDigitRef.current) {
                    lastDigitRef.current.textContent = String(digit);
                    // Add flash animation
                    lastDigitRef.current.classList.remove('tick-flash');
                    void lastDigitRef.current.offsetWidth; // Trigger reflow
                    lastDigitRef.current.classList.add('tick-flash');
                }

                // 3. Update Ref History (Stats)
                digitHistoryRef.current.push(digit);
                if (digitHistoryRef.current.length > 1000) digitHistoryRef.current.shift();

                updateLdpStats();
                updateLdpGrid(digit); // Explicitly update grid via DOM for speed

                // 4. Auto Engine check triggered by tick for maximal responsiveness
                if (isAutoTradingRef.current) {
                    runAutoEngine();
                }
            }
        };

        // Initialize Listener
        if (api_base.api && connectionStatus === 'opened') {
            messageConfig = api_base.api.onMessage().subscribe(handleTick);
            initData();
        }

        return cleanup;
    }, [volatility, updateLdpStats, connectionStatus, processTick, updateLiveDigits]);

    // -- Transaction Monitor --
    useEffect(() => {
        if (!api_base.api) return;

        const isEnded = (poc: any) => poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold';

        const handleMessage = (response: any) => {
            if (response.proposal_open_contract) {
                const poc = response.proposal_open_contract;
                const contractId = String(poc.contract_id);
                const isActive = activeContractIdsRef.current.has(contractId);

                // DEBUG: Force log
                // addJournal(`Stream: ${contractId} ${poc.status}`, 'info');

                // Use Ref for check to avoid stale closure issues
                const isKnownContract = activeContractIdsRef.current.has(contractId) ||
                    transactionsRef.current.some(t => String(t.id) === contractId);

                if (isKnownContract) {
                    // Log significant updates
                    if (poc.status === 'won' || poc.status === 'lost') {
                        addJournal(`Result: ${contractId} ${poc.status.toUpperCase()}`, poc.status === 'won' ? 'success' : 'error');
                    }
                }

                let statusToProcess: Transaction['status'] | null = null;

                setTransactions(prev => {
                    const existingIndex = prev.findIndex(tx => String(tx.id) === contractId);

                    if (existingIndex === -1) {
                        if (isActive) {
                            console.log(`[SpeedBot] New Active Transaction found for ${contractId}`);
                            const status: Transaction['status'] = (poc.status === 'won' || Number(poc.profit) > 0) ? 'won' :
                                (poc.status === 'lost' || Number(poc.profit) < 0) ? 'lost' : 'running';

                            const batchInfo = pendingBatchRef.current.get(contractId);

                            const newTx: Transaction = {
                                id: poc.contract_id,
                                ref: poc.transaction_id || poc.id,
                                contract_type: poc.contract_type,
                                stake: poc.buy_price || 0,
                                payout: poc.payout || 0,
                                profit: poc.profit || '0.00',
                                status,
                                timestamp: Date.now(),
                                batch_id: batchInfo?.id,
                                batch_size: batchInfo?.size
                            };

                            if (poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold') {
                                statusToProcess = status;
                            }

                            return [newTx, ...prev];
                        }
                        return prev;
                    }

                    const tx = prev[existingIndex];
                    let status: Transaction['status'] = tx.status;

                    if (poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold') {
                        status = (poc.status === 'won' || Number(poc.profit) > 0) ? 'won' : 'lost';
                        if (isActive) {
                            statusToProcess = status;
                        }
                    } else if (poc.status === 'open' || !poc.is_sold) {
                        status = 'running';
                    }

                    const lastDigit = (val: string | number | undefined): number | undefined => {
                        if (val === undefined || val === null) return undefined;
                        const str = String(val);
                        if (!str.length) return undefined;
                        const d = parseInt(str.slice(-1), 10);
                        return isNaN(d) ? undefined : d;
                    };

                    const profit = poc.profit !== undefined ? Number(poc.profit).toFixed(2) :
                        (poc.bid_price && poc.buy_price ? Number(poc.bid_price - poc.buy_price).toFixed(2) : tx.profit);

                    const exit_digit = lastDigit(poc.exit_tick_display_value) ?? lastDigit(poc.exit_spot) ?? lastDigit(poc.tick_val) ?? lastDigit(poc.tick_stream ? poc.tick_stream[poc.tick_stream.length - 1]?.tick_display_value : undefined) ?? tx.exit_digit;
                    const entry_digit = lastDigit(poc.entry_tick_display_value) ?? lastDigit(poc.entry_spot) ?? lastDigit(poc.tick_stream ? poc.tick_stream[0]?.tick_display_value : undefined) ?? tx.entry_digit;

                    const batchInfo = pendingBatchRef.current.get(contractId);
                    const updatedTx = {
                        ...tx,
                        status,
                        profit,
                        exit_digit,
                        entry_digit,
                        batch_id: tx.batch_id || batchInfo?.id,
                        batch_size: tx.batch_size || batchInfo?.size
                    };
                    const next = [...prev];
                    next[existingIndex] = updatedTx;
                    return next;
                });

                if (statusToProcess) {
                    console.log(`[SpeedBot] Processing completion for ${contractId} with status ${statusToProcess}`);
                    handleTradeCompletion(poc, statusToProcess);
                }

                // Normalize for global stores (ensure both id and contract_id are present)
                const normalizedPoc = {
                    ...poc,
                    id: poc.contract_id,
                    contract_id: poc.contract_id,
                };

                // Sync with main app
                botObserver.emit('bot.contract', normalizedPoc);

                if (isEnded(poc)) {
                    run_panel.setContractStage(contract_stages.CONTRACT_CLOSED);
                }
            }
        };
        const sub = api_base.api.onMessage().subscribe(handleMessage);
        return () => sub.unsubscribe();
    }, [connectionStatus, run_panel]);

    // Listen for global Run/Stop button clicks
    useEffect(() => {
        const handleGlobalRun = () => {
            console.log('[SpeedBot] Global Run button clicked');
            // Only respond if we're on the SpeedBot tab and not already running
            if (dashboard.active_tab === DBOT_TABS.SPEED_BOT && !isAutoTrading) {
                startAuto();
            }
        };

        const handleGlobalStop = () => {
            console.log('[SpeedBot] Global Stop button clicked');
            // Only respond if we're on the SpeedBot tab and currently running
            if (dashboard.active_tab === DBOT_TABS.SPEED_BOT && isAutoTrading) {
                startAuto(); // This will stop since isAutoTrading is true
            }
        };

        botObserver.register('bot.running', handleGlobalRun);
        botObserver.register('bot.click_stop', handleGlobalStop);

        return () => {
            botObserver.unregisterAll('bot.running');
            botObserver.unregisterAll('bot.click_stop');
        };
    }, [dashboard.active_tab, isAutoTrading, startAuto]);

    // -- UI Handlers --
    const handleTradeTypeChange = (val: string) => {
        setTradeType(val);
        const isEvenOdd = val === 'DIGITEVEN' || val === 'DIGITODD';
        if (isEvenOdd) {
            setEntryEnabled(true);
            if (val === 'DIGITEVEN') {
                setPredPre('Even');
                setPredPost('Even');
            }
            if (val === 'DIGITODD') {
                setPredPre('Odd');
                setPredPost('Odd');
            }
        } else {
            if (isNaN(Number(predPre))) setPredPre(5);
            if (isNaN(Number(predPost))) setPredPost(7);
        }
    };

    const addPrediction = () => {
        setPredictions(prev => [...prev, { digit: 0, stake: 0.5, id: Date.now() }]);
    };

    const removePrediction = (id: number) => {
        setPredictions(prev => prev.filter(p => p.id !== id));
    };

    const updatePrediction = (id: number, field: 'digit' | 'stake', value: number) => {
        setPredictions(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
    };




    const handleDigitClick = (d: number) => {
        showToast(`Digit ${d} selected!`);

        if (predictionMode === 'single') {
            setSingleDigit(d);
        } else if (predictionMode === 'recovery') {
            if (!isNaN(Number(predPre))) setPredPre(d);
            else setPredPost(d);
        } else if (predictionMode === 'multi') {
            setPredictions(prev => [...prev, { digit: d, stake: 0.5, id: Date.now() }]);
        }
    };







    // -- Result Processing (Manual & Auto) --
    // Handled in Transaction Monitor via handleMessage for speed and reliability.

    // -- Polling Cleanup / Backstop --
    // In case subscriptions fail, we poll active contracts every 2 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            const activeIds = Array.from(activeContractIdsRef.current);
            if (activeIds.length === 0) return;

            activeIds.forEach(id => {
                // Explicitly fetch status without subscribe to check
                api_base.api.send({ proposal_open_contract: 1, contract_id: Number(id) })
                    .then((res: any) => {
                        if (res.proposal_open_contract) {
                            const poc = res.proposal_open_contract;
                            if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
                                console.log('[SpeedBot] Poller found finished contract:', id);
                                // The handleMessage observer *should* pick this up because we are broadcasting to it?
                                // No, handleMessage is subscribed to api.onMessage. 
                                // api.send response is handled here in .then.
                                // So we need to manually trigger the update logic or reuse it.
                                // Ideally, we just emit it to the stream manually or call a shared handler.
                                // Let's just create a synthetic event for handleMessage consumers if possible, 
                                // OR just update local state directly.

                                // Calling the shared logic:
                                // We can't easily call handleMessage inside here because it's defined inside another useEffect.
                                // But! api_base.api.onMessage() is a stream. We can just emit? No, strictly it's an observable from API.

                                // Simplest way: Reuse the state update logic by refactoring it or duplicating strictly necessary parts.
                                // Let's duplicate the critical status update part for the poller to ensure it works.

                                let statusToProcess: Transaction['status'] | null = null;
                                setTransactions(prev => {
                                    const idx = prev.findIndex(tx => String(tx.id) === String(id));
                                    if (idx === -1) return prev;

                                    const tx = prev[idx];
                                    // If already finished, remove from active
                                    if (tx.status === 'won' || tx.status === 'lost') {
                                        if (activeContractIdsRef.current.has(String(id))) {
                                            activeContractIdsRef.current.delete(String(id));
                                        }
                                        return prev;
                                    }

                                    const status: Transaction['status'] = (poc.status === 'won' || Number(poc.profit) > 0) ? 'won' : 'lost';
                                    statusToProcess = status;

                                    const profit = poc.profit !== undefined ? Number(poc.profit).toFixed(2) : tx.profit;
                                    const exit_digit = (poc.exit_tick_display_value) ? parseInt(poc.exit_tick_display_value.slice(-1), 10) : tx.exit_digit;

                                    const next = [...prev];
                                    next[idx] = { ...tx, status, profit, exit_digit };
                                    return next;
                                });

                                if (statusToProcess) {
                                    handleTradeCompletion(poc, statusToProcess);
                                }
                            }
                        }
                    })
                    .catch(e => console.error('[SpeedBot] Poller Error:', e));
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [handleTradeCompletion]);

    // -- Auto Engine Hook --
    useEffect(() => {
        if (isAutoTrading && !isTrading) {
            runAutoEngine();
        }
    }, [isAutoTrading, isTrading, runAutoEngine]);

    // Update total profit and counts whenever transactions change
    useEffect(() => {
        let wins = 0;
        let losses = 0;
        const total = transactions.reduce((acc, tx) => {
            if (tx.status === 'won') {
                wins++;
                return acc + (tx.payout - tx.stake);
            }
            if (tx.status === 'lost') {
                losses++;
                return acc - tx.stake;
            }
            return acc;
        }, 0);
        setTotalProfit(total);
        setTotalWins(wins);
        setTotalLosses(losses);
    }, [transactions]);

    const isEvenOdd = tradeType === 'DIGITEVEN' || tradeType === 'DIGITODD';

    const totalDigits = digitHistoryRef.current.length;

    return (
        <div className='speed-bot-page'>
            <div className='container'>
                <div className='grid'>
                    {/* -- Config Section -- */}
                    <section className='card'>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Bot configuration</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: connectionStatus === 'opened' ? '#4caf50' : '#f44336',
                                        boxShadow: connectionStatus === 'opened' ? '0 0 8px #4caf50' : 'none',
                                        transition: 'all 0.3s ease',
                                    }}
                                ></div>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        color: '#888',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}
                                >
                                    {connectionStatus === 'opened' ? 'Live' : 'Offline'}
                                </span>
                            </div>
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Status: {debugStatus}</span>
                            <span>Ticks: {ticksCount}</span>
                        </div>
                        <form onSubmit={e => e.preventDefault()}>
                            <label>
                                Volatility:
                                <select value={volatility} onChange={e => setVolatility(e.target.value)}>
                                    <optgroup label='Plain Volatility'>
                                        <option value='R_10'>Volatility 10</option>
                                        <option value='R_25'>Volatility 25</option>
                                        <option value='R_50'>Volatility 50</option>
                                        <option value='R_75'>Volatility 75</option>
                                        <option value='R_100'>Volatility 100</option>
                                    </optgroup>
                                    <optgroup label='Volatility (1s)'>
                                        <option value='R_10_1s'>Volatility 10 (1s)</option>
                                        <option value='R_15_1s'>Volatility 15 (1s)</option>
                                        <option value='R_25_1s'>Volatility 25 (1s)</option>
                                        <option value='R_30_1s'>Volatility 30 (1s)</option>
                                        <option value='R_50_1s'>Volatility 50 (1s)</option>
                                        <option value='R_75_1s'>Volatility 75 (1s)</option>
                                        <option value='R_90_1s'>Volatility 90 (1s)</option>
                                        <option value='R_100_1s'>Volatility 100 (1s)</option>
                                    </optgroup>
                                    <optgroup label='Jump Indices'>
                                        <option value='JD10'>Jump 10 Index</option>
                                        <option value='JD25'>Jump 25 Index</option>
                                        <option value='JD50'>Jump 50 Index</option>
                                        <option value='JD75'>Jump 75 Index</option>
                                        <option value='JD100'>Jump 100 Index</option>
                                    </optgroup>
                                </select>
                            </label>

                            <label>
                                Trade type:
                                <select value={tradeType} onChange={e => handleTradeTypeChange(e.target.value)}>
                                    <option value='DIGITMATCH'>Digit Matches</option>
                                    <option value='DIGITDIFF'>Digit Differs</option>
                                    <option value='DIGITEVEN'>Digit Even</option>
                                    <option value='DIGITODD'>Digit Odd</option>
                                    <option value='DIGITOVER'>Digit Over</option>
                                    <option value='DIGITUNDER'>Digit Under</option>
                                </select>
                                {tradeType !== 'DIGITMATCH' && (
                                    <span className='badge'>{tradeType.replace('DIGIT', '')}</span>
                                )}
                            </label>

                            <div className='row'>
                                <label>
                                    Ticks:
                                    <input
                                        type='number'
                                        value={ticks}
                                        min='1'
                                        onChange={e => setTicks(Number(e.target.value))}
                                    />
                                </label>
                                <label>
                                    Base Stake:
                                    <input
                                        type='number'
                                        step='0.01'
                                        value={stake}
                                        min='0.01'
                                        onChange={e => setStake(Number(e.target.value))}
                                    />
                                </label>
                            </div>

                            {/* Bulk */}
                            <div className='toggle' onClick={() => setBulkEnabled(!bulkEnabled)}>
                                <input type='checkbox' checked={bulkEnabled} readOnly />
                                <label>Bulk trading</label>
                                {bulkEnabled && <span className='badge'>Bulk ON</span>}
                            </div>
                            <label>
                                Bulk count:
                                <input
                                    type='number'
                                    value={bulkTrades}
                                    min='1'
                                    disabled={!bulkEnabled}
                                    onChange={e => setBulkTrades(Number(e.target.value))}
                                />
                            </label>

                            {/* Entry */}
                            <div className='toggle' onClick={() => setEntryEnabled(!entryEnabled)}>
                                <input type='checkbox' checked={entryEnabled} readOnly />
                                <label>Entry condition</label>
                                {entryEnabled && <span className='badge'>Entry ON</span>}
                            </div>
                            <label>
                                Entry condition:
                                <select
                                    value={entryPoint}
                                    disabled={!entryEnabled}
                                    onChange={e => setEntryPoint(e.target.value)}
                                >
                                    {!isEvenOdd ? (
                                        <>
                                            <option value='single'>Single digit</option>
                                            <option value='double'>Two consecutive digits</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value='last_even'>Last digit is even</option>
                                            <option value='last_odd'>Last digit is odd</option>
                                            <option value='last_five_even'>Last 5 digits all even</option>
                                            <option value='even_percent'>Even % &gt;= 60% (last 1000 ticks)</option>
                                        </>
                                    )}
                                </select>
                            </label>

                            {entryEnabled && entryPoint === 'single' && (
                                <label>
                                    Entry digit (0–9):
                                    <input
                                        type='number'
                                        min='0'
                                        max='9'
                                        value={entryDigit}
                                        onChange={e => setEntryDigit(Number(e.target.value))}
                                    />
                                </label>
                            )}

                            {entryEnabled && entryPoint === 'double' && (
                                <div className='row'>
                                    <label>
                                        Digit range start (0–9):
                                        <input
                                            type='number'
                                            min='0'
                                            max='9'
                                            value={digitRangeStart}
                                            onChange={e => setDigitRangeStart(Number(e.target.value))}
                                        />
                                    </label>
                                    <label>
                                        Digit range end (0–9):
                                        <input
                                            type='number'
                                            min='0'
                                            max='9'
                                            value={digitRangeEnd}
                                            onChange={e => setDigitRangeEnd(Number(e.target.value))}
                                        />
                                    </label>
                                </div>
                            )}

                            {/* Prediction Section - Hidden for Even/Odd */}
                            {!isEvenOdd && (
                                <>
                                    <div className='section-title'>Prediction section</div>
                                    <label>
                                        Prediction mode:
                                        <select
                                            value={predictionMode}
                                            onChange={e => setPredictionMode(e.target.value)}
                                        >
                                            <option value='single'>Single prediction</option>
                                            <option value='recovery'>Prediction with recovery</option>
                                            <option value='multi'>Multiple predictions</option>
                                        </select>
                                    </label>

                                    {predictionMode === 'single' && (
                                        <div className='row'>
                                            <label>
                                                Digit (0–9):
                                                <input
                                                    type='number'
                                                    min='0'
                                                    max='9'
                                                    value={singleDigit}
                                                    onChange={e => setSingleDigit(Number(e.target.value))}
                                                />
                                            </label>
                                            <label>
                                                Stake:
                                                <input
                                                    type='number'
                                                    step='0.01'
                                                    min='0'
                                                    value={singleStake}
                                                    onChange={e => setSingleStake(Number(e.target.value))}
                                                />
                                            </label>
                                        </div>
                                    )}
                                    {predictionMode === 'recovery' && (
                                        <>
                                            <div className='row'>
                                                <label>
                                                    Before loss:
                                                    <input
                                                        type='text'
                                                        value={predPre}
                                                        onChange={e => setPredPre(e.target.value)}
                                                    />
                                                </label>
                                                <label>
                                                    After loss:
                                                    <input
                                                        type='text'
                                                        value={predPost}
                                                        onChange={e => setPredPost(e.target.value)}
                                                    />
                                                </label>
                                            </div>
                                            <div className='row' style={{ marginTop: '10px' }}>
                                                <label>
                                                    Recovery type:
                                                    <select
                                                        value={recoveryContractType}
                                                        onChange={e => setRecoveryContractType(e.target.value)}
                                                    >
                                                        <option value='DIGITMATCH'>Digit Match</option>
                                                        <option value='DIGITDIFF'>Digit Diff</option>
                                                        <option value='DIGITEVEN'>Digit Even</option>
                                                        <option value='DIGITODD'>Digit Odd</option>
                                                        <option value='DIGITOVER'>Digit Over</option>
                                                        <option value='DIGITUNDER'>Digit Under</option>
                                                    </select>
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    {predictionMode === 'multi' && (
                                        <div>
                                            <div className='pred-grid'>
                                                {predictions.map((pred, i) => (
                                                    <div key={pred.id} className='pred-card'>
                                                        <label>
                                                            Digit #{i + 1} (0–9):
                                                            <input
                                                                type='number'
                                                                min='0'
                                                                max='9'
                                                                value={pred.digit}
                                                                onChange={e =>
                                                                    updatePrediction(
                                                                        pred.id,
                                                                        'digit',
                                                                        Number(e.target.value)
                                                                    )
                                                                }
                                                            />
                                                        </label>
                                                        <label>
                                                            Stake #{i + 1}:
                                                            <input
                                                                type='number'
                                                                step='0.01'
                                                                min='0'
                                                                value={pred.stake}
                                                                onChange={e =>
                                                                    updatePrediction(
                                                                        pred.id,
                                                                        'stake',
                                                                        Number(e.target.value)
                                                                    )
                                                                }
                                                            />
                                                        </label>
                                                        <button
                                                            type='button'
                                                            className='btn remove-pred-btn'
                                                            onClick={() => removePrediction(pred.id)}
                                                        >
                                                            ×
                                                        </button>
                                                        <button
                                                            type='button'
                                                            className='btn'
                                                            style={{
                                                                position: 'absolute',
                                                                bottom: '8px',
                                                                right: '8px',
                                                                background: '#2ea3f2',
                                                                color: '#fff',
                                                                padding: '4px 8px',
                                                                fontSize: '12px',
                                                                borderRadius: '4px'
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                tradeOnce(pred.stake, pred.digit);
                                                            }}
                                                        >
                                                            ▶
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '12px' }}>
                                                <button type='button' className='btn primary' onClick={addPrediction}>
                                                    + Add Prediction
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Martingale */}
                            <div className='section-title' style={{ color: '#fbbf24' }}>
                                Martingale Strategy
                            </div>
                            <div className='toggle' onClick={() => setMartingaleEnabled(!martingaleEnabled)}>
                                <input type='checkbox' checked={martingaleEnabled} readOnly />
                                <label>Use Martingale</label>
                            </div>
                            <label>
                                Martingale multiplier:
                                <input
                                    type='number'
                                    step='0.1'
                                    value={martingaleMultiplier}
                                    min='0.5'
                                    disabled={!martingaleEnabled}
                                    onChange={e => setMartingaleMultiplier(Number(e.target.value))}
                                />
                            </label>

                            {/* Stop Loss */}
                            <div className='section-title sl-title'>Stop Loss</div>
                            <div className='toggle' onClick={() => setStopLossTotalEnabled(!stopLossTotalEnabled)}>
                                <input type='checkbox' checked={stopLossTotalEnabled} readOnly />
                                <label>Max Total Loss</label>
                            </div>
                            <input
                                type='number'
                                step='0.01'
                                value={stopLossTotal}
                                disabled={!stopLossTotalEnabled}
                                onChange={e => setStopLossTotal(Number(e.target.value))}
                            />

                            <div
                                className='toggle'
                                style={{ marginTop: '1.2rem' }}
                                onClick={() => setStopLossConsecutiveEnabled(!stopLossConsecutiveEnabled)}
                            >
                                <input type='checkbox' checked={stopLossConsecutiveEnabled} readOnly />
                                <label>Max Consecutive Losses</label>
                            </div>
                            <input
                                type='number'
                                min='1'
                                value={stopLossConsecutive}
                                disabled={!stopLossConsecutiveEnabled}
                                onChange={e => setStopLossConsecutive(Number(e.target.value))}
                            />

                            {/* Take Profit */}
                            <div className='section-title tp-title'>Take Profit</div>
                            <div className='toggle' onClick={() => setTakeProfitEnabled(!takeProfitEnabled)}>
                                <input type='checkbox' checked={takeProfitEnabled} readOnly />
                                <label>Enable Take Profit</label>
                            </div>
                            <input
                                type='number'
                                step='0.01'
                                value={takeProfitTotal}
                                disabled={!takeProfitEnabled}
                                onChange={e => setTakeProfitTotal(Number(e.target.value))}
                            />
                        </form>
                    </section>

                    {/* -- Live Data Section -- */}
                    <section className='card' style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                        {/* Always visible Live Digits */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0 }}>Live digits</h3>
                            <div className='status-dot-pulse'></div>
                        </div>
                        <div className='live-digits-wrapper'>
                            <div className='digits' ref={liveDigitsRef}></div>
                        </div>

                        {/* Always visible Last Digit Stats */}
                        <div className='section-title'>Last Digit Stats (last {totalDigits} ticks)</div>
                        <div className='ldp-grid'>
                            {Array.from({ length: 10 }).map((_, d) => (
                                <div
                                    key={d}
                                    ref={el => (ldpCellsRef.current[d] = el)}
                                    className='ldp-cell'
                                    onClick={() => handleDigitClick(d)}
                                >
                                    <div className='digit-num'>{d}</div>
                                    <div className='percent-text'>0.0%</div>
                                    <div className='count'>0</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '13px', color: '#9fb3c8', marginTop: '8px' }}>
                            Hot <span style={{ color: '#ff6b6b' }}>■■■■■■■■■■</span> → Cold{' '}
                            <span style={{ color: '#34d399' }}>■■</span>
                        </div>

                        <div className='metrics'>
                            <div className='metric'>
                                <div className='label'>Balance</div>
                                <div className='value' style={{ color: '#2ea3f2' }}>
                                    {client.balance} {client.currency}
                                </div>
                            </div>
                            <div className='metric'>
                                <div className='label'>Entropy</div>
                                <div className='value'>{entropy}</div>
                            </div>
                            <div className='metric'>
                                <div className='label'>Last digit</div>
                                <div className='value' ref={lastDigitRef}>{lastDigit}</div>
                            </div>
                        </div>

                        {/* Header: Run Button & Status */}
                        <div className='activity-panel'>
                            <div className='run-btn-group' ref={runMenuRef}>
                                <button
                                    className={clsx('run-btn', 'main', isAutoTrading ? 'running' : '')}
                                    onClick={() => {
                                        if (isAutoTrading) {
                                            startAuto(); // Stop
                                        } else {
                                            // Always use startAuto to allow waiting for entry condition
                                            startAuto();
                                        }
                                    }}
                                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                >
                                    <div className='icon'>
                                        {isAutoTrading ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                <rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
                                            </svg>
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                <path d="M8 5V19L19 12L8 5Z" fill="white" />
                                            </svg>
                                        )}
                                    </div>
                                    <span>
                                        {isAutoTrading ? 'Stop' : runMode === 'once' ? 'Run Once' : 'Run Auto'}
                                    </span>
                                </button>
                                <button
                                    className={clsx('run-btn', 'arrow', isAutoTrading ? 'running' : '')}
                                    onClick={() => setShowRunMenu(!showRunMenu)}
                                    style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '0 8px', width: 'auto', borderLeft: '1px solid rgba(255,255,255,0.2)' }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: showRunMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                        <path d="M7 10L12 15L17 10H7Z" fill="white" />
                                    </svg>
                                </button>

                                {showRunMenu && (
                                    <div className='run-mode-menu'>
                                        <div
                                            className={clsx('mode-item', runMode === 'continuous' && 'active')}
                                            onClick={() => {
                                                setRunMode('continuous');
                                                setShowRunMenu(false);
                                            }}
                                        >
                                            <div className='mode-icon'>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                                </svg>
                                            </div>
                                            <div className='mode-info'>
                                                <div className='mode-title'>Run Continuously</div>
                                                <div className='mode-desc'>Repeatedly trade</div>
                                            </div>
                                            {runMode === 'continuous' && <div className='check'>✓</div>}
                                        </div>
                                        <div
                                            className={clsx('mode-item', runMode === 'once' && 'active')}
                                            onClick={() => {
                                                setRunMode('once');
                                                setShowRunMenu(false);
                                            }}
                                        >
                                            <div className='mode-icon'>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <div className='mode-info'>
                                                <div className='mode-title'>Run Once</div>
                                                <div className='mode-desc'>Single trade execution</div>
                                            </div>
                                            {runMode === 'once' && <div className='check'>✓</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className='status-bar'>
                                <div className='status-text'>
                                    {isTrading
                                        ? 'Contract running...'
                                        : !isAutoTrading
                                            ? 'Ready / Stopped'
                                            : lastResultDisplay === 'WIN'
                                                ? 'Contract won'
                                                : lastResultDisplay === 'LOSS'
                                                    ? 'Contract lost'
                                                    : 'Waiting for entry...'}
                                </div>
                                <div className='progress-track'>
                                    <div
                                        className={clsx('progress-fill', isTrading && 'animating', lastResultDisplay === 'WIN' ? 'win' : lastResultDisplay === 'LOSS' ? 'loss' : '')}
                                        style={{ width: isTrading ? '100%' : '0%' }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className='sb-tabs'>
                            <div
                                className={clsx('sb-tab', activeTab === 'summary' && 'active')}
                                onClick={() => setActiveTab('summary')}
                            >
                                Summary
                            </div>
                            <div
                                className={clsx('sb-tab', activeTab === 'transactions' && 'active')}
                                onClick={() => setActiveTab('transactions')}
                            >
                                Transactions
                            </div>
                            <div
                                className={clsx('sb-tab', activeTab === 'journal' && 'active')}
                                onClick={() => setActiveTab('journal')}
                            >
                                Journal
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className='sb-content'>
                            {activeTab === 'summary' && (
                                <div className='summary-view fade-in'>
                                    {/* Summary view is now simpler, maybe just show the big stats or nothing? 
                                        Leaving empty for now or could just show the footer stats here too. 
                                        Actually, let's just make it show the "Bot Status" block which is currently removed? 
                                        Wait, the bot status block was in the previous code but I replaced it. 
                                        Let's re-add the bot status block here. 
                                    */}
                                    <div className='bot-status' style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className='metric' style={{ background: '#1e293b', gridColumn: 'span 2' }}>
                                            <div className='label'>Account Balance</div>
                                            <div className='value' style={{ color: '#2ea3f2' }}>
                                                {client.balance} {client.currency}
                                            </div>
                                        </div>
                                        <div className='metric' style={{ background: '#1e293b' }}>
                                            <div className='label'>Last Result</div>
                                            <div className='value' style={{
                                                color: lastResultDisplay === 'WIN' ? '#00d085' : lastResultDisplay === 'LOSS' ? '#ff444f' : '#fff'
                                            }}>
                                                {lastResultDisplay || '—'}
                                            </div>
                                        </div>
                                        <div className='metric' style={{ background: '#1e293b' }}>
                                            <div className='label'>Total Profit</div>
                                            <div className='value' style={{ color: totalProfit >= 0 ? '#00d085' : '#ff444f' }}>
                                                {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
                                            </div>
                                        </div>
                                        <div className='metric' style={{ background: '#1e293b' }}>
                                            <div className='label'>Wins</div>
                                            <div className='value' style={{ color: '#00d085' }}>{totalWins}</div>
                                        </div>
                                        <div className='metric' style={{ background: '#1e293b' }}>
                                            <div className='label'>Losses</div>
                                            <div className='value' style={{ color: '#ff444f' }}>{totalLosses}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'transactions' && (
                                <div className='transactions-view fade-in'>
                                    <div className='actions-bar'>
                                        <button className='action-btn' disabled>Download</button>
                                        <button className='action-btn' disabled>View Detail</button>
                                    </div>

                                    <div className='tx-table-header'>
                                        <div>Type</div>
                                        <div>Entry/Exit spot</div>
                                        <div>Buy price and P/L</div>
                                    </div>

                                    <div className='tx-list'>
                                        {(() => {
                                            // Group transactions and create display items
                                            const allDisplayItems: (Transaction | { isBulk: boolean, batchId: number, contracts: Transaction[], stats: any })[] = [];
                                            const processedBatches = new Set();

                                            transactions.forEach(tx => {
                                                allDisplayItems.push(tx);
                                            });

                                            return allDisplayItems.map((item, idx) => {
                                                const tx = item as Transaction;
                                                const isBulkPart = !!tx.batch_id;
                                                return (
                                                    <div key={tx.id} className={clsx('tx-row', isBulkPart && 'bulk-part')}>
                                                        <div className='col-type'>
                                                            <div className={clsx('dot-indicator', tx.status)}></div>
                                                            {isBulkPart && <span className='bulk-indicator'>B</span>}
                                                            {tx.contract_type.replace('DIGIT', '')}
                                                        </div>
                                                        <div className='col-spots'>
                                                            <div className='spot-row'>
                                                                <span className='dot entry'></span>
                                                                {tx.entry_digit !== undefined ? tx.entry_digit : '—'}
                                                            </div>
                                                            <div className='spot-row'>
                                                                <span className={clsx('dot exit', tx.status)}></span>
                                                                {tx.exit_digit !== undefined ? tx.exit_digit : '—'}
                                                            </div>
                                                        </div>
                                                        <div className='col-pl'>
                                                            <div className='stake'>{tx.stake.toFixed(2)} USD</div>
                                                            <div className={clsx('profit', tx.status)}>
                                                                {tx.status === 'won' ? `+${tx.profit}` : tx.status === 'lost' ? `-${tx.stake.toFixed(2)}` : '0.00'} USD
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                        {transactions.length === 0 && (
                                            <div className='empty-state'>No transactions yet</div>
                                        )}
                                    </div>

                                    <div className='tx-footer'>
                                        <div className='stat-row'>
                                            <div className='stat-item'>
                                                <div className='label'>Total stake</div>
                                                <div className='val'>{transactions.reduce((acc, t) => acc + t.stake, 0).toFixed(2)} USD</div>
                                            </div>
                                            <div className='stat-item'>
                                                <div className='label'>Total payout</div>
                                                <div className='val'>{transactions.reduce((acc, t) => acc + (t.status === 'won' ? t.payout : 0), 0).toFixed(2)} USD</div>
                                            </div>
                                            <div className='stat-item'>
                                                <div className='label'>No. of runs</div>
                                                <div className='val'>{transactions.length}</div>
                                            </div>
                                        </div>
                                        <div className='stat-row'>
                                            <div className='stat-item'>
                                                <div className='label'>Contracts lost</div>
                                                <div className='val'>{transactions.filter(t => t.status === 'lost').length}</div>
                                            </div>
                                            <div className='stat-item'>
                                                <div className='label'>Contracts won</div>
                                                <div className='val'>{transactions.filter(t => t.status === 'won').length}</div>
                                            </div>
                                            <div className='stat-item'>
                                                <div className='label'>Total profit/loss</div>
                                                <div className={clsx('val', totalProfit >= 0 ? 'win' : 'loss')}>
                                                    {totalProfit.toFixed(2)} USD
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className='reset-btn'
                                            onClick={() => {
                                                setTransactions([]);
                                                setTotalProfit(0);
                                                setTotalWins(0);
                                                setTotalLosses(0);
                                                setJournal([]);
                                                activeContractIdsRef.current.clear();
                                                pendingBatchRef.current.clear();
                                                hasTriggeredEntryRef.current = false;
                                            }}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'journal' && (
                                <div className='journal-view fade-in'>
                                    {journal.length === 0 ? (
                                        <div className='empty-state'>Waiting for activity...</div>
                                    ) : (
                                        journal.map(entry => (
                                            <div key={entry.id} className={clsx('journal-entry', entry.type)}>
                                                <div className='entry-meta'>
                                                    <span className='time'>
                                                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}
                                                    </span>
                                                    <span className={clsx('account-badge', entry.is_demo ? 'demo' : 'real')}>
                                                        {entry.is_demo ? 'DEMO' : 'REAL'}
                                                    </span>
                                                    {entry.volatility && (
                                                        <span className='vol-badge'>{entry.volatility.replace('R_', 'V')}</span>
                                                    )}
                                                    {entry.barrier !== undefined && (
                                                        <span className='barrier-badge' style={{ background: '#3b82f6', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>B: {entry.barrier}</span>
                                                    )}
                                                </div>
                                                <span className='msg'>{entry.message}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
            {toastMessage && <div className='alert-toast'>{toastMessage}</div>}
        </div>
    );
});

export default SpeedBot;
