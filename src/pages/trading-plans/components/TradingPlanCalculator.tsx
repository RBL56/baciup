import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { localize } from '@deriv-com/translations';
import { Text } from '@deriv-com/ui';

interface PlanRow {
    day: number;
    start: string;
    profit: string;
    sessionProfits: string[];
    end: string;
    cumPct: string;
}

const TradingPlanCalculator = () => {
    const [startCapital, setStartCapital] = useState<number>(5000);
    const [mode, setMode] = useState<'gain' | 'target'>('gain');
    const [dailyGain, setDailyGain] = useState<number>(3);
    const [dailyTarget, setDailyTarget] = useState<number>(150);
    const [totalDays, setTotalDays] = useState<number>(20);
    const [sessionsPerDay, setSessionsPerDay] = useState<number>(1);
    const [planData, setPlanData] = useState<PlanRow[]>([]);
    const [summary, setSummary] = useState({
        finalBalance: 0,
        totalProfit: 0,
        totalROI: 0,
        dailyAvg: 0,
    });

    const tableEndRef = useRef<HTMLTableRowElement>(null);

    const generatePlan = () => {
        const start = startCapital || 1000;
        const days = totalDays || 20;
        const gainPct = (dailyGain || 3) / 100;
        const fixedTarget = dailyTarget || 50;

        let capital = start;
        const initialCapital = start;
        let totalProfit = 0;
        const newData: PlanRow[] = [];

        for (let day = 1; day <= days; day++) {
            let dailyProfit = 0;
            const dayStart = capital;

            for (let s = 0; s < sessionsPerDay; s++) {
                let sessionProfit;
                if (mode === 'gain') {
                    sessionProfit = (capital * gainPct) / sessionsPerDay;
                } else {
                    sessionProfit = fixedTarget / sessionsPerDay;
                }
                capital += sessionProfit;
                dailyProfit += sessionProfit;
            }

            const ending = capital;
            const cumulativePct = (ending / initialCapital - 1) * 100;
            totalProfit += dailyProfit;
            const dailySessionProfits: string[] = [];

            // Re-calculate individual session profits for display
            let tempCapital = dayStart;
            for (let s = 0; s < sessionsPerDay; s++) {
                let sProfit;
                if (mode === 'gain') {
                    sProfit = (tempCapital * gainPct) / sessionsPerDay;
                } else {
                    sProfit = fixedTarget / sessionsPerDay;
                }
                dailySessionProfits.push(sProfit.toFixed(2));
                tempCapital += sProfit;
            }

            newData.push({
                day,
                start: dayStart.toFixed(2),
                profit: dailyProfit.toFixed(2),
                sessionProfits: dailySessionProfits,
                end: ending.toFixed(2),
                cumPct: cumulativePct.toFixed(2),
            });
        }

        setPlanData(newData);
        setSummary({
            finalBalance: capital,
            totalProfit,
            totalROI: (capital / initialCapital - 1) * 100,
            dailyAvg: totalProfit / days,
        });
    };

    useEffect(() => {
        generatePlan();
    }, []);

    // useEffect(() => {
    //     if (tableEndRef.current) {
    //         tableEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    //     }
    // }, [planData]);

    const downloadPDF = () => {
        if (planData.length === 0) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const modeValue = mode === 'gain' ? `${dailyGain}% daily gain` : `$${dailyTarget} fixed daily target`;

        // Header
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('TRADING PLAN', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Growth Projection Report', pageWidth / 2, 30, { align: 'center' });

        // Parameters
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        let y = 55;
        doc.text('Parameters:', 15, y);
        y += 8;
        doc.text(`Starting Capital: $${startCapital}`, 20, y);
        y += 6;
        doc.text(`Mode: ${modeValue}`, 20, y);
        y += 6;
        doc.text(`Trading Days: ${totalDays}`, 20, y);
        y += 6;
        doc.text(`Sessions per Day: ${sessionsPerDay}`, 20, y);
        y += 12;

        // Table layout configuration
        let xDay = 15;
        let xStart = 40;
        let xProfit = 95;
        let xEnd = 135;
        let xCum = 175; // Header X
        let xCumVal = 175; // Value X
        const sessionXPositions: number[] = [];

        if (sessionsPerDay > 1) {
            xDay = 12;
            xStart = 28;
            let currentX = 55; // Shifted left
            const step = 22; // Slightly tighter

            for (let i = 0; i < sessionsPerDay; i++) {
                sessionXPositions.push(currentX);
                currentX += step;
            }
            xProfit = currentX + 5; // Total profit
            xEnd = xProfit + 30;
            xCum = xEnd + 30;
            xCumVal = xCum;
        }

        // Table header
        doc.setFillColor(240, 244, 249);
        doc.rect(14, y - 5, pageWidth - 28, 10, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9); // Size 9 for cleaner look
        doc.text('Day', xDay, y);
        doc.text('Start Bal', xStart, y);

        if (sessionsPerDay > 1) {
            sessionXPositions.forEach((x, i) => {
                doc.text(`Sess ${i + 1}`, x, y);
            });
            doc.text('Total P/L', xProfit, y);
        } else {
            doc.text('Profit', xProfit, y);
        }

        doc.text('End Bal', xEnd, y);
        doc.text('Cum %', xCum, y);

        // Table content
        doc.setFontSize(9);
        y += 8;

        planData.forEach((row, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            // Zebra striping
            if (index % 2 === 0) {
                doc.setFillColor(249, 250, 251); // Very light gray
                doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
            }

            doc.setTextColor(30, 41, 59);
            doc.text(row.day.toString(), xDay, y);
            doc.text('$' + row.start, xStart, y);

            if (sessionsPerDay > 1) {
                row.sessionProfits.forEach((sp, i) => {
                    doc.setTextColor(16, 185, 129);
                    doc.text('+' + sp, sessionXPositions[i], y);
                });
            }

            doc.setTextColor(16, 185, 129);
            doc.text('+' + row.profit, xProfit, y);
            doc.setTextColor(30, 41, 59);
            doc.text('$' + row.end, xEnd, y);
            doc.text(row.cumPct + '%', xCumVal, y);
            y += 8; // Slightly tighter row height
        });

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('Generated by Trading Plan Generator • ' + new Date().toLocaleDateString(), pageWidth / 2, 285, {
            align: 'center',
        });

        doc.save(`trading_plan_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className='trading-plan-calculator'>
            <div className='main-content'>
                <div className='form-section'>
                    <div className='section-title'>
                        <i className='fas fa-sliders-h'></i>
                        <Text weight='bold'>{localize('Trading Parameters')}</Text>
                    </div>

                    <div className='form-grid'>
                        <div className='form-group'>
                            <label>
                                <i className='fas fa-wallet'></i> {localize('Starting Capital ($)')}
                            </label>
                            <div className='input-container'>
                                <i className='fas fa-dollar-sign'></i>
                                <input
                                    type='number'
                                    value={startCapital}
                                    onChange={e => setStartCapital(Number(e.target.value))}
                                    min='1'
                                    step='1'
                                />
                            </div>
                        </div>

                        <div className='form-group'>
                            <label>
                                <i className='fas fa-cogs'></i> {localize('Calculation Mode')}
                            </label>
                            <select value={mode} onChange={e => setMode(e.target.value as 'gain' | 'target')}>
                                <option value='gain'>{localize('Daily Gain (%)')}</option>
                                <option value='target'>{localize('Fixed Daily Target ($)')}</option>
                            </select>
                        </div>

                        {mode === 'gain' ? (
                            <div className='form-group'>
                                <label>
                                    <i className='fas fa-arrow-up'></i> {localize('Daily Gain Target (%)')}
                                </label>
                                <div className='input-container'>
                                    <i className='fas fa-percentage'></i>
                                    <input
                                        type='number'
                                        value={dailyGain}
                                        onChange={e => setDailyGain(Number(e.target.value))}
                                        min='0.1'
                                        max='100'
                                        step='0.1'
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className='form-group'>
                                <label>
                                    <i className='fas fa-bullseye'></i> {localize('Fixed Daily Profit Target ($)')}
                                </label>
                                <div className='input-container'>
                                    <i className='fas fa-dollar-sign'></i>
                                    <input
                                        type='number'
                                        value={dailyTarget}
                                        onChange={e => setDailyTarget(Number(e.target.value))}
                                        min='0.01'
                                        step='0.01'
                                    />
                                </div>
                            </div>
                        )}

                        <div className='form-group'>
                            <label>
                                <i className='fas fa-calendar-alt'></i> {localize('Trading Days')}
                            </label>
                            <div className='input-container'>
                                <i className='fas fa-clock'></i>
                                <input
                                    type='number'
                                    value={totalDays}
                                    onChange={e => setTotalDays(Number(e.target.value))}
                                    min='1'
                                    max='365'
                                    step='1'
                                />
                            </div>
                        </div>
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

                    <div className='buttons'>
                        <button className='btn btn-primary' onClick={generatePlan}>
                            <i className='fas fa-calculator'></i> {localize('Generate Trading Plan')}
                        </button>
                        <button className='btn btn-success' onClick={generatePlan}>
                            <i className='fas fa-chart-bar'></i> {localize('Update Projections')}
                        </button>
                        <button className='btn btn-secondary' onClick={downloadPDF}>
                            <i className='fas fa-file-pdf'></i> {localize('Export to PDF')}
                        </button>
                    </div>
                </div>

                <div className='summary-section'>
                    <div className='section-title'>
                        <i className='fas fa-chart-pie'></i>
                        <Text weight='bold'>{localize('Performance Summary')}</Text>
                    </div>

                    <div className='summary-cards'>
                        <div className='summary-card'>
                            <div className='label'>{localize('Final Balance')}</div>
                            <div className='value'>${summary.finalBalance.toFixed(2)}</div>
                        </div>
                        <div className='summary-card success'>
                            <div className='label'>{localize('Total Profit')}</div>
                            <div className='value'>+${summary.totalProfit.toFixed(2)}</div>
                        </div>
                        <div className='summary-card warning'>
                            <div className='label'>{localize('Total ROI')}</div>
                            <div className='value'>{summary.totalROI.toFixed(2)}%</div>
                        </div>
                        <div className='summary-card'>
                            <div className='label'>{localize('Daily Average')}</div>
                            <div className='value'>${summary.dailyAvg.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                <div className='results-section'>
                    <div className='section-title'>
                        <i className='fas fa-table'></i>
                        <Text weight='bold'>
                            {localize('Trading Plan Details')} ({sessionsPerDay}{' '}
                            {sessionsPerDay === 1 ? localize('Session') : localize('Sessions')})
                        </Text>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8', marginLeft: 'auto', fontWeight: 500 }}>
                            <i className='fas fa-arrow-down'></i> {localize('Scroll down to see all days')}
                        </span>
                    </div>

                    <div className='table-container'>
                        <table id='planTable'>
                            <thead>
                                <tr>
                                    <th>{localize('Day')}</th>
                                    <th>{localize('Starting Balance')}</th>
                                    {sessionsPerDay > 1 &&
                                        Array.from({ length: sessionsPerDay }).map((_, i) => (
                                            <th key={i}>
                                                {localize('Session')} {i + 1}
                                            </th>
                                        ))}
                                    <th>{sessionsPerDay > 1 ? localize('Total Profit') : localize('Profit')}</th>
                                    <th>{localize('Ending Balance')}</th>
                                    <th>{localize('Cumulative %')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planData.map(row => (
                                    <tr key={row.day}>
                                        <td>{row.day}</td>
                                        <td>${row.start}</td>
                                        {sessionsPerDay > 1 &&
                                            row.sessionProfits.map((sp, i) => (
                                                <td key={i} className='profit'>
                                                    +${sp}
                                                </td>
                                            ))}
                                        <td className='profit'>+${row.profit}</td>
                                        <td>
                                            <strong>${row.end}</strong>
                                        </td>
                                        <td>{row.cumPct}%</td>
                                    </tr>
                                ))}
                                <tr ref={tableEndRef}></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className='plan-cards-container'>
                        {planData.map(row => (
                            <div key={row.day} className='plan-card'>
                                <div className='card-header'>
                                    <div className='day-badge'>{localize('Day')} {row.day}</div>
                                    <div className='cum-pct'>{row.cumPct}% ROI</div>
                                </div>
                                <div className='card-body'>
                                    <div className='info-row'>
                                        <span className='label'>{localize('Starting')}</span>
                                        <span className='value'>${row.start}</span>
                                    </div>
                                    <div className='info-row'>
                                        <span className='label'>{localize('Ending')}</span>
                                        <span className='value emphasis'>${row.end}</span>
                                    </div>

                                    <div className='sessions-breakdown'>
                                        {sessionsPerDay === 1 ? (
                                            <div className='info-row highlight-green'>
                                                <span className='label'>{localize('Profit')}</span>
                                                <span className='value'>+${row.profit}</span>
                                            </div>
                                        ) : (
                                            <>
                                                {row.sessionProfits.map((sp, i) => (
                                                    <div key={i} className='session-item'>
                                                        <span className='label'>{localize('Session')} {i + 1}</span>
                                                        <span className='value'>+${sp}</span>
                                                    </div>
                                                ))}
                                                <div className='info-row highlight-green total-profit'>
                                                    <span className='label'>{localize('Total Profit')}</span>
                                                    <span className='value'>+${row.profit}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradingPlanCalculator;
