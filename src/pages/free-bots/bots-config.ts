import locofxv2megamindXml from '@/xml/LOCOFX V2 MEGAMIND.xml';
import locospeedbotXml from '@/xml/locospeedbot.xml';
import locoV15Xml from '@/xml/LOCO V1.5.xml';
import locoSpeedBotEntryXml from '@/xml/LOCO SPEED BOT WITH ENTRY .xml';
import entryPointBotOver2Xml from '@/xml/_Entry point Bot over 2.xml';
import unstoppableDifferBotXml from '@/xml/UNSTOPPABLE DIFFER BOT.xml';
import overUnderAutoSwitcherXml from '@/xml/OVER UNDER AUTO SWITCHER.xml';
import under3BotXml from '@/xml/UNDER 3 BOT.xml';
export type TBotConfig = {
    id: string;
    name: string;
    description: string;
    xml: string;
    category?: string;
};

export const FREE_BOTS: TBotConfig[] = [
    {
        id: 'locofx_v2_megamind',
        name: 'LOCOFX V2 MEGAMIND',
        description: 'Advanced automated trading strategy',
        xml: locofxv2megamindXml,
        category: 'Progressive',
    },
    {
        id: 'locospeedbot',
        name: 'LOCOSPEEDBOT',
        description: 'Advanced automated trading strategy',
        xml: locospeedbotXml,
        category: 'Progressive',
    },
    {
        id: 'loco_v1_5',
        name: 'LOCO V1.5',
        description: 'Updated LOCO strategy for better performance',
        xml: locoV15Xml,
        category: 'Progressive',
    },
    {
        id: 'loco_speed_bot_entry',
        name: 'LOCO SPEED BOT WITH ENTRY',
        description: 'Fast trading bot with specific entry points',
        xml: locoSpeedBotEntryXml,
        category: 'Progressive',
    },
    {
        id: 'entry_point_bot_over_2',
        name: 'Entry point Bot over 2',
        description: 'Strategy focused on over 2 predictions',
        xml: entryPointBotOver2Xml,
        category: 'Progressive',
    },
    {
        id: 'unstoppable_differ_bot',
        name: 'UNSTOPPABLE DIFFER BOT',
        description: 'High-performance differ strategy',
        xml: unstoppableDifferBotXml,
        category: 'Automatic',
    },
    {
        id: 'over_under_auto_switcher',
        name: 'OVER UNDER AUTO SWITCHER',
        description: 'Automatic switching between Over and Under contracts',
        xml: overUnderAutoSwitcherXml,
        category: 'Automatic',
    },
    {
        id: 'under_3_bot',
        name: 'UNDER 3 V1 FAST',
        description: 'Strategy focused on under 3 predictions',
        xml: under3BotXml,
        category: 'Automatic',
    },
];
