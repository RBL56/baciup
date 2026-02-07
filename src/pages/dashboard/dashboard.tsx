import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import OnboardTourHandler from '../tutorials/dbot-tours/onboarding-tour';
import Announcements from './announcements';
import Cards from './cards';
import InfoPanel from './info-panel';

const Tutorial = React.lazy(() => import('../tutorials'));
const ChunkLoader = React.lazy(() => import('@/components/loader/chunk-loader'));

type TMobileIconGuide = {
    handleTabChange: (active_number: number) => void;
};

const DashboardComponent = observer(({ handleTabChange }: TMobileIconGuide) => {
    const { load_modal, dashboard, client } = useStore();
    const { dashboard_strategies } = load_modal;
    const { active_tab, active_tour } = dashboard;
    const has_dashboard_strategies = !!dashboard_strategies?.length;
    const { isDesktop, isTablet } = useDevice();

    const { is_tutorial_visible, setTutorialVisibility } = dashboard;

    return (
        <React.Fragment>
            <div
                className={classNames('tab__dashboard', {
                    'tab__dashboard--tour-active': active_tour,
                })}
            >
                <div className='tab__dashboard__content'>
                    {is_tutorial_visible ? (
                        <div className='dashboard__tutorial-container'>
                            <div className='dashboard__tutorial-header'>
                                <Text weight='bold'>{localize('Tutorials')}</Text>
                                <div className='dashboard__tutorial-close' onClick={() => setTutorialVisibility(false)}>
                                    <Text color='loss-dangerous' size='xs' weight='bold' className='dashboard__tutorial-close-btn'>
                                        {localize('Close')}
                                    </Text>
                                </div>
                            </div>
                            <React.Suspense fallback={<div>Loading...</div>}>
                                <Tutorial handleTabChange={handleTabChange} />
                            </React.Suspense>
                        </div>
                    ) : (
                        <>
                            {client.is_logged_in && (
                                <Announcements is_mobile={!isDesktop} is_tablet={isTablet} handleTabChange={handleTabChange} />
                            )}
                            <div className='quick-panel'>
                                <div
                                    className={classNames('tab__dashboard__header', {
                                        'tab__dashboard__header--listed': isDesktop && has_dashboard_strategies,
                                    })}
                                >
                                    {!has_dashboard_strategies && (
                                        <Text
                                            className='title'
                                            as='h2'
                                            color='prominent'
                                            size={isDesktop ? 'sm' : 's'}
                                            lineHeight='xxl'
                                            weight='bold'
                                        >
                                            {localize('Load or build your bot')}
                                        </Text>
                                    )}
                                    <Text
                                        as='p'
                                        color='prominent'
                                        lineHeight='s'
                                        size={isDesktop ? 's' : 'xxs'}
                                        className={classNames('subtitle', { 'subtitle__has-list': has_dashboard_strategies })}
                                    >
                                        {localize(
                                            'Import a bot from your computer or Google Drive, build it from scratch, or start with a quick strategy.'
                                        )}
                                    </Text>
                                </div>
                                <Cards has_dashboard_strategies={has_dashboard_strategies} is_mobile={!isDesktop} />
                            </div>
                        </>
                    )}
                </div>
            </div>
            <InfoPanel />
            {active_tab === 0 && <OnboardTourHandler is_mobile={!isDesktop} />}
        </React.Fragment>
    );
});

export default DashboardComponent;
