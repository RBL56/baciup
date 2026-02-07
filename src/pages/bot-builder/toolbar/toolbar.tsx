import React from 'react';
import { observer } from 'mobx-react-lite';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import ToggleSwitch from '@/components/shared_ui/toggle-switch';
import Text from '@/components/shared_ui/text';
import { rudderStackSendOpenEvent } from '../../../analytics/rudderstack-common-events';
import ToolbarButton from './toolbar-button';
import WorkspaceGroup from './workspace-group';

const Toolbar = observer(() => {
    const { run_panel, toolbar, quick_strategy } = useStore();
    const { isDesktop } = useDevice();
    const { is_dialog_open, closeResetDialog, onResetOkButtonClick: onOkButtonClick } = toolbar;
    const { is_running } = run_panel;
    const { setFormVisibility, is_turbo_mode, setTurboMode } = quick_strategy;
    const confirm_button_text = is_running ? localize('Yes') : localize('OK');
    const cancel_button_text = is_running ? localize('No') : localize('Cancel');
    const handleQuickStrategyOpen = () => {
        setFormVisibility(true);
        rudderStackSendOpenEvent({
            subpage_name: 'bot_builder',
            subform_source: 'bot_builder',
            subform_name: 'quick_strategy',
        });
    };
    return (
        <React.Fragment>
            <div className='toolbar dashboard__toolbar' data-testid='dt_dashboard_toolbar'>
                <div className='toolbar__section'>
                    {!isDesktop && (
                        <>
                            <ToolbarButton
                                popover_message={localize('Click here to start building your Deriv Bot.')}
                                button_id='db-toolbar__get-started-button'
                                button_classname='toolbar__btn toolbar__btn--icon toolbar__btn--start'
                                buttonOnClick={handleQuickStrategyOpen}
                                button_text={localize('Quick strategy')}
                                is_bot_running={is_running}
                            />
                            <div className='toolbar__turbo-mode'>
                                <div className='toolbar__turbo-mode__label'>
                                    <svg
                                        width='16'
                                        height='16'
                                        viewBox='0 0 16 16'
                                        fill='none'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path
                                            d='M9.33333 1.33334L2 9.33334H6.66667L6 14.6667L13.3333 6.66668H8.66667L9.33333 1.33334Z'
                                            fill='#FF00FF'
                                        />
                                    </svg>
                                    {localize('Every Tick (Turbo Mode)')}
                                </div>
                                <ToggleSwitch
                                    id='db-toolbar__turbo-mode-toggle'
                                    handleToggle={() => setTurboMode(!is_turbo_mode)}
                                    is_enabled={is_turbo_mode}
                                />
                            </div>
                        </>
                    )}



                    {isDesktop && <WorkspaceGroup />}
                </div>
            </div>
            {!isDesktop && <WorkspaceGroup />}
            <Dialog
                portal_element_id='modal_root'
                title={localize('Are you sure?')}
                is_visible={is_dialog_open}
                confirm_button_text={confirm_button_text}
                onConfirm={onOkButtonClick}
                cancel_button_text={cancel_button_text}
                onCancel={closeResetDialog}
                is_mobile_full_width={false}
                className={'toolbar__dialog'}
                has_close_icon
            >
                {is_running ? (
                    <Localize
                        i18n_default_text='The workspace will be reset to the default strategy and any unsaved changes will be lost. <0>Note: This will not affect your running bot.</0>'
                        components={[
                            <div
                                key={0}
                                className='toolbar__dialog-text--second'
                                data-testid='dt_toolbar_dialog_text_second'
                            />,
                        ]}
                    />
                ) : (
                    <Localize i18n_default_text='Any unsaved changes will be lost.' />
                )}
            </Dialog>

        </React.Fragment>
    );
});

export default Toolbar;
