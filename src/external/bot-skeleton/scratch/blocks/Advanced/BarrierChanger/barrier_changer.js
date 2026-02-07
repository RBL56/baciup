import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.barrier_changer_enabler = {
    init() {
        this.jsonInit({
            message0: localize('Barrier changer status %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'BARRIER_CHANGER_STATUS',
                    options: [
                        [localize('disable'), 'disable'],
                        [localize('enable'), 'enable'],
                    ],
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('This block Enable and Disable Touch/NoTouch offset changer feature.'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('Touch/NoTouch Offset Changer Enabler'),
            description: localize('Enable and Disable Touch/NoTouch offset changer feature.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.barrier_changer_enabler = block => {
    const status = block.getFieldValue('BARRIER_CHANGER_STATUS');
    return [`'${status}'`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.barrier_changer_value = {
    init() {
        this.jsonInit({
            message0: localize('Set barrier changer to: %1'),
            args0: [
                {
                    type: 'input_value',
                    name: 'BARRIER_VALUE',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Changes the offset of the a touch/notouch bot'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('Touch/NoTouch Barrier Changer'),
            description: localize('Changes the offset of the a touch/notouch bot'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.barrier_changer_value = block => {
    const value = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'BARRIER_VALUE',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';
    return [`${value}`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
