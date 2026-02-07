import React from 'react';
import './tradingview.scss';

const TradingView = () => {
    return (
        <div className='tradingview-container'>
            <iframe
                src='https://charts.deriv.com/deriv'
                className='tradingview-iframe'
                title='TradingView Chart'
                allow='fullscreen'
            />
        </div>
    );
};

export default TradingView;
