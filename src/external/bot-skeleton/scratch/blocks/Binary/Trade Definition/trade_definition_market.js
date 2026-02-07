import { localize } from '@deriv-com/translations';
import ApiHelpers from '../../../../services/api/api-helpers';
import DBotStore from '../../../dbot-store';
import { excludeOptionFromContextMenu, modifyContextMenu, runIrreversibleEvents } from '../../../utils';
/* eslint-disable */
window.Blockly.Blocks.trade_definition_market = {
    init() {
        this.jsonInit({
            message0: localize('Market: {{ input_market }} > {{ input_submarket }} > {{ input_symbol }} %4 Virtual Hook: %5', {
                input_market: '%1',
                input_submarket: '%2',
                input_symbol: '%3',
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'MARKET_LIST',
                    options: [['', '']],
                },
                {
                    type: 'field_dropdown',
                    name: 'SUBMARKET_LIST',
                    options: [['', '']],
                },
                {
                    type: 'field_dropdown',
                    name: 'SYMBOL_LIST',
                    options: [['', '']],
                },
                {
                    type: 'input_dummy',
                    name: 'VH_INPUT',
                },
                {
                    type: 'field_checkbox',
                    name: 'VIRTUAL_HOOK',
                    checked: false,
                },
            ],
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            previousStatement: null,
            nextStatement: null,
        });

        this.setMovable(false);
        this.setDeletable(false);

        const vh_input = this.getInput('VH_INPUT');
        if (vh_input) {
            const settings_icon = new window.Blockly.FieldImage(
                'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%2224%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224%22%20fill%3D%22%23FFA500%22%3E%3Cpath%20d%3D%22M370-80%20336-396q-30-9-58.5-24.5T224-458l-306%20130-100-174%20266-200q-2-20-2.5-40t.5-40l-266-200%20100-174%20306%20130q25-24%2053.5-39.5T336-890l34-310h200l34%20310q30%209%2058.5%2024.5T720-830l306-130%20100%20174-266%20200q2%2020%202.5%2040t-.5%2040l266%20200-100%20174-306-130q-25%2024-53.5%2039.5T604-396l-34%20316H370Zm112-260q75%200%20127.5-52.5T662-520q0-75-52.5-127.5T482-700q-75%200-127.5%2052.5T302-520q0%2075%2052.5%20127.5T482-340Z%22%2F%3E%3C%2Fsvg%3E',
                20,
                20,
                localize('Settings'),
                () => {
                    if (DBotStore.instance && DBotStore.instance.client) {
                        DBotStore.instance.client.setVirtualHookModalOpen(true);
                    }
                }
            );
            vh_input.appendField(settings_icon);
        }
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    onchange(event) {
        const allowed_events = ['BLOCK_CREATE', 'BLOCK_CHANGE', 'BLOCK_DRAG'];
        const is_allowed_event =
            allowed_events.findIndex(event_name => event.type === window.Blockly.Events[event_name]) !== -1;

        if (
            !this.workspace ||
            window.Blockly.derivWorkspace.isFlyoutVisible ||
            this.workspace.isDragging() ||
            !is_allowed_event
        ) {
            return;
        }

        this.enforceLimitations();

        const { active_symbols } = ApiHelpers?.instance ?? {};
        if (!active_symbols) return;

        const market_dropdown = this.getField('MARKET_LIST');
        const submarket_dropdown = this.getField('SUBMARKET_LIST');
        const symbol_dropdown = this.getField('SYMBOL_LIST');
        const market = market_dropdown.getValue();
        const submarket = submarket_dropdown.getValue();
        const symbol = symbol_dropdown.getValue();

        const market_options = active_symbols.getMarketDropdownOptions();

        const populateMarketDropdown = () => {
            market_dropdown?.updateOptions(market_options, {
                default_value: market,
                should_pretend_empty: true,
                event_group: event.group,
            });
        };

        if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) {
            populateMarketDropdown();
        } else if (event.type === window.Blockly.Events.BLOCK_CHANGE && event.blockId === this.id) {
            if (event.name === 'MARKET_LIST') {
                submarket_dropdown.updateOptions(active_symbols.getSubmarketDropdownOptions(market), {
                    default_value: submarket,
                    should_pretend_empty: true,
                    event_group: event.group,
                });
            } else if (event.name === 'SUBMARKET_LIST') {
                symbol_dropdown.updateOptions(active_symbols.getSymbolDropdownOptions(submarket), {
                    default_value: symbol,
                    should_pretend_empty: true,
                    event_group: event.group,
                });
            } else if (event.name === 'SYMBOL_LIST') {
                const new_symbol = symbol_dropdown.getValue();
                DBotStore.instance.dashboard.setBotBuilderSymbol(new_symbol);
            } else if (event.name === 'VIRTUAL_HOOK') {
                const is_checked = this.getFieldValue('VIRTUAL_HOOK') === 'TRUE';
                if (DBotStore.instance && DBotStore.instance.client) {
                    DBotStore.instance.client.setVirtualHookSettings({ is_enabled: is_checked });
                }
            }
        } else if (
            event.type === window.Blockly.Events.BLOCK_DRAG &&
            !event.isStart &&
            event.blockId === this.getRootBlock().id
        ) {
            if (market_dropdown.isEmpty() || submarket_dropdown.isEmpty() || symbol_dropdown.isEmpty()) {
                populateMarketDropdown();
            }
        }

        // Sync state on create
        if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) {
            if (DBotStore.instance && DBotStore.instance.client) {
                const is_checked = this.getFieldValue('VIRTUAL_HOOK') === 'TRUE';
                const settings = DBotStore.instance.client.virtual_hook_settings;

                // If XML has it, respect it. If XML lacks it, use store default.
                if (this.getField('VIRTUAL_HOOK') && settings) {
                    // Logic to avoid overwriting a previous user desire if the XML is old
                    const has_field_in_xml = event.xml.toString().includes('VIRTUAL_HOOK');
                    if (!has_field_in_xml && settings.is_enabled) {
                        this.setFieldValue('TRUE', 'VIRTUAL_HOOK');
                    } else {
                        DBotStore.instance.client.setVirtualHookSettings({ is_enabled: is_checked });
                    }
                }
            }
        }
    },
    enforceLimitations() {
        runIrreversibleEvents(() => {
            if (!this.isDescendantOf('trade_definition')) {
                this.unplug(false); // Unplug without reconnecting siblings

                const top_blocks = this.workspace.getTopBlocks();
                const trade_definition_block = top_blocks.find(block => block.type === 'trade_definition');

                // Reconnect self to trade definition block.
                if (trade_definition_block) {
                    const connection = trade_definition_block.getLastConnectionInStatement('TRADE_OPTIONS');
                    if (connection) {
                        connection.connect(this.previousConnection);
                    }
                } else {
                    this.dispose();
                }
            }
            // These blocks cannot be disabled.
            else if (this.disabled) {
                this.setDisabled(false);
            }
        });
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.trade_definition_market = () => { };

// Handle Click on VH Settings Label
document.addEventListener('click', (e) => {
    // Check if the clicked element or any parent has the 'vh-settings' class
    const target = e.target.closest('.vh-settings');

    if (target) {
        // We need to access the store to open the modal
        // Since this file is loaded in the browser context, we can try to access the window.DBotStore if available,
        // or import it if the bundler handles it. Since we imported DBotStore at the top, we can use it.
        if (DBotStore && DBotStore.instance && DBotStore.instance.client) {
            DBotStore.instance.client.setVirtualHookModalOpen(true);
        }
    }
});
