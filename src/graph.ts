import * as THREE from 'three';

export const NodeType = {
    Central: 0,
    Satellite: 1,
    Minion: 2
} as const;
export type NodeType = typeof NodeType[keyof typeof NodeType];

export interface GraphNode {
    id: number;
    type: NodeType;
    position: THREE.Vector3;
    basePosition: THREE.Vector3; // For drift return
    velocity: THREE.Vector3;
    size: number;
    connections: number[];
    color: THREE.Color;
    text: string;
}

export interface Edge {
    source: number;
    target: number;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: Edge[];
}

export const GRAPH_CONFIG = {
    satelliteCountMin: 8,
    satelliteCountMax: 20,
    satelliteDistanceSpread: 150,

    clusterSizeMin: 50,
    clusterSizeMax: 300,
    clusterSpread: 30,

    knnConnections: 3, // k = 3
    bridgeEdgesCount: 15,

    nodeSizes: {
        central: 6.0,
        satelliteMin: 2.0,
        satelliteMax: 4.0,
        minionMin: 0.2,
        minionMax: 1.0,
    }
};

function randomRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function randomPointInSphere(radius: number): THREE.Vector3 {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * radius;

    const sinPhi = Math.sin(phi);
    return new THREE.Vector3(
        r * sinPhi * Math.cos(theta),
        r * sinPhi * Math.sin(theta),
        r * Math.cos(phi)
    );
}

export function getRandomNodeColor(type: NodeType): THREE.Color {
    if (type === NodeType.Central) return new THREE.Color(0xff2266); // Neon pinkish red
    if (type === NodeType.Satellite) return new THREE.Color(0x00e5ff); // Cyan
    // Minions: mostly white, some pale blue
    return Math.random() > 0.8 ? new THREE.Color(0xffffff) : new THREE.Color(0xaaaaff);
}

