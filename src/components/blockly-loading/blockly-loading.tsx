import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Loader } from '@deriv-com/ui';

const BlocklyLoading = observer(() => {
    const { blockly_store } = useStore();
    const { is_loading } = blockly_store;

    return (
        <>
            {is_loading && (
                <div className='bot__loading' data-testid='blockly-loader'>
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
                    <Loader />
                    <div style={{ marginTop: '16px', color: 'white', fontSize: '1.4rem' }}>Loading Blockly...</div>
                </div>
            )}
        </>
    );
});

export default BlocklyLoading;
