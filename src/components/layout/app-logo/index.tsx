import React from 'react';
import SocialMediaModal from './social-media-modal';
import './app-logo.scss';

export const AppLogo = () => {
    const [is_modal_open, setIsModalOpen] = React.useState(false);

    const toggleModal = () => setIsModalOpen(!is_modal_open);

    const onIconClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleModal();
    };

    return (
        <div className='app-header__logo-link'>
            <img src='/images/loco-logo.jpg' alt='LOCO THE TRADER' className='app-header__logo-image' />
            <span className='app-header__logo-text'>LOCO THE TRADER</span>
            <svg
                width='20'
                height='20'
                viewBox='0 0 28 28'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                className='app-header__chat-icon'
                style={{ marginLeft: '4px', cursor: 'pointer' }}
                onClick={onIconClick}
            >
                <path
                    d='M14 26C21.1797 26 27 20.4036 27 13.5C27 6.59644 21.1797 1 14 1C6.8203 1 1 6.59644 1 13.5C1 16.3533 2.00192 18.9854 3.68749 21.1044L2.09458 25.4385C1.86873 26.0544 2.47466 26.6219 3.09703 26.3752L7.65342 24.5684C9.53036 25.4855 11.6961 26 14 26Z'
                    fill='#0088cc'
                />
                <circle cx='8.5' cy='13.5' r='1.5' fill='white' />
                <circle cx='14' cy='13.5' r='1.5' fill='white' />
                <circle cx='19.5' cy='13.5' r='1.5' fill='white' />
            </svg>
            <SocialMediaModal is_open={is_modal_open} toggleModal={toggleModal} />
        </div>
    );
};
