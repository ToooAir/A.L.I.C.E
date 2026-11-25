'use strict';
// Mistral official API (https://api.mistral.ai) via plain fetch.
// chat config: {provider: 'mistral', apiKey, model, temperature?, requestsPerSecond?, tokensPerMinute?, baseUrl?}
//
// All requests from this process go through one queue that respects the account's limits
// (requests per second and tokens per minute), and 429/5xx responses are retried after a pause.

const DEFAULT_URL = 'https://api.mistral.ai';
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const MINUTE = 60000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Rough token estimate before sending: CJK characters count about one token each, other text about four characters per token.
function estimateTokens(text){
    const cjk = (text.match(/[　-鿿＀-￯]/g) ?? []).length;
    return Math.ceil(cjk + (text.length - cjk) / 4);
}

// Neutral messages -> Mistral messages. Consecutive user messages are merged into one.
function toMistralMessages(system, messages){
    const out = [{role: 'system', content: system}];
    for(const m of messages){
        const last = out.at(-1);
        if(m.role === 'user' && last.role === 'user' && !last.tool_calls){
            last.content += '\n' + m.content;
        } else if(m.role === 'tool'){
            out.push({role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content});
        } else if(m.role === 'assistant' && m.toolCalls?.length){
            out.push({role: 'assistant', content: m.content ?? '', tool_calls: m.toolCalls.map(call => ({
                id: call.id, type: 'function', function: {name: call.name, arguments: JSON.stringify(call.input ?? {})},
            }))});
        } else {
            out.push({role: m.role, content: m.content});
        }
    }
    return out;
}

// content may be a string or an array of chunks (text / thinking); keep only the text.
function readText(content){
    if(typeof content === 'string') return content;
    if(!Array.isArray(content)) return '';
    return content.filter(chunk => chunk?.type === 'text').map(chunk => chunk.text ?? '').join('');
}

function readArguments(args){
    if(args && typeof args === 'object') return args;
    try { return JSON.parse(args || '{}'); } catch { return {}; }
}

function createProvider(chatConfig, {fetchImpl = fetch, now = Date.now, wait = sleep} = {}){
    if(!chatConfig.apiKey) throw new Error('chat.apiKey is required for the mistral provider');
    if(!chatConfig.model) throw new Error('chat.model is required for the mistral provider');
    const url = `${chatConfig.baseUrl ?? DEFAULT_URL}/v1/chat/completions`;
    let minInterval = 1000 / (chatConfig.requestsPerSecond ?? 1);
    const tokensPerMinute = chatConfig.tokensPerMinute ?? 20000;

    let queue = Promise.resolve();
    let lastStart = -Infinity;
    const spent = []; // [{at, tokens}] within the last minute

    // Wait until this request fits in both limits, then reserve its slot.
    async function reserve(estimate){
        for(;;){
            const t = now();
            while(spent.length && spent[0].at <= t - MINUTE) spent.shift();
            const used = spent.reduce((sum, s) => sum + s.tokens, 0);
            const rateWait = lastStart + minInterval - t;
            // A single request larger than the whole budget is sent once the window is empty.
            const tokenWait = used + estimate > tokensPerMinute && spent.length ? spent[0].at + MINUTE - t : 0;
            const delay = Math.max(rateWait, tokenWait);
            if(delay <= 0) break;
            await wait(delay);
        }
        lastStart = now();
        const entry = {at: lastStart, tokens: estimate};
        spent.push(entry);
        return entry;
    }

    async function send(body, estimate){
        for(let attempt = 0; ; attempt++){
            const entry = await reserve(estimate);
            const response = await fetchImpl(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${chatConfig.apiKey}`},
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            // Follow the per-minute request limit the API reports, if it is stricter than the config.
            const perMinute = Number(response.headers.get('x-ratelimit-limit-req-minute'));
            if(perMinute > 0) minInterval = Math.max(minInterval, MINUTE / perMinute);
            if(response.ok){
                const data = await response.json();
                if(data.usage?.total_tokens) entry.tokens = data.usage.total_tokens;
                return data;
            }
            const detail = (await response.text().catch(() => '')).slice(0, 300);
            // A limit of 0 means the account has no API access to this model (Free mode); retrying won't help.
            if(response.status === 429 && response.headers.get('x-ratelimit-limit-req-minute') === '0'){
                throw new Error(`Mistral API 429: no API access to ${chatConfig.model} on this account (limit 0, Free mode?). Enable pay-as-you-go or use another model. ${detail}`);
            }
            const retryable = response.status === 429 || response.status >= 500;
            if(!retryable || attempt >= MAX_RETRIES) throw new Error(`Mistral API ${response.status}: ${detail}`);
            const retryAfter = Number(response.headers.get('retry-after'));
            await wait(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
        }
    }

    return {
        supportsTools: true,
        async generate({system, messages, maxTokens, tools}){
            const body = {
                model: chatConfig.model,
                messages: toMistralMessages(system, messages),
                max_tokens: maxTokens,
                temperature: chatConfig.temperature ?? 0.7,
            };
            if(tools?.length){
                body.tools = tools.map(tool => ({type: 'function', function: tool}));
                body.tool_choice = 'auto';
            }
            const estimate = estimateTokens(JSON.stringify(body.messages) + JSON.stringify(body.tools ?? '')) + (maxTokens ?? 0);

            // Serialize every request through the queue so the limits hold across concurrent chats.
            const result = queue.then(() => send(body, estimate));
            queue = result.catch(() => {});
            const data = await result;

            const message = data.choices?.[0]?.message ?? {};
            const text = readText(message.content);
            const toolCalls = (message.tool_calls ?? []).map((call, i) => ({
                id: call.id ?? `call${i}`,
                name: call.function?.name,
                input: readArguments(call.function?.arguments),
            }));
            if(process.env.CHAT_DEBUG) console.log('[chat] mistral usage', data.usage);
            return toolCalls.length ? {text, toolCalls} : text;
        },
    };
}

module.exports = {createProvider, toMistralMessages, estimateTokens};
