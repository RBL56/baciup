import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.contract_type_switcher = {
    init() {
        this.jsonInit({
            message0: localize('Current active contract %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'CONTRACT_SWITCHER_STATUS',
                    options: [
                        [localize('disable'), 'disable'],
                        [localize('enable'), 'enable'],
                    ],
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Makes your bot hybrid, allowing it to change to any contract type available'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('Contract Type Switcher'),
            description: localize('Allows the bot to switch contract types dynamically.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.contract_type_switcher = block => {
    const status = block.getFieldValue('CONTRACT_SWITCHER_STATUS');
    return [`'${status}'`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.custom_prediction_setter = {
    init() {
        this.jsonInit({
            message0: localize('set custom prediction %1'),
            args0: [
                {
                    type: 'field_number',
                    name: 'CUSTOM_PREDICTION',
                    value: 1,
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Set custom predictions on your contract type anywhere in the blocks'),
            previousStatement: null,
            nextStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('Custom Prediction Setter'),
            description: localize('Set custom predictions for contract types.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.custom_prediction_setter = block => {
    const prediction = block.getFieldValue('CUSTOM_PREDICTION');
    return `var custom_prediction = ${prediction};\n`;
};

window.Blockly.Blocks.market_symbol_changer = {
    init() {
        this.jsonInit({
            message0: localize('Symbol changer status %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'SYMBOL_CHANGER_STATUS',
                    options: [
                        [localize('disable'), 'disable'],
                        [localize('enable'), 'enable'],
                    ],
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('This block changes the current traded symbol'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('Market Symbol Changer'),
            description: localize('Dynamically change the traded market symbol.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.market_symbol_changer = block => {
    const status = block.getFieldValue('SYMBOL_CHANGER_STATUS');
    return [`'${status}'`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
