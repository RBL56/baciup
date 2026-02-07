import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { reaction } from 'mobx';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import './dcircle.scss';

const VOLATILITY_OPTIONS = [
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ15V', label: 'Volatility 15 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ30V', label: 'Volatility 30 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ90V', label: 'Volatility 90 (1s) Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
    { value: 'JD10', label: 'Jump 10 Index' },
    { value: 'JD25', label: 'Jump 25 Index' },
    { value: 'JD50', label: 'Jump 50 Index' },
    { value: 'JD75', label: 'Jump 75 Index' },
    { value: 'JD100', label: 'Jump 100 Index' },
];

const TICK_OPTIONS = [
    { value: 10, label: '10 ticks' },
    { value: 50, label: '50 ticks' },
    { value: 100, label: '100 ticks' },
    { value: 500, label: '500 ticks' },
    { value: 1000, label: '1000 ticks' },
    { value: 2000, label: '2000 ticks' },
    { value: 3000, label: '3000 ticks' },
    { value: 4000, label: '4000 ticks' },
    { value: 5000, label: '5000 ticks' },
];

const Dcircle = observer(() => {
    const { dcircle } = useStore();
    const { connectionStatus } = useApiBase();
    const {
        volatility,
        ticksCount,
        threshold,
        currentPrice,
        priceChange,
        isLoading,
        digitStats,
        overUnder,
        oddEven,
        currentDigit,
        recentTicks,
        setVolatility,
        setTicksCount,
        setThreshold,
        initialise,
        isInitialized,
    } = dcircle;

    // Show loading cursor immediately when component mounts
    useEffect(() => {
        dcircle.isLoading = true;
        // Brief timeout to ensure loading state is visible
        const timer = setTimeout(() => {
            if (isInitialized) {
                dcircle.isLoading = false;
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []); // Only run on mount

    useEffect(() => {
        if (!isInitialized && connectionStatus === 'opened') {
            initialise();
        }
    }, [connectionStatus, initialise, isInitialized]);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const circleRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const cursorRef = React.useRef<HTMLDivElement>(null);

    const digitCounts = dcircle.digitCounts || Array(10).fill(0);
    const maxCount = Math.max(...digitCounts);
    const minCount = Math.min(...digitCounts.filter(c => (c ?? 0) > 0)); // Exclude zeros
    const hasVariation = maxCount > minCount && minCount > 0;

    const getDigitClasses = (d: number) => {
        const classes = ['circle'];
        if (threshold === d) classes.push('active');
        if (currentDigit === d) classes.push('current');
        if (hasVariation) {
            if (digitCounts[d] === maxCount) classes.push('most-frequent');
            if (digitCounts[d] === minCount && digitCounts[d] > 0) classes.push('least-frequent');
        }
        return classes.join(' ');
    };

    useEffect(() => {
        if (currentDigit !== null && circleRefs.current[currentDigit] && containerRef.current && cursorRef.current) {
            const circle = circleRefs.current[currentDigit];
            const container = containerRef.current;
            const cursor = cursorRef.current;

            const updatePosition = () => {
                if (!circle || !container || !cursor) return;
                const circleRect = circle.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                const x = circleRect.left - containerRect.left + circleRect.width / 2;
                const y = circleRect.top - containerRect.top + circleRect.height / 2;

                cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
                cursor.style.opacity = '1';
            };

            requestAnimationFrame(updatePosition);
        } else if (cursorRef.current) {
            cursorRef.current.style.opacity = '0';
        }
    }, [currentDigit]); // Only depend on currentDigit for smoother transitions

    const tickFeedRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Direct DOM update for high frequency ticks without blinking
        let lastTickId = '';
        let lastThreshold = dcircle.threshold;

        const disposer = reaction(
            () => ({
                ticks: [...dcircle.recentTicks],
                threshold: dcircle.threshold,
                currentDigit: dcircle.currentDigit
            }),
            ({ ticks, threshold, currentDigit }) => {
                if (!tickFeedRef.current) return;

                const newTick = ticks[0];
                const newTickId = newTick ? `${newTick.timestamp}-${newTick.price}` : '';
                const isNewTick = newTickId !== lastTickId;
                const isFirstLoad = lastTickId === '';
                const thresholdChanged = threshold !== lastThreshold;

                if (ticks.length === 0) {
                    tickFeedRef.current.innerHTML = `<div class='tick-feed-empty'>${localize('Waiting for ticks...')}</div>`;
                    lastTickId = '';
                    lastThreshold = threshold;
                    return;
                }

                // Full render if first load or threshold changed
                if (isFirstLoad || thresholdChanged) {
                    const html = ticks.map(tick => {
                        let colorClass = 'neutral';
                        if (tick.digit < threshold) colorClass = 'green';
                        else if (tick.digit === threshold) colorClass = 'neutral';
                        else colorClass = 'red';
                        // Add no-animation class for historical items to avoid massive blinking on load
                        return `<div class="digit-box ${colorClass} no-animation">${tick.digit}</div>`;
                    }).join('');
                    tickFeedRef.current.innerHTML = html;
                    lastTickId = newTickId;
                    lastThreshold = threshold;
                } else if (isNewTick) {
                    // Optimized: Only prepend the newest digit
                    let colorClass = 'neutral';
                    if (newTick.digit < threshold) colorClass = 'green';
                    else if (newTick.digit === threshold) colorClass = 'neutral';
                    else colorClass = 'red';

                    const newDigitHtml = `<div class="digit-box ${colorClass}">${newTick.digit}</div>`;
                    tickFeedRef.current.insertAdjacentHTML('afterbegin', newDigitHtml);

                    // Maintain visual limit (50)
                    while (tickFeedRef.current.children.length > 50) {
                        tickFeedRef.current.lastElementChild?.remove();
                    }
                    lastTickId = newTickId;
                }

                // Trigger hit animation on circle
                if (currentDigit !== null && circleRefs.current[currentDigit]) {
                    const el = circleRefs.current[currentDigit];
                    el?.classList.add('hit');
                    setTimeout(() => {
                        el?.classList.remove('hit');
                    }, 300);
                }
            },
            { fireImmediately: true }
        );
        return () => disposer();
    }, [dcircle]);

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    return (
        <div className='dcircle'>
            <div className='header'>
                <div className='index-display'>
                    <div className='index-name'>{VOLATILITY_OPTIONS.find(o => o.value === volatility)?.label}</div>
                    <div className='index-value'>{currentPrice}</div>
                    <div className={`change ${priceChange.isUp ? 'up' : 'down'}`}>
                        {priceChange.value} ({priceChange.percent}%) {priceChange.isUp ? '↑' : '↓'}
                    </div>
                </div>

                <div className='selector-group'>
                    <div className='select-container'>
                        <label>{localize('Switch Index:')}</label>
                        <select value={volatility} onChange={e => setVolatility(e.target.value)}>
                            {VOLATILITY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='select-container'>
                        <label>{localize('Number of Ticks:')}</label>
                        <select value={ticksCount} onChange={e => setTicksCount(parseInt(e.target.value))}>
                            {TICK_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className='ticks-display'>
                <Localize
                    i18n_default_text='Last {{count}} ticks against distribution'
                    values={{ count: ticksCount }}
                />
                {isLoading && <span className='loading'></span>}
            </div>

            <div className='circles-container' ref={containerRef}>
                <div className='digit-cursor' ref={cursorRef}>
                    <div className='cursor-content'>
                        {currentDigit !== null ? `${digitStats[currentDigit] ?? '0.0'}%` : ''}
                    </div>
                </div>
                <div className='circles-row'>
                    {[0, 1, 2, 3, 4].map(d => (
                        <div
                            key={`${d}`}
                            ref={el => (circleRefs.current[d] = el)}
                            className={getDigitClasses(d)}
                            onClick={() => setThreshold(d)}
                        >
                            <div className='percentage-bar' style={{ height: `${digitStats[d] ?? '0.0'}%` }}></div>
                            <span>{d}</span>
                            <small>{digitStats[d] ?? '0.0'}%</small>
                        </div>
                    ))}
                </div>
                <div className='circles-row'>
                    {[5, 6, 7, 8, 9].map(d => (
                        <div
                            key={`${d}`}
                            ref={el => (circleRefs.current[d] = el)}
                            className={getDigitClasses(d)}
                            onClick={() => setThreshold(d)}
                        >
                            <div className='percentage-bar' style={{ height: `${digitStats[d] ?? '0.0'}%` }}></div>
                            <span>{d}</span>
                            <small>{digitStats[d] ?? '0.0'}%</small>
                        </div>
                    ))}
                </div>
            </div>

            <div className='analysis-container'>
                <div className='analysis-box'>
                    <div className='analysis-title'>{localize('Over/Under Analysis')}</div>
                    <div className='threshold-display'>
                        OVER/UNDER: {threshold}{' '}
                        <span className={priceChange.isUp ? 'up-arrow' : 'down-arrow'}>
                            {priceChange.isUp ? '▲' : '▼'}
                        </span>
                    </div>

                    <div className='probability-item'>
                        <div className='probability-label'>{localize('Under')}</div>
                        <div className='probability-value under'>{overUnder.under}%</div>
                    </div>

                    <div className='probability-item'>
                        <div className='probability-label'>{localize('Equal')}</div>
                        <div className='probability-value equal'>{overUnder.equal}%</div>
                    </div>

                    <div className='probability-item'>
                        <div className='probability-label'>{localize('Over')}</div>
                        <div className='probability-value over'>{overUnder.over}%</div>
                    </div>

                    <div style={{ marginTop: '20px', fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>
                        <Localize
                            i18n_default_text='Threshold: Last digit < {{t}} = Under, = {{t}} = Equal, > {{t}} = Over'
                            values={{ t: threshold }}
                        />
                    </div>
                </div>

                <div className='analysis-box'>
                    <div className='analysis-title'>{localize('Odd/Even Analysis')}</div>

                    <div className='recent-grid'>
                        {oddEven.recent.map((d, i) => (
                            <div key={i} className={`eo-item ${d % 2 === 0 ? 'even' : 'odd'}`}>
                                {d % 2 === 0 ? 'E' : 'O'}
                            </div>
                        ))}
                    </div>

                    <div className='percentage-display'>
                        <div className='percentage-box'>
                            <div className='percentage-label'>{localize('Even')}</div>
                            <div className={`percentage-number even`}>{oddEven.even}%</div>
                        </div>

                        <div className='percentage-box'>
                            <div className='percentage-label'>{localize('Odd')}</div>
                            <div className={`percentage-number odd`}>{oddEven.odd}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='tick-feed-section'>
                <div className='analysis-title'>{localize('Recent Digits')}</div>
                <div className='tick-feed-grid' ref={tickFeedRef}></div>
            </div>

        </div>
    );
});

export default Dcircle;
