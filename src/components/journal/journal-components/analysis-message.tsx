import React from 'react';
import classnames from 'classnames';
import { Localize } from '@deriv-com/translations';
import { LabelPairedCircleCheckMdFillIcon, LabelPairedCircleXmarkMdFillIcon } from '@deriv/quill-icons/LabelPaired';

type TAnalysisData = {
    type: string;
    market?: string;
    condition: string;
    digits: number[];
    digit: number;
    result: boolean;
};

const AnalysisMessage = ({ data }: { data: TAnalysisData }) => {
    const { market = 'N/A', condition, digits, digit, result } = data;

    const getConditionText = () => {
        switch (condition) {
            case 'LT': return 'less than';
            case 'GT': return 'greater than';
            case 'EQ': return 'equal to';
            case 'NEQ': return 'not equal to';
            default: return condition;
        }
    };

    return (
        <div className='analysis-message'>
            <div className='analysis-message__header'>
                <Localize
                    i18n_default_text='Last Digits Analysis Market: {{market}} Condition: {{condition}} {{digit}} Digits: [{{digits}}] Result: '
                    values={{
                        market,
                        condition: getConditionText(),
                        digit,
                        digits: digits.join(', ')
                    }}
                />
                <span className={classnames('analysis-message__result', {
                    'analysis-message__result--true': result,
                    'analysis-message__result--false': !result,
                })}>
                    {result ? (
                        <>
                            <LabelPairedCircleCheckMdFillIcon fill='var(--status-success)' iconSize='sm' />
                            <Localize i18n_default_text='TRUE' />
                        </>
                    ) : (
                        <>
                            <LabelPairedCircleXmarkMdFillIcon fill='var(--status-danger)' iconSize='sm' />
                            <Localize i18n_default_text='FALSE' />
                        </>
                    )}
                </span>
            </div>
        </div>
    );
};

export default AnalysisMessage;
