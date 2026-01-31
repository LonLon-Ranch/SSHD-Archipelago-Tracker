import mapDataSS from '../../data/mapData.json';
import mapDataSSHD from '../../data/mapData_SSHD.json';
import type { ExitMapping } from '../../logic/Locations';
import type { AreaGraph } from '../../logic/Logic';

// Use SSHD map data by default
const mapData = mapDataSSHD;

export type MapHintRegion = {
    /**
     * The hint region behind this map node.
     * Uses the bound dungeon/silent realm for exits.
     */
    hintRegion: string | undefined;
    markerX: number;
    markerY: number;
    supmarkerPlacement: 'left' | 'right';
} & (
    | { type: 'hint_region' }
    | {
          type: 'exit';
          exitPool: keyof AreaGraph['linkedEntrancePools'];
          exitId: string;
      }
);

export interface MapProvince {
    provinceId:
        | 'skyloftSubmap'
        | 'faronSubmap'
        | 'eldinSubmap'
        | 'lanayruSubmap'
        | 'sky'
        | 'silentRealms'
        | 'specialAreas';
    name: string;
    regions: MapHintRegion[];
}

/** A resolved map model for the tracker, to simplify common map operations */
export interface MapModel {
    provinces: MapProvince[];
    regions: MapHintRegion[];
}

type MapDataMarker = (typeof mapData)[keyof typeof mapData] extends { markers?: infer M[] }
    ? M[number]
    : (typeof mapData)['sky' | 'thunderhead'];

function getMarker(marker: any): MapHintRegion {
    return {
        type: 'hint_region',
        markerX: marker.markerX,
        markerY: marker.markerY,
        hintRegion: marker.region,
        supmarkerPlacement:
            'submarkerPlacement' in marker &&
            marker.submarkerPlacement === 'left'
                ? 'left'
                : 'right',
    };
}

type MapDataEntranceMarker =
    (typeof mapData)['eldinSubmap']['entranceMarkers'][number];

function getEntranceMarker(
    marker: MapDataEntranceMarker,
    areaGraph: AreaGraph,
    exits: Record<string, ExitMapping>,
): MapHintRegion | null {
    const exitPool = marker.exitPool as keyof AreaGraph['linkedEntrancePools'];
    
    // Check if the entrance exists in the area graph
    if (!areaGraph.linkedEntrancePools[exitPool]?.[marker.entryName]) {
        // Entrance not found in this area graph - return null to skip
        return null;
    }
    
    const exitId =
        areaGraph.linkedEntrancePools[exitPool][marker.entryName].exits[0];
    const mapping = exits[exitId];
    return {
        type: 'exit',
        exitPool,
        exitId,
        markerX: marker.markerX,
        markerY: marker.markerY,
        supmarkerPlacement:
            marker.submarkerPlacement === 'left' ? 'left' : 'right',
        hintRegion: mapping?.entrance?.region,
    };
}

function getProvince(
    provinceId: MapProvince['provinceId'],
    areaGraph: AreaGraph,
    exits: Record<string, ExitMapping>,
): MapProvince {
    const province = (mapData as any)[provinceId];
    
    if (!province) {
        return {
            provinceId,
            name: provinceId,
            regions: [],
        };
    }

    const regions: MapHintRegion[] = [];

    // Handle markers (regions without exits)
    if ('markers' in province && province.markers) {
        regions.push(...province.markers.map(getMarker));
    }

    // Handle islandMarkers (for sky islands)
    if ('islandMarkers' in province && province.islandMarkers) {
        regions.push(...province.islandMarkers.map(getMarker));
    }

    // Handle entranceMarkers (dungeons)
    if ('entranceMarkers' in province && province.entranceMarkers) {
        const getEntrance = (m: any) =>
            getEntranceMarker(m, areaGraph, exits);
        regions.push(
            ...province.entranceMarkers
                .map(getEntrance)
                .filter((region): region is MapHintRegion => region !== null),
        );
    }

    return {
        provinceId,
        name: province.name || provinceId,
        regions,
    };
}

type ProvinceResult =
    | {
          type: 'ok';
          result: string | undefined;
      }
    | {
          type: 'err';
      };

/** For a given hint region, get the owning map view. */
export function getOwningProvince(
    model: MapModel,
    hintRegion: string,
): ProvinceResult {
    for (const region of model.regions) {
        if (region.hintRegion === hintRegion) {
            return { type: 'ok', result: undefined };
        }
    }

    for (const province of model.provinces) {
        for (const region of province.regions) {
            if (region.hintRegion === hintRegion) {
                return { type: 'ok', result: province.provinceId };
            }
        }
    }

    return { type: 'err' };
}

export function getMapModel(
    areaGraph: AreaGraph,
    exits: Record<string, ExitMapping>,
): MapModel {
    const provinces = [
        getProvince('skyloftSubmap', areaGraph, exits),
        getProvince('faronSubmap', areaGraph, exits),
        getProvince('eldinSubmap', areaGraph, exits),
        getProvince('lanayruSubmap', areaGraph, exits),
        getProvince('sky', areaGraph, exits),
        getProvince('silentRealms', areaGraph, exits),
        getProvince('specialAreas', areaGraph, exits),
    ].filter((p) => p.regions.length > 0);

    // Get special standalone regions (thunderhead, etc.)
    const standaloneRegions: MapHintRegion[] = [];
    const thunderhead = (mapData as any).thunderhead;
    const skyKeep = (mapData as any).skyKeep;

    if (thunderhead) {
        standaloneRegions.push(getMarker(thunderhead));
    }
    if (skyKeep) {
        standaloneRegions.push(getMarker(skyKeep));
    }

    return {
        provinces,
        regions: standaloneRegions,
    };
}
