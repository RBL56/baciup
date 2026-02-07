import React, { useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { load, save_types } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { LabelPairedCircleCheckMdFillIcon } from '@deriv/quill-icons/LabelPaired';
import { StandaloneStarFillIcon } from '@deriv/quill-icons/Standalone';
import { localize } from '@deriv-com/translations';
import { Text } from '@deriv-com/ui';
import { FREE_BOTS, TBotConfig } from './bots-config';
import './free-bots.scss';

const FreeBots = () => {
    const { dashboard } = useStore();
    const { setActiveTab } = dashboard;
    const [loading_bot_id, setLoadingBotId] = useState<string | null>(null);
    const [loaded_bot_id, setLoadedBotId] = useState<string | null>(null);

    const handleLoadBot = async (bot: TBotConfig) => {
        setLoadingBotId(bot.id);
        try {
            await load({
                block_string: bot.xml,
                file_name: bot.name,
                workspace: window.Blockly?.derivWorkspace,
                from: save_types.UNSAVED,
                drop_event: null,
                strategy_id: null,
                showIncompatibleStrategyDialog: null,
            });
            setLoadedBotId(bot.id);

            // Navigate to Bot Builder tab after successful load
            setTimeout(() => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                setLoadedBotId(null);
            }, 500);
        } catch (error) {
            console.error('Error loading bot:', error);
            setLoadingBotId(null);
        } finally {
            setTimeout(() => {
                setLoadingBotId(null);
            }, 500);
        }
    };

    return (
        <div className='free-bots'>
            <div className='free-bots__content'>
                <div className='free-bots__grid'>
                    {FREE_BOTS.map(bot => (
                        <div key={bot.id} className='free-bots__card'>
                            <div className='free-bots__card-badge'>FREE</div>

                            <div className='free-bots__card-header'>
                                <div className='free-bots__card-icon'>🤖</div>
                                <Text size='md' weight='bold' className='free-bots__card-title'>
                                    {bot.name}
                                </Text>
                            </div>

                            <div className='free-bots__card-rating'>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <StandaloneStarFillIcon key={star} fill='#FFD700' iconSize='sm' />
                                ))}
                            </div>

                            <div className='free-bots__card-badges'>
                                <span className='free-bots__badge free-bots__badge--category'>
                                    {bot.category?.toUpperCase() || 'STRATEGY'}
                                </span>
                            </div>

                            <button
                                className={`free-bots__load-button ${loading_bot_id === bot.id ? 'free-bots__load-button--loading' : ''} ${loaded_bot_id === bot.id ? 'free-bots__load-button--loaded' : ''}`}
                                onClick={() => handleLoadBot(bot)}
                                disabled={loading_bot_id === bot.id}
                            >
                                {loading_bot_id === bot.id ? (
                                    localize('LOADING...')
                                ) : loaded_bot_id === bot.id ? (
                                    <>
                                        <LabelPairedCircleCheckMdFillIcon fill='#fff' />
                                        {localize('LOADED!')}
                                    </>
                                ) : (
                                    localize('LOAD BOT')
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FreeBots;
