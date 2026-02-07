import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.over_under_analysis = {
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
                        [localize('Over'), 'OVER'],
                        [localize('Under'), 'UNDER'],
                        [localize('Equal'), 'EQUAL'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'THRESHOLD',
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
            tooltip: localize('Returns percentage of digits above/below specified threshold'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under Analysis'),
            description: localize('Returns percentage of digits above/below specified threshold'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_analysis = block => {
    const condition = block.getFieldValue('CONDITION');
    const threshold = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'THRESHOLD',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '4';
    const digitsCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGITS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1000';

    let conditionCode;
    switch (condition) {
        case 'OVER':
            conditionCode = `d > ${threshold}`;
            break;
        case 'UNDER':
            conditionCode = `d < ${threshold}`;
            break;
        case 'EQUAL':
            conditionCode = `d == ${threshold}`;
            break;
        default:
            conditionCode = `d > ${threshold}`;
    }

    const code = `(function() {
        var digits = Bot.getLastDigitList().slice(-${digitsCount});
        var count = 0;
        for (var i = 0; i < digits.length; i++) {
            var d = digits[i];
            if (${conditionCode}) {
                count++;
            }
        }
        return digits.length > 0 ? (count / digits.length) * 100 : 0;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
