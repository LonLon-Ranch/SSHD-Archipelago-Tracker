import {
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    pointerWithin,
    useDraggable as useDraggableDndKit,
    useDroppable as useDroppableDndKit,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { useCallback, useId, useState } from 'react';
import { useDispatch } from 'react-redux';
import { dungeonToPathImage, type Hint } from '../hints/Hints';
import { findRepresentativeIcon } from '../itemTracker/Images';
import type { InventoryItem } from '../logic/Inventory';
import { type DungeonName, dungeonNames } from '../logic/Locations';
import { setCheckHint, setHint } from '../tracker/Slice';

export type TrackerDraggable =
    | {
          type: 'item';
          item: InventoryItem;
      }
    | {
          type: 'requiredDungeon';
          dungeon: DungeonName;
      };

export type TrackerDroppable =
    | {
          type: 'location';
          checkId: string;
      }
    | {
          type: 'hintRegion';
          hintRegion: string;
      };

export function useDraggable(data: TrackerDraggable, disabled = false) {
    const id = useId();
    const { listeners, setNodeRef } = useDraggableDndKit({
        id,
        data,
        disabled,
    });

    return { listeners, setNodeRef };
}

export function useDroppable(data: TrackerDroppable, disabled = false) {
    const id = useId();
    const { active, isOver, setNodeRef } = useDroppableDndKit({
        id,
        data,
        disabled,
    });

    return {
        isOver,
        setNodeRef,
        active:
            (active && (active.data.current as TrackerDraggable)) ?? undefined,
    };
}

export function draggableToRegionHint(draggable: TrackerDraggable): Hint {
    switch (draggable.type) {
        case 'item': {
            return {
                type: 'item',
                item: draggable.item,
            };
        }
        case 'requiredDungeon': {
            return {
                type: 'path',
                index: dungeonNames.indexOf(draggable.dungeon),
            };
        }
    }
}

export function DragAndDropContext({
    children,
}: {
    children: React.ReactNode;
}) {
    const dispatch = useDispatch();
    const [draggingItem, setDraggingItem] = useState<string | undefined>();
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const item = event.active.data.current as TrackerDraggable;
        if (item.type === 'item') {
            setDraggingItem(findRepresentativeIcon(item.item));
        } else if (item.type === 'requiredDungeon') {
            setDraggingItem(dungeonToPathImage[item.dungeon]);
        }
    }, []);
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const item = event.active.data.current as TrackerDraggable;
            const location =
                event.over && (event.over.data.current as TrackerDroppable);
            if (location?.type === 'hintRegion') {
                const hint = draggableToRegionHint(item);
                if (hint) {
                    dispatch(
                        setHint({
                            areaId: location.hintRegion,
                            hint,
                        }),
                    );
                }
            }
            if (item.type === 'item' && location?.type === 'location') {
                dispatch(
                    setCheckHint({
                        checkId: location.checkId,
                        hint: item.item,
                    }),
                );
            }
            setDraggingItem(undefined);
        },
        [dispatch],
    );
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
    );
    return (
        <DndContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            collisionDetection={pointerWithin}
        >
            {children}
            <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                <div style={{ position: 'relative', width: 72, height: 72 }}>
                    {draggingItem ? (
                        <img
                            src={draggingItem}
                            style={{
                                position: 'absolute',
                                transform: 'translate(36px, 36px)',
                            }}
                            width={72}
                        />
                    ) : undefined}
                </div>
            </DragOverlay>
        </DndContext>
    );
}
