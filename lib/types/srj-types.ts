export type TraceId = string;

export interface SimpleRouteJson {
	layerCount: number;
	minTraceWidth: number;
	obstacles: Obstacle[];
	connections: Array<SimpleRouteConnection>;
	bounds: { minX: number; maxX: number; minY: number; maxY: number };
	traces?: SimplifiedPcbTraces;
}

export interface Obstacle {
	type: "rect";
	layers: string[];
	center: { x: number; y: number };
	width: number;
	height: number;
	connectedTo: TraceId[];
}

export interface SimpleRouteConnection {
	name: string;
	pointsToConnect: Array<{ x: number; y: number; layer: string }>;
}

export type SimplifiedPcbTraces = Array<{
	type: "pcb_trace";
	pcb_trace_id: TraceId;
	route: Array<
		| {
				route_type: "wire";
				x: number;
				y: number;
				width: number;
				layer: string;
		  }
		| {
				route_type: "via";
				x: number;
				y: number;
				to_layer: string;
				from_layer: string;
		  }
	>;
}>;
