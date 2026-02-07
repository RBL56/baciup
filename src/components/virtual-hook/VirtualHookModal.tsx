import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import Modal from '@/components/shared_ui/modal';
import { localize } from '@deriv-com/translations';
import './VirtualHookModal.scss';

// Simple Icons
const TargetIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z" />
    </svg>
);

const ArrowBackIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
);

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
);

interface VirtualHookModalProps {
    is_open: boolean;
    onClose: () => void;
}

const VirtualHookModal = observer(({ is_open, onClose }: Partial<VirtualHookModalProps>) => {
    const store = useStore();
    const client = store?.client;

    if (!client) return null;

    const isOpen = client.is_virtual_hook_modal_open || is_open;
    const handleClose = () => {
        client.setVirtualHookModalOpen(false);
        if (onClose) onClose();
    };

    const {
        is_enabled,
        enable_after_initial,
        virtual_trades_condition,
        real_trades_condition
    } = client.virtual_hook_settings;

    const toggleEnabled = () => {
        const next_enabled = !is_enabled;
        client.setVirtualHookSettings({ is_enabled: next_enabled });

        // Sync with Blockly workspace if available
        if (window.Blockly?.derivWorkspace) {
            const blocks = window.Blockly.derivWorkspace.getAllBlocks();
            const market_block = blocks.find(b => b.type === 'trade_definition_market');
            if (market_block) {
                market_block.setFieldValue(next_enabled ? 'TRUE' : 'FALSE', 'VIRTUAL_HOOK');
            }
        }
    };

    const updateCondition = (type: 'virtual' | 'real', value: number | string) => {
        if (type === 'virtual') {
            const current = client.virtual_hook_settings.virtual_trades_condition;
            const newValue = typeof value === 'number' ? Math.max(1, current + value) : 1;
            client.setVirtualHookSettings({ virtual_trades_condition: newValue });
        }
        // For strings or other inputs we can expand this
    };

    const incrementVirtual = () => updateCondition('virtual', 1);
    const decrementVirtual = () => updateCondition('virtual', -1);

    if (!isOpen) return null;

    return (
        <Modal
            is_open={isOpen}
            className="virtual-hook-modal"
            toggleModal={handleClose}
            has_close_icon
        >
            <div className="virtual-hook-modal__header-content">
                <div className="icon-container">
                    <svg viewBox="0 0 24 24" style={{ fill: 'white', width: 32, height: 32 }}><path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.5 2.54l2.6 1.53c.56-1.24.9-2.62.9-4.07 0-5.17-3.92-9.42-8.98-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.53-9 4.78-9 9.95 0 5.52 4.48 10 10 10 2.67 0 5.11-1.03 6.96-2.71l-2.12-2.12C15.32 18.43 13.74 19 12 19zM11 2v3.04C7.61 5.53 5 8.43 5 11.96c0 .9.18 1.75.5 2.54l-2.6 1.53C2.34 14.79 2 13.41 2 11.96c0-5.17 3.92-9.43 8.98-9.96z" /></svg>
                </div>
                <h2>{localize('Virtual Hook')}</h2>
                <p>{localize('Protect your balance with virtual trades')}</p>
            </div>

            <div className="virtual-hook-modal__toggle-section">
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={is_enabled}
                        onChange={toggleEnabled}
                    />
                    <span className="slider round"></span>
                </label>
                <div
                    className="toggle-label"
                    onClick={toggleEnabled}
                    style={{ cursor: 'pointer', color: is_enabled ? '#FFA500' : '#888' }}
                >
                    {is_enabled ? localize('ENABLED') : localize('DISABLED')}
                </div>
            </div>

            <div className="virtual-hook-modal__setting-card">
                <div className="virtual-hook-modal__setting-card--left">
                    <div className="setting-icon"><ArrowBackIcon /></div>
                    <div className="setting-info">
                        <h3>{localize('Enable Virtual Hook after (initial)')}</h3>
                        <p>{localize('Checked only once after VH is enabled')}</p>
                    </div>
                </div>
                <div className="virtual-hook-modal__setting-card--right">
                    <input
                        type="text"
                        value={enable_after_initial}
                        readOnly
                        style={{ opacity: 0.7 }}
                    />
                </div>
            </div>

            <div className="virtual-hook-modal__setting-card">
                <div className="virtual-hook-modal__setting-card--left">
                    <div className="setting-icon"><TargetIcon /></div>
                    <div className="setting-info">
                        <h3>{localize('Virtual Trades before switching to real')}</h3>
                        <p>{localize('While in virtual mode, switch back to real when this condition is met')}</p>
                    </div>
                </div>
                <div className="virtual-hook-modal__setting-card--right" style={{ flexDirection: 'column', gap: '8px' }}>
                    <input
                        type="text"
                        value={localize('N consecutive losses')}
                        readOnly
                        style={{ marginBottom: '5px' }}
                    />
                    <div className="counter-control">
                        <button onClick={decrementVirtual}>-</button>
                        <span>{virtual_trades_condition}</span>
                        <button onClick={incrementVirtual}>+</button>
                    </div>
                </div>
            </div>

            <div className="virtual-hook-modal__setting-card">
                <div className="virtual-hook-modal__setting-card--left">
                    <div className="setting-icon"><RefreshIcon /></div>
                    <div className="setting-info">
                        <h3>{localize('Real Trades before returning to VH')}</h3>
                        <p>{localize('After VH has been used once, this controls re-entry into virtual mode')}</p>
                    </div>
                </div>
                <div className="virtual-hook-modal__setting-card--right">
                    <input
                        type="text"
                        value={real_trades_condition}
                        readOnly
                        style={{ opacity: 0.7 }}
                    />
                </div>
            </div>

            <button className="virtual-hook-modal__save-btn" onClick={handleClose}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                {localize('Apply Settings')}
            </button>
        </Modal>
    );
});

export default VirtualHookModal;
