import { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Localize } from '@deriv-com/translations';
import { useStore } from '@/hooks/useStore';
import copyTradingService from '@/services/copy-trading-service';
import { DBOT_TABS } from '@/constants/bot-contents';
import './copy-trading.scss';

// Configuration
const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=120181';

interface AccountState {
    socket: WebSocket | null;
    status: 'inactive' | 'connecting' | 'active' | 'retrying';
    loginid: string;
    balance: string;
    currency: string;
    isVirtual: boolean;
    reconnectAttempts: number;
}

interface ClientAccount extends AccountState {
    token: string;
    masked: string;
}

interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

const CopyTrading = observer(() => {
    const { client, dashboard } = useStore();

    // -- State --
    const [masterBalance, setMasterBalance] = useState<string>(client.balance);
    const [secondary, setSecondary] = useState<AccountState>({
        socket: null,
        status: 'inactive',
        loginid: '—',
        balance: '—',
        currency: '',
        isVirtual: false,
        reconnectAttempts: 0,
    });

    const [clients, setClients] = useState<ClientAccount[]>(() => {
        const status = copyTradingService.getStatus();
        return (status.clients || []).map((c: any) => ({
            ...c,
            status: 'connecting',
            socket: null,
            reconnectAttempts: 0
        }));
    });
    const [isCopying, setIsCopying] = useState(() => copyTradingService.getStatus().isActive);
    const [copyToClients, setCopyToClients] = useState(() => copyTradingService.getStatus().settings.copyToClients);
    const [copyToSecondary, setCopyToSecondary] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Risk Controls


    // Refs for real-time logic
    const secondarySocketRef = useRef<WebSocket | null>(null);
    const dailyStartBalanceRef = useRef<Record<string, number>>({});

    // -- Utilities --
    const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const maskToken = (t: string) => {
        return t.length > 12 ? t.slice(0, 6) + '••••••••••••' + t.slice(-6) : '••••••••••••';
    };

    // -- WebSocket Handlers --

    const connectSecondary = useCallback(
        (token: string) => {
            if (secondarySocketRef.current) secondarySocketRef.current.close();

            const ws = new WebSocket(WS_URL);
            secondarySocketRef.current = ws;
            setSecondary(prev => ({ ...prev, socket: ws, status: 'connecting' }));

            ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                if (d.error) {
                    addNotification(`Secondary Error: ${d.error.message}`, 'error');
                    return;
                }

                if (d.authorize) {
                    const acc = d.authorize;
                    setSecondary(prev => ({
                        ...prev,
                        status: 'active',
                        loginid: acc.loginid,
                        balance: `${acc.balance.toFixed(2)} ${acc.currency}`,
                        currency: acc.currency,
                        isVirtual: !!acc.is_virtual,
                        reconnectAttempts: 0,
                    }));
                    dailyStartBalanceRef.current[acc.loginid] = acc.balance;
                    ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
                    addNotification(`Secondary Connected: ${acc.loginid}`, 'success');
                }

                if (d.balance) {
                    setSecondary(prev => ({
                        ...prev,
                        balance: `${d.balance.balance.toFixed(2)} ${d.balance.currency}`,
                    }));
                }
            };

            ws.onclose = () => {
                setSecondary(prev => ({ ...prev, status: 'inactive', socket: null }));
            };
        },
        [addNotification]
    );

    const connectClient = useCallback(
        (token: string, index: number) => {
            if (!token) return;
            const ws = new WebSocket(WS_URL);

            setClients(prev => {
                const next = [...prev];
                if (next[index]) next[index] = { ...next[index], status: 'connecting', socket: ws };
                return next;
            });

            ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                if (d.error) {
                    addNotification(`Client Error: ${d.error.message}`, 'error');
                    setClients(prev => {
                        const next = [...prev];
                        if (next[index]) next[index].status = 'inactive';
                        return next;
                    });
                    return;
                }

                if (d.authorize) {
                    const acc = d.authorize;
                    setClients(prev => {
                        const next = [...prev];
                        if (next[index]) {
                            next[index] = {
                                ...next[index],
                                status: 'active',
                                loginid: acc.loginid,
                                balance: `${acc.balance.toFixed(2)} ${acc.currency}`,
                                currency: acc.currency,
                                isVirtual: !!acc.is_virtual,
                                reconnectAttempts: 0,
                            };
                        }
                        return next;
                    });
                    dailyStartBalanceRef.current[acc.loginid] = acc.balance;
                    ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
                }

                if (d.balance) {
                    setClients(prev => {
                        const next = [...prev];
                        if (next[index]) next[index].balance = `${d.balance.balance.toFixed(2)} ${d.balance.currency}`;
                        return next;
                    });
                }
            };

            ws.onclose = () => {
                setClients(prev => {
                    const next = [...prev];
                    if (next[index]) next[index].status = 'inactive';
                    return next;
                });
            };
        },
        [addNotification]
    );

    // -- Lifecycle --
    // Sync master balance from client store
    useEffect(() => {
        setMasterBalance(client.balance);
    }, [client.balance, client.is_logged_in]);

    useEffect(() => {
        // Set notification callback for the service
        copyTradingService.setNotificationCallback(addNotification);

        // Connect initial clients
        clients.forEach((client, index) => {
            setTimeout(() => {
                connectClient(client.token, index);
            }, index * 500);
        });

        // Load secondary token if exists
        const savedSecondary = localStorage.getItem('secondary_token');
        if (savedSecondary) connectSecondary(savedSecondary);

        // NOTE: We no longer disable copy trading on unmount so it runs in background
        return () => {
            secondarySocketRef.current?.close();
            copyTradingService.setNotificationCallback(() => { }); // Remove callback but keep service running
        };
    }, [connectSecondary, connectClient, addNotification]);

    // Update service when clients or settings change
    useEffect(() => {
        copyTradingService.updateClients(clients);
        copyTradingService.updateSettings({
            maxStakePercent: 5,
            stakeMultiplier: 1,
            dailyLossLimit: 10,
            copyToClients,
        });
    }, [clients, copyToClients]);

    // Stop copy trading when switching tabs
    useEffect(() => {
        if (dashboard.active_tab !== DBOT_TABS.COPY_TRADING && isCopying) {
            setIsCopying(false);
            copyTradingService.disableCopyTrading();
            addNotification('Copy trading stopped (Tab Switched)', 'info');
        }
    }, [dashboard.active_tab, isCopying, addNotification]);

    // -- render helpers --
    const getSecondaryStatusIcon = () => {
        if (secondary.status === 'active') return <i className='fas fa-check-circle'></i>;
        if (secondary.status === 'connecting') return <i className='fas fa-spinner fa-spin'></i>;
        return <i className='fas fa-times-circle'></i>;
    };

    return (
        <div className='copy-trading-page'>
            {!client.is_logged_in && (
                <div className='auth-overlay'>
                    <div className='auth-message'>
                        <h2><Localize i18n_default_text='Authentication Required' /></h2>
                        <p><Localize i18n_default_text='Please log in to your Deriv account to access Copy Trading.' /></p>
                        <button
                            className='btn btn-secondary leave-btn'
                            onClick={() => dashboard.setActiveTab(0)}
                            style={{ marginTop: '20px', width: '100%' }}
                        >
                            <i className='fas fa-arrow-left'></i> <Localize i18n_default_text='Back to Dashboard' />
                        </button>
                    </div>
                </div>
            )}
            <div className='container'>
                <div className='master-section'>
                    <div className='card'>
                        <div className='card-title'>
                            <i className='fas fa-crown'></i>
                            Master Account (Your Active Trading Session)
                            <span className={`account-type-badge ${client.is_virtual ? 'demo' : 'real'}`}>
                                {client.is_virtual ? 'DEMO' : 'REAL'}
                            </span>
                        </div>

                        <div className={`status-indicator ${client.is_logged_in ? 'active' : 'inactive'}`}>
                            {client.is_logged_in ? (
                                <><i className='fas fa-check-circle'></i> Connected</>
                            ) : (
                                <><i className='fas fa-times-circle'></i> Not Connected</>
                            )}
                        </div>

                        <div style={{ margin: '12px 0 0', lineHeight: 1.5 }}>
                            <strong>LoginID:</strong> {client.loginid || '—'}
                            <br />
                            <strong>Balance:</strong> {client.is_logged_in ? `${masterBalance} ${client.currency}` : '—'}
                            <br />
                            <strong>Type:</strong> {client.is_virtual ? 'DEMO' : 'REAL'}
                        </div>

                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--card-light)', borderRadius: '8px', fontSize: '1.2rem', color: 'var(--grey)' }}>
                            <i className='fas fa-info-circle'></i> All trades made anywhere in the app will be copied to client accounts when copy trading is active.
                        </div>

                        {!client.is_logged_in && (
                            <div className='login-warning' style={{ marginTop: '12px', color: 'var(--danger)', fontSize: '1.2rem' }}>
                                <i className='fas fa-exclamation-triangle'></i> Please log in to your main account to use copy trading.
                            </div>
                        )}
                    </div>
                </div>

                <div className='card secondary-account' style={{ display: client.is_virtual ? 'block' : 'none' }}>
                    <div className='card-title'>
                        <i className='fas fa-exchange-alt'></i>
                        Your Real Account (Execution Target)
                    </div>

                    <div
                        className={`status-indicator ${secondary.status === 'active' ? 'active' : secondary.status === 'connecting' ? 'connecting' : 'inactive'}`}
                    >
                        {getSecondaryStatusIcon()}{' '}
                        {secondary.status === 'active'
                            ? 'Connected'
                            : secondary.status === 'connecting'
                                ? 'Connecting...'
                                : 'Not Connected'}
                    </div>

                    <div style={{ margin: '12px 0 0', lineHeight: 1.5 }}>
                        <strong>LoginID:</strong> {secondary.loginid}
                        <br />
                        <strong>Balance:</strong> {secondary.balance}
                        <br />
                        <strong>Type:</strong> REAL
                    </div>

                    <div style={{ marginTop: '12px' }}>
                        <input
                            type='text'
                            id='secondaryTokenInput'
                            placeholder='Paste Real Account Token...'
                            onKeyPress={e => {
                                if (e.key === 'Enter') {
                                    const token = e.currentTarget.value.trim();
                                    if (token) {
                                        localStorage.setItem('secondary_token', token);
                                        connectSecondary(token);
                                    }
                                }
                            }}
                        />
                        <button
                            className='btn btn-warning'
                            style={{ width: '100%' }}
                            onClick={() => {
                                const input = document.getElementById('secondaryTokenInput') as HTMLInputElement;
                                const token = input.value.trim();
                                if (token) {
                                    localStorage.setItem('secondary_token', token);
                                    connectSecondary(token);
                                } else {
                                    addNotification('Secondary token required', 'error');
                                }
                            }}
                        >
                            <i className='fas fa-plug'></i> Connect Real Account
                        </button>
                    </div>
                </div>

                <div className='card'>
                    <div className='card-title'>
                        <i className='fas fa-cogs'></i> Copy Trading Modes
                    </div>

                    <div className='mode-description'>
                        {client.is_logged_in ? (
                            <>
                                <strong>{client.is_virtual ? 'Demo' : 'Real'} Master Detected:</strong>
                                {client.is_virtual
                                    ? ' You can copy trades from your demo account to your real account and/or client accounts.'
                                    : ' Copy trading from your real account to client accounts only.'}
                            </>
                        ) : (
                            'Please log in to your master account to see available copying options.'
                        )}
                    </div>

                    {client.is_logged_in && (
                        <div className='mode-section'>
                            <div className='mode-toggle'>
                                <input
                                    type='checkbox'
                                    id='copyToClientsCheckbox'
                                    checked={copyToClients}
                                    onChange={e => setCopyToClients(e.target.checked)}
                                />
                                <label htmlFor='copyToClientsCheckbox'>Copy to Client Accounts</label>
                            </div>

                            {client.is_virtual && (
                                <div className='mode-toggle'>
                                    <input
                                        type='checkbox'
                                        id='copyToSecondaryCheckbox'
                                        disabled={secondary.status !== 'active'}
                                        checked={copyToSecondary && secondary.status === 'active'}
                                        onChange={e => setCopyToSecondary(e.target.checked)}
                                    />
                                    <label htmlFor='copyToSecondaryCheckbox'>Copy to My Real Account</label>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '20px 0' }}>
                        <button
                            className='btn btn-primary'
                            disabled={isCopying || !client.is_logged_in}
                            onClick={() => {
                                setIsCopying(true);
                                copyTradingService.enableCopyTrading(clients, {
                                    maxStakePercent: 5,
                                    stakeMultiplier: 1,
                                    dailyLossLimit: 10,
                                    copyToClients,
                                });
                                addNotification('Copy trading engine started', 'success');
                            }}
                        >
                            <i className='fas fa-play'></i> Start Copying
                        </button>
                        <button
                            className='btn btn-danger'
                            disabled={!isCopying}
                            onClick={() => {
                                setIsCopying(false);
                                copyTradingService.disableCopyTrading();
                                addNotification('Copy trading stopped', 'info');
                            }}
                        >
                            <i className='fas fa-stop'></i> Stop
                        </button>
                    </div>


                </div>

                <div className='card'>
                    <div className='card-title'>
                        <i className='fas fa-plus-circle'></i> Add Client Token
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <input
                            type='text'
                            id='newTokenInput'
                            placeholder='Paste Deriv API token...'
                            style={{ flex: 1, minWidth: '280px' }}
                            onKeyPress={e => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                        const newIndex = clients.length;
                                        setClients(prev => [
                                            ...prev,
                                            {
                                                token: val,
                                                masked: maskToken(val),
                                                status: 'connecting',
                                                socket: null,
                                                loginid: '—',
                                                balance: '—',
                                                currency: 'USD',
                                                isVirtual: false,
                                                reconnectAttempts: 0,
                                            },
                                        ]);
                                        connectClient(val, newIndex);
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                        />
                        <button
                            className='btn btn-primary'
                            onClick={() => {
                                const input = document.getElementById('newTokenInput') as HTMLInputElement;
                                const val = input.value.trim();
                                if (val) {
                                    const newIndex = clients.length;
                                    setClients(prev => [
                                        ...prev,
                                        {
                                            token: val,
                                            masked: maskToken(val),
                                            status: 'connecting',
                                            socket: null,
                                            loginid: '—',
                                            balance: '—',
                                            currency: 'USD',
                                            isVirtual: false,
                                            reconnectAttempts: 0,
                                        },
                                    ]);
                                    connectClient(val, newIndex);
                                    input.value = '';
                                }
                            }}
                        >
                            Add & Connect
                        </button>
                    </div>
                </div>

                <div className='card'>
                    <div className='card-title'>
                        <i className='fas fa-users'></i> Client Accounts <span>({clients.length})</span>
                    </div>
                    <div>
                        {clients.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '50px', color: '#666', fontSize: '1.4rem' }}>
                                No clients added yet...
                            </div>
                        ) : (
                            clients.map((client, i) => (
                                <div key={i} className='token-item'>
                                    <div
                                        className={`token-status ${client.status === 'active' ? 'connected' : 'connecting'}`}
                                    ></div>
                                    <div style={{ flex: 1 }}>
                                        <div className='masked-token'>{client.masked}</div>
                                        <div className='client-info'>
                                            {client.loginid} • {client.balance} •{' '}
                                            <strong>{client.isVirtual ? 'DEMO' : 'REAL'}</strong>
                                        </div>
                                    </div>
                                    <button
                                        className='remove-btn'
                                        onClick={() => {
                                            setClients(prev => prev.filter((_, idx) => idx !== i));
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {notifications.map(n => (
                <div key={n.id} className={`notification ${n.type}`}>
                    {n.message}
                </div>
            ))}
        </div>
    );
});

export default CopyTrading;
