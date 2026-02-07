import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_frequency_analysis = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('%1 frequent digit from last %2 digits'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'CONDITION',
                    options: [
                        [localize('Most'), 'MOST'],
                        [localize('Least'), 'LEAST'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'DIGITS_COUNT',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Finds frequency patterns in last N digits'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Frequency Analysis'),
            description: localize('Finds frequency patterns in last N digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_frequency_analysis = block => {
    const condition = block.getFieldValue('CONDITION');
    const digitsCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGITS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1000';

    const code = `(function() {
        var digits = Bot.getLastDigitList().slice(-${digitsCount});
        var frequencies = {};
        for (var i = 0; i < digits.length; i++) {
            var d = digits[i];
            frequencies[d] = (frequencies[d] || 0) + 1;
        }
        var targetDigit = digits[0];
        var targetFreq = frequencies[targetDigit] || 0;
        
        for (var d in frequencies) {
            var freq = frequencies[d];
            if ('${condition}' === 'MOST' ? freq > targetFreq : freq < targetFreq) {
                targetFreq = freq;
                targetDigit = Number(d);
            }
        }
        return targetDigit;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
