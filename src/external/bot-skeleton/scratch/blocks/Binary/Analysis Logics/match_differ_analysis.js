import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.match_differ_analysis = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('%1 %2 % in last %3 ticks'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'CONDITION',
                    options: [
                        [localize('Match'), 'MATCH'],
                        [localize('Differ'), 'DIFFER'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'DIGIT',
                    check: 'Number',
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
            tooltip: localize('Returns percentage of digits matching or differing from specified value'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Match/Differ Analysis'),
            description: localize('Returns percentage of digits matching or differing from specified value'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.match_differ_analysis = block => {
    const condition = block.getFieldValue('CONDITION');
    const digit = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGIT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';
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
            if ('${condition}' === 'MATCH' ? d == ${digit} : d != ${digit}) {
                count++;
            }
        }
        return digits.length > 0 ? (count / digits.length) * 100 : 0;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