export function generateGraph(): GraphData {
    const nodes: GraphNode[] = [];
    const edges: Edge[] = [];
    let nextId = 0;

    // 1. Central Hub
    const centralNode: GraphNode = {
        id: nextId++,
        type: NodeType.Central,
        position: new THREE.Vector3(0, 0, 0),
        basePosition: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(),
        size: GRAPH_CONFIG.nodeSizes.central,
        connections: [],
        color: getRandomNodeColor(NodeType.Central),
        text: "Global News Core Assembly"
    };
    nodes.push(centralNode);

    // Mock Data Arrays
    const outletNames = [
        "Galactic Wire", "Deep Space Dispatch", "Nebula Network", "Void Chronicles",
        "Pulsar Post", "Quantum Daily", "Orbit Observer", "Meteor Morning",
        "Stellar Standard", "Comet Courier", "Astro Gazette", "Eclipse Enquirer"
    ];

    const headlinePrefixes = [
        "Breaking: ", "Update: ", "Exclusive: ", "Report: ", "Analysis: ", "Live Data: ", "Alert: "
    ];
    const headlineTopics = [
        "market trends shifting in sector 4", "new elemental isotope discovered",
        "trade negotiations break down", "record solar flare activity recorded",
        "unidentified signal detected near outer rim", "local election results certified",
        "AI consciousness debate heats up", "quantum computing milestone reached",
        "historic peace treaty signed", "stock indices reach all-time high",
        "revolutionary engine prototype tested", "anomalous gravitational wave localized",
        "cyber security breach affects millions", "climate goals exceeded ahead of schedule"
    ];

    // 2. Satellite Hubs
    const numSatellites = Math.floor(randomRange(GRAPH_CONFIG.satelliteCountMin, GRAPH_CONFIG.satelliteCountMax + 1));
    const satelliteIndices: number[] = [];

    for (let i = 0; i < numSatellites; i++) {
        const pos = randomPointInSphere(GRAPH_CONFIG.satelliteDistanceSpread);
        // Push outwards a bit to avoid central occlusion
        if (pos.length() < GRAPH_CONFIG.satelliteDistanceSpread * 0.3) {
            pos.normalize().multiplyScalar(GRAPH_CONFIG.satelliteDistanceSpread * 0.3);
        }

        const outletName = outletNames[i % outletNames.length] + " " + Math.floor(randomRange(1, 99));
        const satellite: GraphNode = {
            id: nextId++,
            type: NodeType.Satellite,
            position: pos.clone(),
            basePosition: pos.clone(),
            velocity: new THREE.Vector3(),
            size: randomRange(GRAPH_CONFIG.nodeSizes.satelliteMin, GRAPH_CONFIG.nodeSizes.satelliteMax),
            connections: [],
            color: getRandomNodeColor(NodeType.Satellite),
            text: outletName
        };
        nodes.push(satellite);
        satelliteIndices.push(satellite.id);

        // Edge: Central -> Satellite
        edges.push({ source: centralNode.id, target: satellite.id });
        centralNode.connections.push(satellite.id);
        satellite.connections.push(centralNode.id);
    }

    // 3. Cluster Nodes
    const clusterNodeGroups: number[][] = []; // For bridge connections later

    for (const satId of satelliteIndices) {
        const satNode = nodes[satId];
        const numMinions = Math.floor(randomRange(GRAPH_CONFIG.clusterSizeMin, GRAPH_CONFIG.clusterSizeMax + 1));
        const clusterIndices: number[] = [satId]; // Include satellite in KNN calculation

        for (let j = 0; j < numMinions; j++) {
            // Gaussian-ish distance (more nodes closer to center)
            const dist = GRAPH_CONFIG.clusterSpread * Math.pow(Math.random(), 2);
            const localPos = randomPointInSphere(dist);
            const pos = satNode.position.clone().add(localPos);

            // Long tail size distribution: many small, few larger
            const szT = Math.pow(Math.random(), 4); // Skew towards 0
            const size = GRAPH_CONFIG.nodeSizes.minionMin + szT * (GRAPH_CONFIG.nodeSizes.minionMax - GRAPH_CONFIG.nodeSizes.minionMin);

            const prefix = headlinePrefixes[Math.floor(Math.random() * headlinePrefixes.length)];
            const topic = headlineTopics[Math.floor(Math.random() * headlineTopics.length)];
            const headline = `${prefix} ${topic}`;

            const minion: GraphNode = {
                id: nextId++,
                type: NodeType.Minion,
                position: pos.clone(),
                basePosition: pos.clone(),
                velocity: new THREE.Vector3(),
                size,
                connections: [],
                color: getRandomNodeColor(NodeType.Minion),
                text: headline
            };
            nodes.push(minion);
            clusterIndices.push(minion.id);
        }
        clusterNodeGroups.push(clusterIndices);

        // 4. K-Nearest Neighbors within Cluster
        // Very naive O(N^2) for each cluster, but cluster size is small (up to 300) so it's fine.
        for (let i = 0; i < clusterIndices.length; i++) {
            const nodeA = nodes[clusterIndices[i]];
            // Find distances to all others in cluster
            const distances: { id: number, dist: number }[] = [];
            for (let j = 0; j < clusterIndices.length; j++) {
                if (i === j) continue;
                const nodeB = nodes[clusterIndices[j]];
                distances.push({
                    id: nodeB.id,
                    dist: nodeA.position.distanceToSquared(nodeB.position)
                });
            }
            distances.sort((a, b) => a.dist - b.dist);

            // Connect to K nearest
            const k = GRAPH_CONFIG.knnConnections;
            let connectedCount = 0;
            for (const d of distances) {
                if (connectedCount >= k) break;
                // Avoid duplicate edges
                if (!nodeA.connections.includes(d.id)) {
                    edges.push({ source: nodeA.id, target: d.id });
                    nodeA.connections.push(d.id);
                    nodes[d.id].connections.push(nodeA.id);
                }
                connectedCount++;
            }
        }
    }

    // 5. Inter-cluster bridge edges
    for (let b = 0; b < GRAPH_CONFIG.bridgeEdgesCount; b++) {
        const c1 = Math.floor(Math.random() * clusterNodeGroups.length);
        let c2 = Math.floor(Math.random() * clusterNodeGroups.length);
        if (c1 === c2) c2 = (c2 + 1) % clusterNodeGroups.length;

        const group1 = clusterNodeGroups[c1];
        const group2 = clusterNodeGroups[c2];

        const n1 = nodes[group1[Math.floor(Math.random() * group1.length)]];
        const n2 = nodes[group2[Math.floor(Math.random() * group2.length)]];

        if (!n1.connections.includes(n2.id)) {
            edges.push({ source: n1.id, target: n2.id });
            n1.connections.push(n2.id);
            n2.connections.push(n1.id);
        }
    }

    return { nodes, edges };
}
