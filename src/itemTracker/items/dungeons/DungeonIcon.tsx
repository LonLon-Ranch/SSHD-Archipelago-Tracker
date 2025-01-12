import clsx from 'clsx';
import {
    draggableToRegionHint,
    useDroppable,
} from '../../../dragAndDrop/DragAndDrop';
import keyDownWrapper from '../../../utils/KeyDownWrapper';
import styles from './DungeonIcon.module.css';

type DungeonIconProps = {
    image: string;
    iconLabel: string;
    width?: number;
    groupClicked: (group: string) => void;
    area: string;
};
const DungeonIcon = (props: DungeonIconProps) => {
    const { image, iconLabel, width, groupClicked, area } = props;

    const onClick = () => {
        groupClicked(area);
    };

    const { setNodeRef, active, isOver } = useDroppable({
        type: 'hintRegion',
        hintRegion: area,
    });

    const dragPreviewHint = active && draggableToRegionHint(active);
    const canDrop = Boolean(dragPreviewHint);

    return (
        <div
            ref={setNodeRef}
            className={clsx({
                [styles.droppable]: canDrop,
                [styles.droppableHover]: canDrop && isOver,
            })}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={keyDownWrapper(onClick)}
            style={{ ...(width ? {} : { width: '100%' }) }}
        >
            <img
                src={image}
                alt={iconLabel}
                width={width}
                style={{ ...(width ? {} : { width: '100%' }) }}
            />
        </div>
    );
};

export default DungeonIcon;
