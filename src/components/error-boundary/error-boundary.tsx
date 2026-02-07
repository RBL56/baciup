import React, { Component, ErrorInfo, ReactNode } from 'react';
import { localize } from '@deriv-com/translations';
import { Button } from '@deriv-com/ui';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    style={{
                        height: '100vh',
                        width: '100vw',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'radial-gradient(circle at center, #1a2a4a 0%, #050a1a 100%)',
                        color: '#fff',
                        textAlign: 'center',
                        padding: '20px',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <h1 style={{ fontSize: '3rem', marginBottom: '2rem', color: '#ff444f' }}>
                        {localize('Something went wrong')}
                    </h1>
                    <p style={{ fontSize: '1.6rem', marginBottom: '3rem', opacity: 0.8 }}>
                        {localize('We encountered an unexpected error. Please try reloading the page.')}
                    </p>
                    {this.state.error && (
                        <pre
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                maxWidth: '80%',
                                overflow: 'auto',
                                fontSize: '1.2rem',
                                marginBottom: '3rem',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                        >
                            {this.state.error.message}
                        </pre>
                    )}
                    <Button primary onClick={this.handleReload} style={{ padding: '1.2rem 2.4rem' }}>
                        {localize('Reload Page')}
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
