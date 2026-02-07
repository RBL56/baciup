import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.last_n_ticks_direction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Last %1 ticks direction is %2'),
            args0: [
                {
                    type: 'input_value',
                    name: 'TICKS_COUNT',
                    check: 'Number',
                },
                {
                    type: 'field_dropdown',
                    name: 'DIRECTION',
                    options: [
                        [localize('Rise'), 'RISE'],
                        [localize('Fall'), 'FALL'],
                    ],
                },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Checks if the last N ticks are all rising or all falling'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Last N Ticks Direction'),
            description: localize('Checks if the last N ticks are all rising or all falling'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_n_ticks_direction = block => {
    const ticksCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'TICKS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';
    const direction = block.getFieldValue('DIRECTION');

    const code = `(function() {
        var ticks = Bot.getTicks().slice(-${ticksCount} - 1); // Get N+1 ticks to compare
        if (ticks.length < ${ticksCount} + 1) return false;
        
        var isAllMatching = true;
        // Iterate from the second tick (index 1) to the end
        // Compare each tick with the previous one
        for (var i = 1; i < ticks.length; i++) {
            if ('${direction}' === 'RISE' ? ticks[i] <= ticks[i-1] : ticks[i] >= ticks[i-1]) {
                isAllMatching = false;
                break;
            }
        }
        return isAllMatching;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
