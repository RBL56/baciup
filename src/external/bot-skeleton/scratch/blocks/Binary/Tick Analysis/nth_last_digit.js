import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.nth_last_digit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Get the %1 last digit'),
            args0: [
                {
                    type: 'input_value',
                    name: 'NTH_TICK',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns the last digit of the Nth previous tick'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Nth Last Digit'),
            description: localize('This block gives you the last digit of the Nth previous tick value.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.nth_last_digit = block => {
    const nthTick = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'NTH_TICK',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1';

    const code = `Bot.getNthLastDigit(${nthTick})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
