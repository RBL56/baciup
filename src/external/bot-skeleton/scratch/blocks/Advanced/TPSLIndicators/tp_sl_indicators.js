import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.loco_take_profit = {
    init() {
        this.jsonInit({
            message0: localize('Take Profit %1'),
            args0: [
                {
                    type: 'input_value',
                    name: 'AMOUNT',
                    check: 'Number',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Your bot is stopped automatically when your profit is more than or equals to your set take profit.'),
            previousStatement: null,
            nextStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('Take Profit'),
            description: localize('Stops the bot when profit reaches the set amount.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.loco_take_profit = block => {
    const amount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'AMOUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';

    // Logic to check take profit (placeholder, assumes global context references)
    // This logic ensures the block generates code that can be used in the bot loop
    const code = `
    if (typeof total_profit !== 'undefined' && total_profit >= ${amount}) {
        Bot.stop();
        Bot.notify({ className: 'journal__text--success', message: 'Take Profit Reached: ' + total_profit, sound: 'earned-money' });
    }
    `;
    return code;
};

window.Blockly.Blocks.loco_stop_loss = {
    init() {
        this.jsonInit({
            message0: localize('Stop Loss %1'),
            args0: [
                {
                    type: 'input_value',
                    name: 'AMOUNT',
                    check: 'Number',
                },
            ],
            colour: '#e0e0e0',
            tooltip: localize('Your bot is stopped automatically when your profit is less than or equals to your set stop loss.'),
            previousStatement: null,
            nextStatement: null,
        });
    },
    meta() {
        return {
            display_name: localize('Stop Loss'),
            description: localize('Stops the bot when loss reaches the set amount.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.loco_stop_loss = block => {
    const amount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'AMOUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';

    // Logic to check stop loss
    // Note: Stop loss usually implies negative profit, so we check if total_profit <= -amount (if amount is positive)
    // Or if the user inputs a negative number, check total_profit <= amount.
    // Standard behavior often expects positive input for SL.
    const code = `
    if (typeof total_profit !== 'undefined' && total_profit <= -${amount}) {
        Bot.stop();
        Bot.notify({ className: 'journal__text--error', message: 'Stop Loss Reached: ' + total_profit, sound: 'severe-error' });
    }
    `;
    return code;
};
