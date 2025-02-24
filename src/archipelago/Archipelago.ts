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
    loadedOptions: Record<string, number>,
): AllTypedOptions {
    const settings: Partial<Record<OptionsCommand, OptionValue>> =
        defaultSettings(optionDefs);
    settings['excluded-locations'] = [];
    for (const option of optionDefs) {
        const loadedVal = loadedOptions[kebabToSnake(option.command)];
        if (option.permalink !== false && loadedVal !== undefined) {
            if (option.type === 'boolean') {
                settings[option.command] = loadedVal === 1;
            } else if (option.type === 'int') {
                settings[option.command] = loadedVal;
            } else if (option.type === 'multichoice') {
                // shouldn't be possible
            } else if (option.type === 'singlechoice') {
                settings[option.command] = option.choices[loadedVal];
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
    public resolveLocations?: (locs: string[]) => void;
    public resolveItems?: (items: TrackerState['inventory']) => void;

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
            this.resolveLocations = undefined;
            this.resolveItems = undefined;
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
        // Create a new instance of the Client class.
        const client = new Client();

        /*
        // Set up an event listener for whenever a message arrives and print the plain-text content to the console.
        client.messages.on("message", (content) => {
            console.log(content);
        });
        */

        client.socket.on('connected', (content) => {
            this.connectedData = content;
            // console.log(content);
            setStoredArchipelagoServer(server);
            this.checkedLocations = [
                ...this.connectedData.checked_locations.map(
                    (location_id) => this.idToLocation![location_id],
                ),
            ];
            this.loadedSettings = optionIndicesToOptions(
                optionDefs,
                content.slot_data as Record<string, number>,
            );
            this.resolveLocations?.(this.checkedLocations);
        });

        client.socket.on('dataPackage', (content) => {
            this.idToLocation = invert<string, number>(
                content.data.games['Skyward Sword'].location_name_to_id,
            );
            this.idToItem = invert<string, number>(
                content.data.games['Skyward Sword'].item_name_to_id,
            );
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
