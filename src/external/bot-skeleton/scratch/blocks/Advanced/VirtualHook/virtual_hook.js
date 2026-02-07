import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.virtual_hook = {
    init() {
        this.jsonInit({
            message0: localize('Set Virtual Hook Settings %1 Enable Martingale %2 Martingale Factor %3 Max Steps %4 Min. Trades on Real %5 Take Profit %6 Stop Loss %7'),
            args0: [
                {
                    type: 'input_dummy',
                },
                {
                    type: 'field_dropdown',
                    name: 'ENABLE_MARTINGALE',
                    options: [
                        [localize('true'), 'true'],
                        [localize('false'), 'false'],
                    ],
                },
                {
                    type: 'field_number',
                    name: 'MARTINGALE_FACTOR',
                    value: 1.5,
                },
                {
                    type: 'field_number',
                    name: 'MAX_STEPS',
                    value: 3,
                },
                {
                    type: 'field_number',
                    name: 'MIN_TRADES',
                    value: 1,
                },
                {
                    type: 'field_number',
                    name: 'TAKE_PROFIT',
                    value: 5,
                },
                {
                    type: 'field_number',
                    name: 'STOP_LOSS',
                    value: 50,
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Virtual Hook Settings'),
            nextStatement: null,
            previousStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('Virtual Hook Settings'),
            description: localize('Configure settings for Virtual Hook.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.virtual_hook = block => {
    const enableMartingale = block.getFieldValue('ENABLE_MARTINGALE');
    const martingaleFactor = block.getFieldValue('MARTINGALE_FACTOR');
    const maxSteps = block.getFieldValue('MAX_STEPS');
    const minTrades = block.getFieldValue('MIN_TRADES');
    const takeProfit = block.getFieldValue('TAKE_PROFIT');
    const stopLoss = block.getFieldValue('STOP_LOSS');

    const code = `
    // Virtual Hook Settings
    var vh_settings = {
        enableMartingale: ${enableMartingale},
        martingaleFactor: ${martingaleFactor},
        maxSteps: ${maxSteps},
        minTrades: ${minTrades},
        takeProfit: ${takeProfit},
        stopLoss: ${stopLoss}
    };
    `;
    return code;
};

window.Blockly.Blocks.vh_token_authorizer = {
    init() {
        this.jsonInit({
            message0: localize('Authorize your VH token: %1'),
            args0: [
                {
                    type: 'field_input',
                    name: 'VH_TOKEN',
                    text: '--Token--',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Set and authorize your own custom VH token'),
            nextStatement: null,
            previousStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('VH Token Authorizer'),
            description: localize('Authorize your custom Virtual Hook token.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.vh_token_authorizer = block => {
    const token = block.getFieldValue('VH_TOKEN');
    return `var vh_token = '${token}';\n`;
};

window.Blockly.Blocks.vh_enabler = {
    init() {
        this.jsonInit({
            message0: localize('Enable/Disable VH %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'VH_STATUS',
                    options: [
                        [localize('enable'), 'enable'],
                        [localize('disable'), 'disable'],
                    ],
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Enable or Disable Virtual Hook'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('VH Enabler'),
            description: localize('Enable or disable Virtual Hook.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.vh_enabler = block => {
    const status = block.getFieldValue('VH_STATUS');
    return [`'${status}'`, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.vh_status = {
    init() {
        this.jsonInit({
            message0: localize('VirtualHook Status'),
            colour: '#e0e0e0',
            tooltip: localize('Returns if virtual hook is active or not'),
            output: null,
        });
    },
    meta() {
        return {
            display_name: localize('VH Status'),
            description: localize('Check if Virtual Hook is active.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.vh_status = block => {
    return ['vh_status', window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
