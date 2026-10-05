
import { NextRequest, NextResponse } from "next/server"
import PdfParse from "pdf-parse";
import { filecleaning } from "./clean/fileclean";
import { chunks } from "./chunks/chunkings";
import { embedding } from "./embeddings/embedded";
import { pinecone } from "./vectordb/pineconedb";
export async function POST(req: NextRequest) {
    try {
        const formdata = await req.formData();
        const file = formdata.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ "message": "file is not their" });
        }
        const buffer = Buffer.from(await file.arrayBuffer());

        if (!buffer) {
            return NextResponse.json({ "messsage": "buffer data of pdf not provide" });
        }

        const pdftext = await PdfParse(buffer);
        const cleandata: any = await filecleaning({ pdf: pdftext.text });

        if (!cleandata) {
            return NextResponse.json({ message: "failed to clean the data" })
        }

        const datachunk: any = await chunks(cleandata);
        if (!datachunk) {
            return NextResponse.json({ message: "failed to create chunks" })
        }

        const embeddings: any = await embedding({ chunks: datachunk });

        if (!embeddings || embeddings.length === 0) {
            return NextResponse.json({ message: "No embeddings were generated — check HUGGINGFACE_API_KEY" });
        }
        console.log(`embeddings generated: ${embeddings.length} vectors`);

        const database: any = await pinecone({
            embeddings: embeddings,
            chunks: datachunk,                  // store text in Pinecone metadata for RAG
            metadata: { fileName: file.name },  // tag each vector with source filename
        });
        if (!database) {
            return NextResponse.json({ message: "database is not updated" })
        }

        return NextResponse.json({
            message: "success",
            chunks: datachunk.length,
            database: database,
        })


    } catch (error: any) {
        const detail = error?.message || JSON.stringify(error) || "Unknown error";
        console.error("documentprocess error:", detail);
        return NextResponse.json({ message: "error occurred", error: detail }, { status: 500 })
    }
}