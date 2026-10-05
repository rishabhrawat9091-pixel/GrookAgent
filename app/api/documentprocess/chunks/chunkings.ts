export async function chunks(text: string): Promise<string[]> {
    try {
        const chunkSize = 1000;
        const chunkOverlap = 200;

        const chunks =
            text.match(
                new RegExp(`.{1,${chunkSize}}`, "gs")
            ) || [];

        return chunks.map(
            (chunk: string, index: number) => {
                const overlap =
                    chunks[index - 1]?.slice(-chunkOverlap) || "";

                return `${overlap}${chunk}`;
            }
        );
    } catch (error) {
        console.error("Chunking error:", error);
        return [];
    }
}