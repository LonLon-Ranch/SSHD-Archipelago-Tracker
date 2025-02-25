import { Client, type ConnectedPacket } from 'archipelago.js';
import { invert } from 'es-toolkit';
import { setStoredArchipelagoServer } from '../LocalStorage';
import { isItem, type InventoryItem } from '../logic/Inventory';
import {
    sothItemReplacement,
    triforceItemReplacement,
} from '../logic/TrackerModifications';
import { defaultSettings } from '../permalink/Settings';
import type {
    AllTypedOptions,
    OptionDefs,
    OptionsCommand,
    OptionValue,
} from '../permalink/SettingsTypes';
import type { TrackerState } from '../tracker/Slice';

function kebabToSnake(input: string): string {
    return input.replace(/-/g, '_');
}

function optionIndicesToOptions(
    optionDefs: OptionDefs,
    loadedOptions: Record<string, number | string[]>,
): AllTypedOptions {
    const settings: Partial<Record<OptionsCommand, OptionValue>> =
        defaultSettings(optionDefs);
    settings['excluded-locations'] = [];
    for (const option of optionDefs) {
        const loadedVal = loadedOptions[kebabToSnake(option.command)];
        if (option.permalink !== false && loadedVal !== undefined) {
            if (option.command === 'excluded-locations') {
                settings[option.command] = loadedVal;
            } else if (option.type === 'boolean') {
                settings[option.command] = loadedVal === 1;
            } else if (option.type === 'int') {
                settings[option.command] = loadedVal;
            } else if (option.type === 'multichoice') {
                // shouldn't be possible
            } else if (option.type === 'singlechoice') {
                settings[option.command] = option.choices[loadedVal as number];
            }
        }
    }
    return settings as AllTypedOptions;
}

export class APClientManager {
    client?: Client;
    serverName: string = '';
    slotName: string = '';
    loadedSettings?: AllTypedOptions;
    idToLocation?: Record<number, string>;
    idToItem?: Record<number, string>;
    connectedData?: ConnectedPacket;
    inventory: TrackerState['inventory'] = {};
    checkedLocations: string[] = [];
    messages: string[] = [];
    requiredDungeons: string[] = [];
    resolveLocations?: (locs: string[]) => void;
    resolveItems?: (items: TrackerState['inventory']) => void;
    changeStage?: (stage: string) => void;
    onMessage?: (messages: string[]) => void;

    add(item: InventoryItem, count: number = 1) {
        this.inventory[item] ??= 0;
        this.inventory[item] += count;
    }

    isHooked(): boolean {
        return this.client !== undefined && this.client.socket.connected;
    }

    getLoadedSettings(): AllTypedOptions | undefined {
        return this.loadedSettings;
    }

    setLocationCallback(func: (locs: string[]) => void) {
        this.resolveLocations = func;
        this.resolveLocations(this.checkedLocations);
    }

    setItemCallback(func: (items: TrackerState['inventory']) => void) {
        this.resolveItems = func;
        this.resolveItems(this.inventory);
    }

    setNewStageCallback(func: (stage: string) => void) {
        this.changeStage = func;
    }

    setOnMessage(func: (messages: string[]) => void) {
        this.onMessage = func;
        this.onMessage(this.messages);
    }

    sendMessage(message: string) {
        if (this.isHooked()) {
            this.client!.messages.say(message);
        }
    }

    getMessages(): string[] {
        return this.messages;
    }

    resetClient() {
        if (this.isHooked()) {
            this.client!.socket.disconnect();
            this.client = undefined;
            this.serverName = '';
            this.slotName = '';
            this.loadedSettings = undefined;
            this.connectedData = undefined;
            this.inventory = {};
            this.checkedLocations = [];
            this.messages = [];
            this.resolveLocations = undefined;
            this.resolveItems = undefined;
            this.changeStage = undefined;
        }
    }

    getServer(): string | undefined {
        return this.serverName;
    }

    getSlotName(): string | undefined {
        return this.slotName;
    }

    getStatusString(): string {
        if (this.isHooked()) {
            return `Connected to ${this.serverName} as ${this.slotName}`;
        }

        return 'Disconnected, please reconnect.';
    }

    async login(
        server: string,
        slot: string,
        optionDefs: OptionDefs,
    ): Promise<boolean> {
        const client = new Client();

        client.socket.on('connected', (content) => {
            this.connectedData = content;
            setStoredArchipelagoServer(server);
            const slotData = content.slot_data as Record<
                string,
                number | string[]
            >;
            this.checkedLocations = [
                ...this.connectedData.checked_locations.map(
                    (location_id) => this.idToLocation![location_id],
                ),
            ];
            this.loadedSettings = optionIndicesToOptions(optionDefs, slotData);
            this.resolveLocations?.(this.checkedLocations);
            this.requiredDungeons =
                (slotData['required_dungeons'] as string[]) ?? [];
            client.socket.send({
                cmd: 'GetDataPackage',
                games: ['Skyward Sword'],
            });
        });

        client.socket.on('dataPackage', (content) => {
            const ssData = content.data.games['Skyward Sword'];
            console.log(ssData);
            if (ssData !== undefined) {
                this.idToLocation = invert<string, number>(
                    ssData.location_name_to_id,
                );
                this.idToItem = invert<string, number>(ssData.item_name_to_id);
            }
        });

        client.messages.on('message', (content) => {
            this.messages.push(content.replace(/,/g, ''));
            this.onMessage?.(this.messages);
        });

        client.socket.on('receivedItems', (content) => {
            for (const netItem of content.items) {
                const item = this.idToItem![netItem.item];
                if (item.includes(sothItemReplacement)) {
                    this.add(sothItemReplacement);
                } else if (item.includes(triforceItemReplacement)) {
                    this.add(triforceItemReplacement);
                } else if (
                    isItem(item) &&
                    (!item.includes('Pouch') ||
                        !this.inventory['Progressive Pouch'])
                ) {
                    this.add(item);
                }
            }
            this.resolveItems?.(this.inventory);
        });

        client.socket.on('roomUpdate', (content) => {
            if (content.checked_locations) {
                this.checkedLocations.push(
                    ...content.checked_locations.map(
                        (location_id) => this.idToLocation![location_id],
                    ),
                );
            }
            this.resolveLocations?.(this.checkedLocations);
        });

        client.socket.on('bounced', (content) => {
            const stage = content.data?.ss_stage_name;
            if (stage !== undefined) {
                this.changeStage?.(stage as string);
            }
        });

        try {
            await client.login(server, slot, 'Skyward Sword', {
                tags: ['Tracker'],
            });
            this.client = client;
            this.serverName = server;
            this.slotName = slot;
            return true;
        } catch (error: unknown) {
            window.alert(error);
            return false;
        }
    }
}
