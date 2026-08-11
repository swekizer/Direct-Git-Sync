/* global AsyncIterable, AsyncIterableIterator -- Required for Obsidian and isomorphic-git types */
import { requestUrl, RequestUrlParam, RequestUrlResponse, Platform } from "obsidian";

type GitHttpParams = { url: string, method?: string, headers?: Record<string, string>, body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array> };
type GitHttpResponse = { url: string, method?: string, headers: Record<string, string>, body?: AsyncIterableIterator<Uint8Array>, statusCode: number, statusMessage: string };

// isomorphic-git/http/node may export a function (default) or an object with a .request method
interface NodeHttpModule {
    request?: (params: GitHttpParams) => Promise<GitHttpResponse>;
    default?: NodeHttpModule | ((params: GitHttpParams) => Promise<GitHttpResponse>);
}

export const obsidianHttpClient = {
    async request(params: GitHttpParams): Promise<GitHttpResponse> {
        // Use Node's streaming HTTP client on Desktop to avoid memory exhaustion (OOM crashes) on large repositories.
        // We must use Obsidian's requestUrl on mobile to bypass CORS, even though it buffers entirely in memory.
        if (Platform.isDesktop) {
            try {
                // Using dynamic import prevents esbuild from crashing the mobile plugin load
                const nodeHttp = (await import('isomorphic-git/http/node')) as NodeHttpModule;
                const httpClient = nodeHttp.default ?? nodeHttp;
                if (typeof httpClient === 'function') {
                    return await httpClient(params);
                } else if (typeof httpClient.request === 'function') {
                    return await httpClient.request(params);
                }
            } catch (e) {
                console.warn('Failed to load Node HTTP client, falling back to Obsidian requestUrl buffer', e);
            }
        }
        
        return await bufferedHttpClient.request(params);
    }
};

const bufferedHttpClient = {
    async request({ url, method, headers, body }: GitHttpParams): Promise<GitHttpResponse> {
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

        const response: RequestUrlResponse = await requestUrl(paramsToPass);

        return {
            url,
            method,
            headers: response.headers,
            body: (async function* () {
                // response.arrayBuffer is always a resolved ArrayBuffer in Obsidian's RequestUrlResponse
                yield new Uint8Array(response.arrayBuffer);
            })(),
            statusCode: response.status,
            statusMessage: String(response.status)
        };
    }
};
