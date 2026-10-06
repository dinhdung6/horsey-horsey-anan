// src/config/quality.ts
export const QUALITY_PRESETS = {
    low: {
        grassChunkRadius: 3,
        grassBladesPerChunk: 4000,
        bladeSegments: 1,
        pixelRatioCap: 1.0,
        shadowMapSize: 0,
        windLayers: 1,
        weatherParticles: 500,
        postProcessing: false,
        msaa: false,
    },
    medium: {
        grassChunkRadius: 5,
        grassBladesPerChunk: 5000,
        bladeSegments: 2,
        pixelRatioCap: 1.25,
        shadowMapSize: 1024,
        windLayers: 2,
        weatherParticles: 1500,
        postProcessing: false,
        msaa: true,
    },
    high: {
        grassChunkRadius: 7,
        grassBladesPerChunk: 5000,
        bladeSegments: 3,
        pixelRatioCap: 1.5,
        shadowMapSize: 2048,
        windLayers: 3,
        weatherParticles: 3000,
        postProcessing: true,
        msaa: true,
    },
    ultra: {
        grassChunkRadius: 9,
        grassBladesPerChunk: 6000,
        bladeSegments: 5,
        pixelRatioCap: 2.0,
        shadowMapSize: 4096,
        windLayers: 3,
        weatherParticles: 6000,
        postProcessing: true,
        msaa: true,
    },
};
// ponytail: bladeSegments is stored but not yet applied to grass geometry
// (all presets currently use a single-triangle blade). Wire it up when
// grass mesh builder supports multi-segment wind curves.
// postProcessing flag is reserved for bloom/vignette tone-mapping pipeline,
// which is not yet implemented.
