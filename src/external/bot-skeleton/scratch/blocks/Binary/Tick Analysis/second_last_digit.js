import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.second_last_digit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Second Last Digit'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns the last digit of the previous tick'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Second Last Digit'),
            description: localize('This block gives you the last digit of the previous tick value.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.second_last_digit = () => [
    'Bot.getNthLastDigit(2)',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];
