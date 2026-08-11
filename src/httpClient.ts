/* global AsyncIterable, AsyncIterableIterator -- Required for Obsidian and isomorphic-git types */
import { requestUrl, RequestUrlParam, Platform } from "obsidian";

export const obsidianHttpClient = {
    async request(params: { url: string, method?: string, headers?: Record<string, string>, body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array> }) {
        // Use Node's streaming HTTP client on Desktop to avoid memory exhaustion (OOM crashes) on large repositories.
        // We must use Obsidian's requestUrl on mobile to bypass CORS, even though it buffers entirely in memory.
        if (Platform.isDesktop) {
            try {
                // Using dynamic import prevents esbuild from crashing the mobile plugin load
                type RequestParams = { url: string, method?: string, headers?: Record<string, string>, body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array> };
                // isomorphic-git/http/node may export a function (default export) or an object with a `request` method.
                const nodeHttp = (await import('isomorphic-git/http/node')) as unknown;
                const httpClient = (nodeHttp && (nodeHttp as any).default) || nodeHttp;
                if (typeof httpClient === 'function') {
                    const result = await (httpClient as any)(params);
                    return result as { url: string, method?: string, headers: Record<string, string>, body?: AsyncIterableIterator<Uint8Array>, statusCode: number, statusMessage: string };
                } else if (httpClient && typeof (httpClient as any).request === 'function') {
                    const result = await (httpClient as any).request(params);
                    return result as { url: string, method?: string, headers: Record<string, string>, body?: AsyncIterableIterator<Uint8Array>, statusCode: number, statusMessage: string };
                }
            } catch (e) {
                console.warn('Failed to load Node HTTP client, falling back to Obsidian requestUrl buffer', e);
            }
        }
        
        return await bufferedHttpClient.request(params);
    }
};

const bufferedHttpClient = {
    async request({ url, method, headers, body }: { url: string, method?: string, headers?: Record<string, string>, body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array> }) {
        let requestBody: ArrayBuffer | undefined = undefined;
        
        if (body) {
            const chunks: Uint8Array[] = [];
            let totalLength = 0;
            
            // body is an AsyncIterable or Iterable
            for await (const chunk of body) {
                chunks.push(chunk);
                totalLength += chunk.length;
            }
            
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }
            requestBody = combined.buffer;
        }

        // Clean headers, Obsidian requestUrl sometimes rejects certain headers or needs them properly cased
        const cleanHeaders: Record<string, string> = {};
        if (headers) {
            for (const key of Object.keys(headers)) {
                if (headers[key]) {
                    cleanHeaders[key] = headers[key];
                }
            }
        }

        const paramsToPass: RequestUrlParam = {
            url,
            method: method || 'GET',
            headers: cleanHeaders,
            body: requestBody,
            throw: false // Don't throw on 4xx/5xx, return the response object
        };

        const response = await requestUrl(paramsToPass);

        return {
            url,
            method,
            headers: response.headers,
            body: (async function* () {
            // Ensure we await the arrayBuffer to obtain the bytes rather than yielding a function reference.
            if (typeof (response as any).arrayBuffer === 'function') {
                const buf = await (response as any).arrayBuffer();
                yield new Uint8Array(buf);
            } else if ((response as any).arrayBuffer) {
                // Some environments might already have a prepared ArrayBuffer
                yield new Uint8Array((response as any).arrayBuffer);
            }
        })(),
        statusCode: response.status,
        statusMessage: String(response.status)
        };
    }
};
