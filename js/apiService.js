export async function streamGeminiResponse(apiKey, requestBody, onChunk) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }

            const chunkText = decoder.decode(value);
            // The response is a stream of server-sent events (SSE). We need to parse them.
            // Each data block is prefixed with "data: ".
            const lines = chunkText.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6); // Remove "data: "
                        if (jsonStr) {
                           const parsed = JSON.parse(jsonStr);
                           const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                           if (content) {
                                onChunk(content);
                           }
                        }
                    } catch (e) {
                        // Ignore parsing errors for incomplete JSON chunks
                        console.warn("Could not parse stream chunk:", line);
                    }
                }
            }
        }

    } catch (error) {
        console.error("Error communicating with Gemini API:", error);
        throw error;
    }
}