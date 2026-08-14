// src/llm.js
// Carga en memoria (singleton) el modelo local Gemma 2 2B usando node-llama-cpp.
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getLlama } from 'node-llama-cpp';

const MODEL_REL = 'models/gemma-2-2b-it-q4_k_m/gemma-2-2b-it-q4_k_m.gguf';

let modelPromise = null;
let llamaPromise = null;

function resolveModelPath() {
    const candidates = [
        resolve(process.cwd(), MODEL_REL),
        resolve(process.cwd(), '..', MODEL_REL)
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(
        `Modelo no encontrado. Busqué en: ${candidates.join(', ')}`
    );
}

export function getLlamaInstance() {
    if (!llamaPromise) {
        llamaPromise = getLlama();
    }
    return llamaPromise;
}

export function getModel() {
    if (!modelPromise) {
        modelPromise = (async () => {
            const llama = await getLlamaInstance();
            return await llama.loadModel({
                modelPath: resolveModelPath(),
                gpuLayers: 0
            });
        })();
    }
    return modelPromise;
}
