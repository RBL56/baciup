import './app-logo.scss';

export const AppLogo = () => {
    return (
        <div className='app-header__logo-link' onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
            <img src='/images/loco-logo.jpg' alt='LOCO THE TRADER' className='app-header__logo-image' />
            <span className='app-header__logo-text'>LOCO THE TRADER</span>
        </div>
    );
};
