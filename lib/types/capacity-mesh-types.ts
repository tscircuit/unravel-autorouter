export type CapacityMeshNodeId = string;

export interface CapacityMesh {
	nodes: CapacityMeshNode[];
	edges: CapacityMeshEdge[];
}

export interface CapacityMeshNode {
	capacityMeshNodeId: string;
	center: { x: number; y: number };
	width: number;
	height: number;
	layer: string;
	totalCapacity: number;
}

export interface CapacityMeshEdge {
	capacityMeshEdgeId: string;
	nodeIds: [CapacityMeshNodeId, CapacityMeshNodeId];
}
