import React from 'react';
import classNames from 'classnames';
import { Field, useFormikContext } from 'formik';
import Popover from '@/components/shared_ui/popover';
import Text from '@/components/shared_ui/text';
import ToggleSwitch from '@/components/shared_ui/toggle-switch';
import { localize } from '@deriv-com/translations';
import { TFormData } from '../types';

type TQSToggleSwitch = {
    name: string;
    label: string;
    description?: string;
    attached?: boolean;
    isEnabledToggleSwitch: boolean;
    setIsEnabledToggleSwitch: () => void;
    icon?: string;
    hide_optional?: boolean;
};

const QSToggleSwitch: React.FC<TQSToggleSwitch> = ({
    name,
    label,
    description,
    attached = false,
    isEnabledToggleSwitch,
    setIsEnabledToggleSwitch,
    icon,
    hide_optional = false,
}) => {
    const { values, setFieldValue } = useFormikContext<TFormData>();

    const handleChange = async () => {
        setIsEnabledToggleSwitch();
        await setFieldValue(name, !values?.[name], true);
        await setFieldValue('max_stake', values?.max_stake, true);
    };

    return (
        <Field name={name}>
            {() => {
                return (
                    <div
                        className={classNames('qs__form__field qs__form__field__input', {
                            'no-border-bottom-radius': attached,
                        })}
                    >
                        <div className='qs__checkbox'>
                            <div className='qs__checkbox__container'>
                                <label className='dc-checkbox'>
                                    {icon === 'lightning' && (
                                        <svg
                                            width='16'
                                            height='16'
                                            viewBox='0 0 16 16'
                                            fill='none'
                                            xmlns='http://www.w3.org/2000/svg'
                                            style={{ marginRight: '8px' }}
                                        >
                                            <path
                                                d='M9.33333 1.33334L2 9.33334H6.66667L6 14.6667L13.3333 6.66668H8.66667L9.33333 1.33334Z'
                                                fill='#FF8C40'
                                            />
                                        </svg>
                                    )}
                                    <Text size='xs' weight='bold' className='dc-checkbox__label'>
                                        {label}
                                    </Text>
                                    {!hide_optional && <Text size='xs'>{localize('(optional)')}</Text>}
                                </label>
                                {!hide_optional && (
                                    <span>
                                        <Popover
                                            classNameTargetIcon='qs__checkbox__info'
                                            message={description}
                                            zIndex='9999'
                                            alignment='top'
                                            icon='info'
                                        />
                                    </span>
                                )}
                                <ToggleSwitch
                                    id='dt_mobile_drawer_theme_toggler'
                                    handleToggle={handleChange}
                                    is_enabled={isEnabledToggleSwitch}
                                    data-testid='qs-toggle-switch'
                                />
                            </div>
                        </div>
                    </div>
                );
            }}
        </Field>
    );
};

export default QSToggleSwitch;
