import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.rise_fall_percentage = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('%1 % of last %2 ticks'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'DIRECTION',
                    options: [
                        [localize('Rise'), 'RISE'],
                        [localize('Fall'), 'FALL'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'TICKS_COUNT',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns percentage of rising or falling ticks from last N ticks'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    meta() {
        return {
            display_name: localize('Rise/Fall %'),
            description: localize('Returns percentage of rising or falling ticks from last N ticks'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rise_fall_percentage = block => {
    const direction = block.getFieldValue('DIRECTION');
    const ticksCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'TICKS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1000';

    const code = `(function() {
        var ticks = Bot.getTicks().slice(-${ticksCount} - 1);
        if (ticks.length < 2) return 0;
        
        var count = 0;
        var totalComparisons = ticks.length - 1;
        
        for (var i = 1; i < ticks.length; i++) {
            if ('${direction}' === 'RISE' ? ticks[i] > ticks[i-1] : ticks[i] < ticks[i-1]) {
                count++;
            }
        }
        return (count / totalComparisons) * 100;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
