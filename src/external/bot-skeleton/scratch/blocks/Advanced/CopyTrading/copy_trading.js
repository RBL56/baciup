import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.copy_trading_settings = {
    init() {
        this.jsonInit({
            message0: localize('Copy Trading Settings %1 Token %2 Max Stake % %3 Enable %4'),
            args0: [
                {
                    type: 'input_dummy',
                },
                {
                    type: 'field_input',
                    name: 'TOKEN',
                    text: 'Your Token',
                },
                {
                    type: 'field_number',
                    name: 'MAX_STAKE',
                    value: 10,
                    min: 0,
                    max: 100,
                },
                {
                    type: 'field_dropdown',
                    name: 'ENABLE',
                    options: [
                        [localize('True'), 'true'],
                        [localize('False'), 'false'],
                    ],
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Configure Copy Trading parameters.'),
            previousStatement: null,
            nextStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('Copy Trading Settings'),
            description: localize('Set up the token and parameters for copy trading.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.copy_trading_settings = block => {
    const token = block.getFieldValue('TOKEN');
    const max_stake = block.getFieldValue('MAX_STAKE');
    const enable = block.getFieldValue('ENABLE');

    const code = `
    var copy_trading_config = {
        token: '${token}',
        max_stake_percent: ${max_stake},
        enabled: ${enable}
    };
    `;
    return code;
};
