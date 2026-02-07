import React from 'react';
import Tabs from '@/components/shared_ui/tabs/tabs';
import { localize } from '@deriv-com/translations';
import RiskManagement from './components/RiskManagement';
import TradingPlanCalculator from './components/TradingPlanCalculator';
import './trading-plans.scss';

const TradingPlans = () => {
    return (
        <div className='trading-plans'>
            <div className='trading-plans__content'>
                <Tabs top className='trading-plans__tabs'>
                    <div label={localize('Plan Generator')}>
                        <TradingPlanCalculator />
                    </div>
                    <div label={localize('Risk Management')}>
                        <RiskManagement />
                    </div>
                </Tabs>

                <div className='footer-note'>
                    <i className='fas fa-lightbulb'></i> <strong>{localize('Important Note:')}</strong>{' '}
                    {localize(
                        'This tool provides theoretical projections based on your inputs. Real trading involves risk, drawdowns, commissions, taxes, and psychological factors. Past performance is not indicative of future results.'
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradingPlans;
