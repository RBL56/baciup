import { Analytics } from '@deriv-com/analytics';
import { ACTION, form_name } from './constants';

export const rudderStackSendTutorialSearchEvent = ({ search_term }: { search_term: string }) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.DASHBOARD_CLICK,
        form_name,
        subform_name: 'tutorials',
        subform_source: 'search',
        search_term,
    });
};

export const rudderStackSendSelectQsStrategyGuideEvent = ({ selected_strategy }: { selected_strategy: string }) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.SELECT_QUICK_STRATEGY_GUIDE,
        form_name,
        subform_name: 'tutorials',
        subform_source: 'quick_strategy_guides',
        strategy_name: selected_strategy,
    });
};
