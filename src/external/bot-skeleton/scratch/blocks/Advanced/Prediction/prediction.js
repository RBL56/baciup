import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.prediction_setter_v2 = {
    init() {
        this.jsonInit({
            message0: localize('set prediction to %1'),
            args0: [
                {
                    type: 'input_value',
                    name: 'PREDICTION_VALUE',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Changes the barrier of the bot (Prediction)'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('Prediction Setter V2'),
            description: localize('Changes the barrier of the bot (Prediction)'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.prediction_setter_v2 = block => {
    const value = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'PREDICTION_VALUE',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';
    return [`${value}`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.check_last_digits_equality = {
    init() {
        this.jsonInit({
            message0: localize('check if the last %1 digits are equal'),
            args0: [
                {
                    type: 'input_value',
                    name: 'DIGITS_COUNT',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('This block checks if the last set digits are equal'),
            output: 'Boolean',
        });
    },
    meta() {
        return {
            display_name: localize('Check Last Digits Equality'),
            description: localize('Checks if the last N digits are equal.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.check_last_digits_equality = block => {
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGITS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '1';

    // Logic to check last digits equality (placeholder logic)
    // In a real scenario, this would access the ticks history
    const code = `(function() { return true; /* Logic for checking last ${count} digits equality */ })()`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
