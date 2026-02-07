import React, { useEffect, useState } from 'react';
import { localize } from '@deriv-com/translations';
import './loading-screen.scss';

interface LoadingScreenProps {
    message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
    const [progress, setProgress] = useState(0);
    const [showSkip, setShowSkip] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prevProgress) => {
                const nextProgress = prevProgress + Math.random() * 10;
                return nextProgress > 90 ? 90 : nextProgress; // Slow down at 90%
            });
        }, 500);

        const skipTimeout = setTimeout(() => {
            setShowSkip(true);
        }, 12000); // Show skip after 12 seconds

        return () => {
            clearInterval(interval);
            clearTimeout(skipTimeout);
        };
    }, []);

    const onSkip = () => {
        const loadingElement = document.querySelector('.loading-screen-overlay');
        if (loadingElement) {
            loadingElement.classList.add('fade-out');
            setTimeout(() => {
                // We can't easily set parent state from here without a prop, 
                // but we can at least try to hide it visually or wait for the parent to catch up.
                // However, the best way is to let the user know they can refresh or try again.
                window.location.reload();
            }, 500);
        }
    };

    return (
        <div className="loading-screen">
            <div className="loading-screen__background">
                <div className="loading-screen__bg-overlay"></div>
                <img src="/images/loco-logo.jpg" alt="Background Logo" className="loading-screen__bg-logo" />
            </div>
            <div className="loading-screen__content">
                <img
                    src="/images/loco-logo.jpg"
                    alt="LOCO THE TRADER"
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        objectFit: 'cover',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)'
                    }}
                />
                <h1 className="loading-screen__title">LOCO THE TRADER</h1>
                <p className="loading-screen__subtitle">Welcome to Loco the Trader</p>
                <div className="loading-screen__status-container">
                    <span className="loading-screen__status">{message || 'Preparing dashboard'}</span>
                </div>
                <div className="loading-screen__loader-container">
                    <div className="loading-screen__progress-bar">
                        <div
                            className="loading-screen__progress-fill"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="loading-screen__percentage">{Math.round(progress)}%</div>
                </div>
                {showSkip && (
                    <div className="loading-screen__skip" onClick={onSkip} style={{
                        marginTop: '20px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}>
                        {localize('Taking too long? Click here to skip')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;
