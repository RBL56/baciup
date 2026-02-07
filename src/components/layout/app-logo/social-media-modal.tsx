import {
    SocialWhatsappBrandIcon,
    SocialTelegramBrandIcon,
    SocialYoutubeBrandIcon,
    SocialInstagramBrandIcon,
    SocialTiktokBrandIcon,
    SocialFacebookBrandIcon,
} from '@deriv/quill-icons/Social';
import Modal from '../../shared_ui/modal/modal';
import Button from '../../shared_ui/button/button';
import Text from '../../shared_ui/text/text';
import './social-media-modal.scss';

type TSocialMediaModal = {
    is_open: boolean;
    toggleModal: () => void;
};

const socialMediaLinks = [
    {
        icon: <SocialWhatsappBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'WhatsApp Group',
        href: '#',
    },
    {
        icon: <SocialTelegramBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'Telegram',
        href: '#',
    },
    {
        icon: <SocialYoutubeBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'YouTube',
        href: '#',
    },
    {
        icon: <SocialInstagramBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'Instagram',
        href: '#',
    },
    {
        icon: <SocialTiktokBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'TikTok',
        href: '#',
    },
    {
        icon: <SocialFacebookBrandIcon width={40} height={40} className='social-media-modal__icon' />,
        label: 'Facebook',
        href: '#',
    },
];

const SocialMediaModal = ({ is_open, toggleModal }: TSocialMediaModal) => {
    return (
        <Modal
            is_open={is_open}
            toggleModal={toggleModal}
            title='Follow Us'
            onReturn={toggleModal}
            small
            is_title_centered
        >
            <Modal.Body>
                <div className='social-media-modal__list'>
                    {socialMediaLinks.map((link, index) => (
                        <a
                            key={index}
                            href={link.href}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='social-media-modal__item'
                        >
                            {link.icon}
                            <Text size='sm' weight='bold' className='social-media-modal__text'>
                                {link.label}
                            </Text>
                        </a>
                    ))}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button primary large onClick={toggleModal}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SocialMediaModal;
