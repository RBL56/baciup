import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.even_odd_percentage = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('%1 % of last %2 digits'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'TYPE',
                    options: [
                        [localize('Even'), 'EVEN'],
                        [localize('Odd'), 'ODD'],
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
            tooltip: localize('Returns percentage of even or odd digits from last N ticks'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Even/Odd %'),
            description: localize('Returns percentage of even or odd digits from last N ticks'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_percentage = block => {
    const type = block.getFieldValue('TYPE');
    const digitsCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGITS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1000';

    const code = `(function() {
        var digits = Bot.getLastDigitList().slice(-${digitsCount});
        var count = 0;
        for (var i = 0; i < digits.length; i++) {
            var d = digits[i];
            if ('${type}' === 'EVEN' ? d % 2 === 0 : d % 2 !== 0) {
                count++;
            }
        }
        return digits.length > 0 ? (count / digits.length) * 100 : 0;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
