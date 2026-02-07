import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.last_digits_condition = {
    init() {
        this.jsonInit(this.definition());

        this.setOnChange(event => {
            if (event.name === 'CONDITION') {
                const condition = this.getFieldValue('CONDITION');
                const isAllCondition = ['EVEN', 'ODD', 'SAME'].includes(condition);
                this.updateShape(!isAllCondition);
            }
        });
    },
    definition() {
        return {
            message0: localize('Last %1 digits are %2 %3'),
            args0: [
                {
                    type: 'input_value',
                    name: 'DIGITS_COUNT',
                    check: 'Number',
                },
                {
                    type: 'field_dropdown',
                    name: 'CONDITION',
                    options: [
                        [localize('all even'), 'EVEN'],
                        [localize('all odd'), 'ODD'],
                        [localize('all same'), 'SAME'],
                        [localize('less than'), 'LT'],
                        [localize('greater than'), 'GT'],
                        [localize('less than or equal to'), 'LTE'],
                        [localize('greater than or equal to'), 'GTE'],
                    ],
                },
                {
                    type: 'input_dummy',
                    name: 'DIGIT_LABEL_DUMMY',
                },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Checks if the last N digits meet the specified condition'),
            category: window.Blockly.Categories.Analysis_Logics,
        };
    },
    domToMutation(xmlElement) {
        const hasDigitInput = xmlElement.getAttribute('digit_input') === 'true';
        this.updateShape(hasDigitInput);
    },
    mutationToDom() {
        const container = document.createElement('mutation');
        const condition = this.getFieldValue('CONDITION');
        const hasDigitInput = !['EVEN', 'ODD', 'SAME'].includes(condition);
        container.setAttribute('digit_input', hasDigitInput);
        return container;
    },
    updateShape(hasDigitInput) {
        const inputExists = this.getInput('DIGIT');
        const dummyInput = this.getInput('DIGIT_LABEL_DUMMY');

        if (hasDigitInput) {
            if (!inputExists) {
                if (dummyInput) {
                    dummyInput.appendField(new window.Blockly.FieldLabel(localize('digit')), 'DIGIT_LABEL');
                }
                this.appendValueInput('DIGIT').setCheck('Number');
                this.initSvg();
                this.renderEfficiently();
            }
        } else {
            if (inputExists) {
                if (dummyInput && dummyInput.fieldGroup_) {
                    dummyInput.removeField('DIGIT_LABEL');
                }
                this.removeInput('DIGIT');
                this.initSvg();
                this.renderEfficiently();
            }
        }
    },
    meta() {
        return {
            display_name: localize('Last Digits Condition'),
            description: localize('Checks if the last N digits meet the specified condition'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_digits_condition = block => {
    const digitsCount = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGITS_COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '3';
    const condition = block.getFieldValue('CONDITION');
    const digit = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGIT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';

    let conditionCode;
    switch (condition) {
        case 'EVEN':
            conditionCode = 'd % 2 === 0';
            break;
        case 'ODD':
            conditionCode = 'd % 2 !== 0';
            break;
        case 'SAME':
            conditionCode = 'd === digits[0]';
            break;
        case 'LT':
            conditionCode = `d < ${digit}`;
            break;
        case 'GT':
            conditionCode = `d > ${digit}`;
            break;
        case 'LTE':
            conditionCode = `d <= ${digit}`;
            break;
        case 'GTE':
            conditionCode = `d >= ${digit}`;
            break;
        case 'EQ':
            conditionCode = `d === ${digit}`;
            break;
        case 'NEQ':
            conditionCode = `d !== ${digit}`;
            break;
        default:
            conditionCode = `d < ${digit}`;
    }

    const code = `(function() {
        var digits = Bot.getLastDigitList().slice(-${digitsCount});
        var result = digits.length > 0 && digits.every(function(d) { return ${conditionCode}; });
        Bot.notify({
            className: 'journal__text--warn',
            message: '__ANALYSIS__' + JSON.stringify({
                type: 'analysis',
                market: Bot.getSymbolDisplayName(),
                condition: '${condition}',
                digit: ${digit},
                digits: digits,
                result: result
            }),
            sound: 'silent'
        });
        return result;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
